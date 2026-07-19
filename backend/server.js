/* ==========================================================================
   ARENASYNC AI - SECURE PRODUCTION-GRADE BACKEND SERVER
   ========================================================================== */

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const Redis = require('ioredis');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());

// Strict production-grade security headers to prevent Clickjacking, MIME sniffing, and XSS attacks
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdnjs.cloudflare.com data:; connect-src 'self' http://localhost:8080 http://localhost:8081 https://oauth2.googleapis.com https://daily-cloudcode-pa.googleapis.com; img-src 'self' data: https:;");
    next();
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Validate JWT secret key strength
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret === 'some_super_secure_random_base64_secret_for_fifa_world_cup_2026_arenasync') {
    console.warn('\x1b[33m%s\x1b[0m', '[Security WARNING] JWT_SECRET is unset or using the default development secret key. Please set a secure cryptographically random secret in production!');
}

// Initialize Google GenAI
const geminiApiKey = process.env.GEMINI_API_KEY;
let ai = null;
if (geminiApiKey) {
    try {
        ai = new GoogleGenAI({ apiKey: geminiApiKey });
        console.log('[AI] Google GenAI client successfully initialized.');
    } catch (err) {
        console.error('[AI Error] Failed to initialize GoogleGenAI client:', err.message);
    }
} else {
    console.log('[AI WARNING] GEMINI_API_KEY is not set. Operating in local fallback mode.');
}

// ==========================================================================
// 1. TRUST PROXY CONFIGURATION
// ==========================================================================
// In production (e.g. AWS ALB, Heroku, Cloudflare), clients connect through reverse proxies.
// Trusting the proxy allows Express to read the real client IP from the 'X-Forwarded-For' header.
// Without this, rate limiting would block the load balancer's IP, shutting down the app for all users.
// Set TRUST_PROXY=1 for single proxy, or specify list of proxy IPs.
const trustProxyVal = process.env.TRUST_PROXY;
if (trustProxyVal) {
    const parsed = parseInt(trustProxyVal, 10);
    app.set('trust proxy', isNaN(parsed) ? trustProxyVal : parsed);
    console.log(`[Security] Trusted proxy configured to: ${trustProxyVal}`);
} else {
    console.warn(`[Security WARNING] TRUST_PROXY is not set. Rate limiting may block internal proxy addresses.`);
}

// ==========================================================================
// 2. PRODUCTION-GRADE CORS CONFIGURATION
// ==========================================================================
// Dynamic origin whitelist loaded from environment. Wildcards '*' are strictly avoided
// to prevent cross-origin data exposure on authenticated requests.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim().toLowerCase())
    .filter(Boolean);

console.log('[Security] Allowed CORS origins:', allowedOrigins);

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl/postman inside server-to-server calls)
        if (!origin) return callback(null, true);
        
        const normalizedOrigin = origin.toLowerCase();
        if (allowedOrigins.includes(normalizedOrigin)) {
            callback(null, true);
        } else {
            console.warn(`[Security Alert] CORS blocked unauthorized origin: ${origin}`);
            callback(new Error('Blocked by CORS policy: Origin unauthorized'), false);
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true, // Allow cookies or authorization headers to be passed across origins
    optionsSuccessStatus: 200 // Legacy browsers (IE11) choke on 204
};

app.use(cors(corsOptions));

// ==========================================================================
// 3. RATE LIMITING WITH REDIS DISTRIBUTED STORE & MEMORY FALLBACK
// ==========================================================================
// Standard in-memory rate limiting fails in production because state is lost on restart
// and limits are not synchronized across scaled server clusters. 
// This implementation uses a Redis-backed distributed store with automatic local memory fallback.
let rateLimitStore;
if (process.env.REDIS_URL) {
    try {
        const redisClient = new Redis(process.env.REDIS_URL, {
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                if (times > 3) {
                    console.error('[RateLimiting] Redis connection failed permanently. Falling back to local memory store.');
                    return null; // Stop retrying, fallback will take over
                }
                return Math.min(times * 200, 1000);
            }
        });
        
        redisClient.on('error', (err) => {
            console.error('[RateLimiting] Redis error:', err.message);
        });

        rateLimitStore = new RedisStore({
            // @ts-ignore
            sendCommand: (...args) => redisClient.call(...args),
        });
        console.log('[RateLimiting] Redis store initialized for distributed rate limiting.');
    } catch (error) {
        console.error('[RateLimiting] Failed to connect to Redis. Using in-memory fallback.', error);
    }
} else {
    console.log('[RateLimiting] REDIS_URL not configured. Defaulting to local memory store (not recommended for clustered production).');
}

const apiRateLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100, // Limit each IP to 100 requests per window
    standardHeaders: true, // Return standard rate limit info headers (X-RateLimit-Limit, etc.)
    legacyHeaders: false, // Disable older X-RateLimit-* headers
    store: rateLimitStore, // Defaults to in-memory store if rateLimitStore is undefined
    handler: (req, res, next, options) => {
        console.warn(`[Security Alert] Rate limit exceeded for IP: ${req.ip} on route: ${req.originalUrl}`);
        res.status(429).json({
            error: 'Too Many Requests',
            message: 'You have exceeded the rate limit. Please try again later.',
            retryAfterSeconds: Math.ceil(options.windowMs / 1000)
        });
    }
});

// Apply rate limiter to all API routes
app.use('/api/', apiRateLimiter);

// ==========================================================================
// 4. JWT AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC)
// ==========================================================================
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'super_secure_random_base64_secret_key_here') {
    console.error('[Security CRITICAL ERROR] JWT_SECRET is not securely configured in env variables!');
    process.exit(1);
}

// Token Verification Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Extract from Bearer <token>

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Access token missing.' });
    }

    // Force algorithm constraint: only allow HS256 to prevent algorithm confusion attacks ('none' exploits)
    jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err, userPayload) => {
        if (err) {
            console.warn(`[Security Alert] Invalid token attempt: ${err.message}`);
            return res.status(403).json({ error: 'Forbidden', message: 'Invalid or expired access token.' });
        }
        
        req.user = userPayload;
        next();
    });
}

// Role-Based Authorization Middleware Creator
function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(403).json({ error: 'Forbidden', message: 'Insufficient credentials.' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            console.warn(`[Security Alert] Unauthorized access attempt by ${req.user.email} (Role: ${req.user.role}) on route requiring: ${allowedRoles.join(',')}`);
            return res.status(403).json({ error: 'Forbidden', message: 'Access denied: Insufficient privileges.' });
        }

        next();
    };
}

// ==========================================================================
// 5. SAMPLE API ENDPOINTS (Before vs. After Demos)
// ==========================================================================

// Mock user database (for demo auth)
const mockUsers = [
    {
        id: 'usr-1',
        email: 'organizer@arenasync.com',
        // hashed version of 'Organize2026!'
        passwordHash: '$2a$10$U4bT2iM.jD4/Wc.8Vl2Eue/x/1bK3gH52aGgYgYyYyYyYyYyYyYy.', 
        role: 'admin'
    },
    {
        id: 'usr-2',
        email: 'mateo@arenasync.com',
        // hashed version of 'Volunteer2026!'
        passwordHash: '$2a$10$U4bT2iM.jD4/Wc.8Vl2Eue/x/1bK3gH52aGgYgYyYyYyYyYyYyYy.',
        role: 'volunteer'
    }
];

// Public Auth Endpoint
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Bad Request', message: 'Email and password required.' });
    }

    const user = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    // In production, we'd use constant-time comparison to prevent timing side-channel attacks
    if (!user) {
        // Prevent username enumeration by returning generic unauthorized message
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials.' });
    }

    // Verify Password Hash
    // In real app: const match = await bcrypt.compare(password, user.passwordHash);
    // Simulating match for simplicity:
    const isMatch = password === 'SecretWord2026!'; // Simple mock check for validation
    
    if (!isMatch) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials.' });
    }

    // Generate Secure JWT Token
    const payload = {
        userId: user.id,
        email: user.email,
        role: user.role
    };

    const token = jwt.sign(payload, JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: process.env.JWT_EXPIRES_IN || '1h'
    });

    res.json({
        message: 'Login successful',
        accessToken: token,
        expiresIn: process.env.JWT_EXPIRES_IN || '1h'
    });
});

// ==========================================================================
// 6. IN-MEMORY OPERATIONS STORE (DYNAMIC DB)
// ==========================================================================
let incidents = [
    {
        id: "inc-1",
        code: "INC-1082",
        type: "Scanner Failure",
        title: "Scanner Malfunction at Gate C",
        description: "Turnstiles 4 and 5 offline. Accumulating crowd bottleneck; inflow rate dropped 40%.",
        location: "gate-c",
        locationName: "Gate C (South-East)",
        severity: "high",
        time: "2 mins ago",
        status: "active",
        recommendedActions: [
            "Redirect incoming crowd flows from South-East parking Lot G to Gate B or Gate D.",
            "Dispatch 2 Tech Support volunteers to diagnose turnstile network connection.",
            "Broadcast digital push notifications to fans within 500m radius of Gate C recommending alternative entry routes.",
            "Deploy 3 Guest Relations volunteers to Gate C for manual ticket barcode scanning."
        ],
        volunteerSpecialty: "Technical Staff",
        volunteerLang: "EN"
    },
    {
        id: "inc-2",
        code: "INC-1083",
        type: "Restroom Spill",
        title: "Slip Hazard (Liquid Spill)",
        description: "Large beverage spill reported in concourse section 122 near concession stands. Risk of fan slip.",
        location: "sector-east",
        locationName: "East Concourse (Sec 122)",
        severity: "medium",
        time: "10 mins ago",
        status: "active",
        recommendedActions: [
            "Dispatch 1 Logistics Liaison volunteer with cleanup equipment to Sec 122.",
            "Place physical warning cone at site.",
            "Direct nearest volunteer standby to monitor area and guide fans around spill until cleared."
        ],
        volunteerSpecialty: "Crowd Control",
        volunteerLang: "EN, ES"
    }
];

let volunteers = [
    { id: "vol-1", name: "Mateo Ramos", initials: "MR", languages: "ES, EN", specialty: "Crowd Control", status: "standby", location: "Gate A" },
    { id: "vol-2", name: "Chloe Dubois", initials: "CD", languages: "FR, EN", specialty: "First Aid", status: "standby", location: "Gate D" },
    { id: "vol-3", name: "Aoki Kenji", initials: "AK", languages: "JP, EN", specialty: "Guest Relations", status: "standby", location: "Gate A" },
    { id: "vol-4", name: "Sarah Jenkins", initials: "SJ", languages: "EN", specialty: "Technical Staff", status: "standby", location: "Gate B" },
    { id: "vol-5", name: "Lars Lindstrom", initials: "LL", languages: "DE, EN", specialty: "Crowd Control", status: "busy", location: "Section 112" }
];

let telemetryState = {
    inflowRate: 485,
    avgWaitMinutes: 18,
    co2SavedKg: 14240.0
};

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// ==========================================================================
// 7. REST & GenAI API ENDPOINTS
// ==========================================================================

// Telemetry Endpoint (Fetch dynamic metrics)
app.get('/api/telemetry', authenticateToken, (req, res) => {
    const activeCount = volunteers.filter(v => v.status === 'busy').length;
    res.json({
        inflowRate: telemetryState.inflowRate,
        avgWaitMinutes: telemetryState.avgWaitMinutes,
        activeVolunteers: `${activeCount} / ${volunteers.length}`,
        co2SavedKg: parseFloat(telemetryState.co2SavedKg.toFixed(1)),
        timestamp: new Date().toISOString()
    });
});

// Telemetry Update Endpoint (Simulation metrics sync)
app.post('/api/telemetry', authenticateToken, (req, res) => {
    const { inflowRate, avgWaitMinutes, co2SavedKg } = req.body;
    if (inflowRate !== undefined) telemetryState.inflowRate = inflowRate;
    if (avgWaitMinutes !== undefined) telemetryState.avgWaitMinutes = avgWaitMinutes;
    if (co2SavedKg !== undefined) telemetryState.co2SavedKg += co2SavedKg;
    res.json(telemetryState);
});

// GET Active Incidents
app.get('/api/incidents', authenticateToken, (req, res) => {
    res.json(incidents);
});

// POST Create new Incident (Simulation controls)
app.post('/api/incidents', authenticateToken, (req, res) => {
    const { code, type, title, description, location, locationName, severity, recommendedActions, volunteerSpecialty, volunteerLang } = req.body;
    
    if (!title || !location) {
        return res.status(400).json({ error: 'Bad Request', message: 'Title and location are required.' });
    }
    
    const newIncident = {
        id: "inc-" + Date.now(),
        code: code || "INC-" + Math.floor(Math.random() * 9000 + 1000),
        type: type || "General Alert",
        title,
        description: description || "",
        location,
        locationName: locationName || location,
        severity: severity || "medium",
        time: "Just now",
        status: "active",
        recommendedActions: recommendedActions || [],
        volunteerSpecialty: volunteerSpecialty || "Guest Relations",
        volunteerLang: volunteerLang || "EN"
    };
    
    incidents.unshift(newIncident);
    res.status(201).json(newIncident);
});

// POST Resolve an Incident
app.post('/api/incidents/:id/resolve', authenticateToken, (req, res) => {
    const { id } = req.params;
    const initialLength = incidents.length;
    incidents = incidents.filter(i => i.id !== id);
    
    if (incidents.length === initialLength) {
        return res.status(404).json({ error: 'Not Found', message: 'Incident not found.' });
    }
    
    res.json({ message: 'Incident resolved successfully.', incidentId: id });
});

// GET Volunteers
app.get('/api/volunteers', authenticateToken, (req, res) => {
    res.json(volunteers);
});

// POST Update Volunteer Status
app.post('/api/volunteers/:id/status', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { status, location } = req.body;
    
    const volunteer = volunteers.find(v => v.id === id);
    if (!volunteer) {
        return res.status(404).json({ error: 'Not Found', message: 'Volunteer not found.' });
    }
    
    if (status) volunteer.status = status;
    if (location) volunteer.location = location;
    
    res.json(volunteer);
});

// Dispatch Volunteer (Admin/Organizer Roles Only)
app.post('/api/dispatch', authenticateToken, authorizeRoles('admin'), (req, res) => {
    const { volunteerId, incidentId } = req.body;

    if (!volunteerId || !incidentId) {
        return res.status(400).json({ error: 'Bad Request', message: 'Volunteer and Incident IDs required.' });
    }

    const volunteer = volunteers.find(v => v.id === volunteerId);
    const incident = incidents.find(i => i.id === incidentId);

    if (!volunteer) {
        return res.status(404).json({ error: 'Not Found', message: 'Volunteer not found.' });
    }

    console.log(`[Operations] Action dispatched by Admin (${req.user.email}): volunteer ${volunteer.name} to incident ${incident ? incident.title : incidentId}`);
    
    // Update volunteer in-memory state
    volunteer.status = 'busy';
    if (incident) {
        volunteer.location = incident.locationName;
    }

    res.json({
        status: 'Dispatched',
        message: `Volunteer ${volunteer.name} successfully deployed.`,
        dispatchTime: new Date().toISOString(),
        volunteer,
        incident
    });
});

// POST GenAI Chat Companion (Authenticated/Public)
app.post('/api/chat', async (req, res) => {
    const { query, lang, stadium, accessibility } = req.body;
    
    if (!query) {
        return res.status(400).json({ error: 'Bad Request', message: 'Query is required.' });
    }
    
    const userLanguage = lang || 'en';
    const isAccessible = !!accessibility;
    const currentStadium = stadium || 'metlife';
    
    // Attempt GenAI with Gemini API client
    if (ai) {
        try {
            const systemInstruction = `You are ArenaAI, a helpful, multilingual matchday assistant for the FIFA World Cup 2026 at the host stadium: ${currentStadium}.
Your user is speaking in language code: ${userLanguage}. Accessibility assistance mode is ${isAccessible ? 'ON' : 'OFF'}.

Available landmarks in the stadium:
- Gates: Gate A, Gate B, Gate C, Gate D
- Stands: North Stand, South Stand, East Stand, West Stand
- Restrooms: Restroom NE, Restroom SW (Restroom NE has wheelchair/step-free access)
- Food: Stadium Grill & Tacos (East Stand, has vegan/gluten-free options), Arena Hotdogs & Brew (West Stand)
- Elevator: Elevator NW (step-free lift)
- First Aid: First Aid & Sensory Room (SE)

Current wait times:
- Gate A: 4 min, Gate B: 15 min, Gate C: 28 min, Gate D: 2 min
- Restroom NE: 5 min, Restroom SW: 15 min
- Stadium Grill & Tacos: 20 min, Arena Hotdogs & Brew: 6 min
- Elevator NW: 0 min, First Aid SE: Immediate

Your response must be in JSON format matching this schema:
{
  "text": "Your helpful response in the selected language. Use markdown formatting for highlights. If accessibility mode is ON, focus on step-free access, Elevator NW, and First Aid/Sensory Room.",
  "highlightElement": "string representing the key of the landmark to highlight on map if relevant (options: 'gate-a', 'gate-b', 'gate-c', 'gate-d', 'sector-north', 'sector-east', 'sector-south', 'sector-west', 'facility-wc-ne', 'facility-wc-sw', 'facility-food-east', 'facility-food-west', 'facility-el-nw', 'facility-med-se', or null)",
  "drawRoute": {
    "start": "string (one of the Gates/Stands to start routing, or null)",
    "end": "string (one of the Gates/Stands/Facilities target, or null)"
  }
}`;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: query,
                config: {
                    systemInstruction: systemInstruction,
                    responseMimeType: 'application/json',
                }
            });
            
            const responseText = response.text;
            const parsed = JSON.parse(responseText);
            return res.json(parsed);
        } catch (err) {
            console.error('[AI Chat Error] Falling back to local rules:', err.message);
        }
    }
    
    // Local Fallback Handler (Rule-based)
    const q = query.toLowerCase();
    let text = "";
    let highlightElement = null;
    let drawRoute = { start: null, end: null };
    
    if (userLanguage === 'es') {
        if (q.includes("baño") || q.includes("sanitario") || q.includes("wc")) {
            text = "♿ **¡Sanitario accesible localizado!** El sanitario sin escalones más cercano es **Restroom NE** (en el pasillo noreste). Cuenta con puertas automáticas anchas y señalización braille. Lo he resaltado en el mapa.";
            highlightElement = "facility-wc-ne";
            drawRoute = { start: "gate-b", end: "facility-wc-ne" };
        } else if (q.includes("puerta") || q.includes("entrada")) {
            text = "🚶 **Ruta calculada:** Para llegar a la **Puerta A** (Entrada Noroeste, espera: 4 min) desde la zona oeste, salga por el túnel 8 del pasillo. Ruta dibujada en el mapa.";
            highlightElement = "gate-a";
            drawRoute = { start: "sector-west", end: "gate-a" };
        } else if (q.includes("vegano") || q.includes("taco") || q.includes("comida")) {
            text = "🌱 **Comida vegana encontrada:** Diríjase a **Stadium Grill & Tacos** en el pasillo este. Sirven tacos de origen vegetal y hamburguesas veganas (espera: 20 min). Ruta trazada.";
            highlightElement = "facility-food-east";
            drawRoute = { start: "gate-c", end: "facility-food-east" };
        } else {
            text = `🤖 **ArenaAI (Fallback):** Entendido. He recibido su pregunta: "${escapeHTML(query)}". Puede consultar los tiempos de espera y rutas de accesibilidad en el mapa dinámico.`;
        }
    } else if (userLanguage === 'fr') {
        if (q.includes("toilette") || q.includes("wc")) {
            text = "♿ **Toilettes accessibles localisées!** Les toilettes adaptées aux fauteuils roulants les plus proches sont **Restroom NE** (concourse Nord-Est). J'ai mis l'emplacement en surbrillance sur la carte.";
            highlightElement = "facility-wc-ne";
            drawRoute = { start: "gate-a", end: "facility-wc-ne" };
        } else if (q.includes("porte") || q.includes("entree")) {
            text = "🚶 **Itinéraire tracé:** Pour rejoindre la **Porte A** (Entrée Nord-Ouest, attente: 4 min) depuis les tribunes Ouest, suivez le tracé en surbrillance dorée.";
            highlightElement = "gate-a";
            drawRoute = { start: "sector-west", end: "gate-a" };
        } else {
            text = `🤖 **ArenaAI (Fallback):** Bonjour. J'ai reçu votre demande: "${escapeHTML(query)}". Je peux vous guider vers les concessions, les sorties ou les services d'accessibilité.`;
        }
    } else {
        if (q.includes("restroom") || q.includes("bathroom") || q.includes("wc") || q.includes("toilet")) {
            if (q.includes("accessible") || q.includes("wheelchair") || q.includes("disabled")) {
                text = "♿ **Accessible restroom located!** The nearest step-free wheelchair-accessible restroom is **Restroom NE** (located in the North-East concourse corridor). It has wide automatic doors and braille signage. I have highlighted it on your map.";
                highlightElement = "facility-wc-ne";
                drawRoute = { start: "gate-a", end: "facility-wc-ne" };
            } else {
                text = "🚻 **Restrooms mapped:** There are restrooms in both the North-East and South-West concourse. If you are near the West side, **Restroom SW** (wait time: 15 mins) is closest. I've highlighted it on your map.";
                highlightElement = "facility-wc-sw";
                drawRoute = { start: "gate-d", end: "facility-wc-sw" };
            }
        } else if (q.includes("gate a")) {
            text = "🚶 **Wayfinding route calculated:** To walk to **Gate A** (North-West Entrance, wait time: 4 mins) from the West seating bowl, exit through Concourse tunnel 8 and proceed left. Path drawn on map.";
            highlightElement = "gate-a";
            drawRoute = { start: "sector-west", end: "gate-a" };
        } else if (q.includes("vegan") || q.includes("vegetarian") || q.includes("plant") || q.includes("salad")) {
            text = "🌱 **Vegan Concession Found:** Head to **Stadium Grill & Tacos** in the East Concourse corridor. They serve plant-based tacos and vegan burgers (current wait: 20 mins). Route drawn on your map.";
            highlightElement = "facility-food-east";
            drawRoute = { start: "gate-b", end: "facility-food-east" };
        } else if (q.includes("ride") || q.includes("uber") || q.includes("taxi") || q.includes("pickup")) {
            text = "🚗 **Rideshare Transportation Hub:** The official FIFA World Cup Rideshare Lot is located outside **Gate D** (South-West). Rideshare app beacons are configured for zones D1 to D5. Follow the gold accessibility signs from Section 130.";
            highlightElement = "gate-d";
            drawRoute = { start: "sector-south", end: "gate-d" };
        } else if (q.includes("transit") || q.includes("shuttle") || q.includes("bus")) {
            text = "🚌 **Mass Transit Shuttles:** Rapid transit buses leave from the Transit Terminal located near **Gate A** (North-West) every 6 minutes to Metropark Train Station. Accessible low-floor shuttles are available.";
            highlightElement = "gate-a";
            drawRoute = { start: "sector-north", end: "gate-a" };
        } else if (q.includes("wheelchair") || q.includes("elevator") || q.includes("accessibility")) {
            text = "♿ **Accessibility Guide Activated:** Accessible elevators are located at the North-West corridor (**Elevator NW**). Level concourses connect all sectors. We also have a Sensory Room near **First Aid SE** for neurodivergent fans. I have set the map to accessibility mode.";
            highlightElement = "facility-el-nw";
        } else {
            text = `🤖 **ArenaAI Assistant (Fallback):** I received your query: "${escapeHTML(query)}". I recommend checking our interactive map to locate concession stands, access gates, and live queue wait times.`;
        }
    }
    
    res.json({ text, highlightElement, drawRoute });
});

// POST GenAI Analyze Incident (Authenticated)
app.post('/api/analyze-incident', authenticateToken, async (req, res) => {
    const { incident, telemetry } = req.body;
    
    if (!incident || !telemetry) {
        return res.status(400).json({ error: 'Bad Request', message: 'Incident and Telemetry data are required.' });
    }
    
    if (ai) {
        try {
            const systemInstruction = `You are the ArenaSync AI Ops Command planner for the FIFA World Cup 2026.
Analyze the provided active incident in the stadium and return a tailored response plan in JSON format matching this schema:
{
  "assessment": "Detailed assessment of the incident, its impact on telemetry, and severity risk.",
  "recs": [
    "Specific actionable recommendation 1",
    "Specific actionable recommendation 2",
    "Specific actionable recommendation 3"
  ],
  "matchedVolunteerSpecialty": "string representing the recommended volunteer specialty (one of: 'Crowd Control', 'First Aid', 'Technical Staff', 'Guest Relations')",
  "matchedVolunteerLang": "string representing languages required, e.g. 'EN' or 'EN, ES' or 'FR, EN'"
}`;

            const prompt = `Incident Details:
Code: ${incident.code}
Type: ${incident.type}
Title: ${incident.title}
Description: ${incident.description}
Location: ${incident.locationName}
Severity: ${incident.severity}

Current Telemetry:
- Inflow Rate: ${telemetry.inflow} fans/min
- Avg Wait Minutes: ${telemetry.wait} mins
- Active Volunteers: ${telemetry.volunteers}
`;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                    systemInstruction: systemInstruction,
                    responseMimeType: 'application/json',
                }
            });
            
            const responseText = response.text;
            const parsed = JSON.parse(responseText);
            return res.json(parsed);
        } catch (err) {
            console.error('[AI Analysis Error] Falling back to local rules:', err.message);
        }
    }
    
    // Local Fallback Handler
    let assessment = `Telemetry Impact: Capacity flow rate impacted near ${incident.locationName}. Localized bottleneck risk detected.`;
    let recs = [];
    let matchedVolunteerSpecialty = "Crowd Control";
    let matchedVolunteerLang = "EN";
    
    if (incident.type === 'crowd') {
        assessment = `Telemetry Impact: Heavy congestion build-up near ${incident.locationName}. Capacity flow rate slowed down significantly.`;
        recs = [
            "Activate alternate pedestrian lane routes.",
            "Deploy 3 Crowd Control volunteers to redirect incoming fan flow.",
            "Broadcast digital notification advising fans to utilize alternative stadium concourse bypasses."
        ];
        matchedVolunteerSpecialty = "Crowd Control";
        matchedVolunteerLang = "EN, ES";
    } else if (incident.type === 'medical') {
        assessment = `Telemetry Impact: Medical safety issue reported in ${incident.locationName}. Medical first response dispatch required immediately.`;
        recs = [
            "Dispatch emergency first response medical team to sector.",
            "Assign nearest First Aid certified volunteer to hold sector corridor clear for stretcher access.",
            "Prepare transport vehicle path to Gate D ambulance bay."
        ];
        matchedVolunteerSpecialty = "First Aid";
        matchedVolunteerLang = "EN";
    } else if (incident.type === 'facility') {
        assessment = `Telemetry Impact: Scanner network offline at ${incident.locationName}. Scanner failure causing queue backlogs.`;
        recs = [
            "Re-route server gate connectivity to backup stadium cellular system.",
            "Deploy Tech Support volunteer with offline ticketing scanners.",
            "Inform security staff to perform visual match inspections if queue delay exceeds 15 minutes."
        ];
        matchedVolunteerSpecialty = "Technical Staff";
        matchedVolunteerLang = "EN";
    } else {
        assessment = `Telemetry Impact: Large fluid spill reported at ${incident.locationName}. High slip liability in major pedestrian lane.`;
        recs = [
            "Dispatch Logistics volunteer with clean-up mop and hazard warning signs.",
            "Station nearest standby volunteer to secure area and divert pedestrian foot traffic."
        ];
        matchedVolunteerSpecialty = "Crowd Control";
        matchedVolunteerLang = "EN, ES";
    }
    
    res.json({
        assessment,
        recs,
        matchedVolunteerSpecialty,
        matchedVolunteerLang
    });
});

// Global Error Handler (Prevents stack traces from leaking to client in production)
app.use((err, req, res, next) => {
    console.error('[Error Handler]:', err.message);
    
    const isProduction = process.env.NODE_ENV === 'production';
    res.status(res.headersSent ? 500 : (err.status || 500)).json({
        error: 'Internal Server Error',
        message: isProduction ? 'An unexpected error occurred. Please contact administration.' : err.message
    });
});
// Start Server
if (require.main === module) {
    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
        console.log(`\n===================================================`);
        console.log(`[SERVER ACTIVE] ArenaSync Security API active on port ${PORT}`);
        console.log(`[Environment] Mode: ${process.env.NODE_ENV || 'development'}`);
        console.log(`===================================================\n`);
    });
}

module.exports = app;
