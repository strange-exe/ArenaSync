# ArenaSync: Smart Stadium & Operations Intelligence Hub

ArenaSync is a GenAI-enabled stadium operations and tournament experience hub built for the **FIFA World Cup 2026**. It leverages Generative AI and real-time telemetry to optimize crowd control, wayfinding, accessibility, and volunteer dispatch operations.

---

## 1. Chosen Vertical: Smart Stadiums & Tournament Operations
During major tournaments like the FIFA World Cup 2026, stadium venues face two core challenges:
1. **Fan Experience Friction**: Fans require multilingual assistance to find restrooms, accessibility entries, food stands, rideshare hubs, and transit options.
2. **Logistics & Security Bottlenecks**: Venue managers need an operations command center to monitor live telemetry, assess incidents, and deploy standby volunteers matching task requirements (languages, first-aid skills, technical capabilities).

ArenaSync integrates these two perspectives into a single unified web application.

---

## 2. Approach and Logic

### Monorepo Architecture
- **Frontend (`/frontend`)**: A client-side workspace featuring:
  - **Three.js 3D Render Engine**: Renders a physical 3D model of stadium stands, gates, and concession areas. Displays animated wayfinding paths in gilded copper tube vectors.
  - **Speech-to-Text (STT) & Text-to-Speech (TTS)**: Translates user speech and speaks bot answers dynamically.
  - **WAI-ARIA Landmarks**: Employs semantic markup, `aria-live` containers, skip-navigation links, and `role` attributes to ensure WCAG 2.1 AA compliance.
  - **Slash Design System**: Implements a midnight vault aesthetic with Playfair Display serif typography, Inter sans-serif body text, and copper editorial accents.
- **Backend (`/backend`)**: A secure Express server containing:
  - **JWT Authentication & RBAC**: Secures administrative REST routes with HS256-algorithm-pinned JWT verification, restricting actions to certified organizers.
  - **Production Security Headers**: Enforces strict CSP (without `unsafe-eval`), HSTS, Referrer-Policy, Permissions-Policy, XSS protection, MIME-sniffing protection, and clickjacking protection.
  - **Input Validation & Sanitization**: All mutation endpoints validate numeric ranges, enum values, and HTML-escape user-supplied strings to prevent XSS injection.
  - **Redis & Memory Rate-Limiting**: Dynamically limits request frequencies with distributed Redis store and automatic local memory fallback.
  - **Efficient Data Operations**: Uses pre-compiled regex, O(1) array splice for incident resolution, and cached lookup tables.

### Dynamic GenAI Logic
- Endpoints utilize the new `@google/genai` SDK and the fast `gemini-3-flash-preview` model.
- All GenAI endpoints enforce structured JSON schemas.
- **Robust Fallback Engine**: If the backend is offline, or the `GEMINI_API_KEY` is not set, both the client and server automatically fall back to local rule-based matchers, ensuring zero operational downtime.

---

## 3. How the Solution Works

### 1. Fan Experience Hub
- **AI Matchday Companion**: Fans can type or speak questions in English, Spanish, or French.
- **Dynamic 3D Wayfinding**: AI responses trigger coordinate panning and draw glowing gold-neon tubes routing the fan from their seating bowl to their target facility.
- **Carbon Footprint Calculator**: A gamified widget calculates carbon impact and unlocks user badges (e.g., "Eco Hero") based on transit choices.

### 2. Operations Command Portal
- **Telemetry Indicators**: Pushes mock fluctuations of stadium inflow rates and wait times, synchronizing with the backend.
- **Incident Simulation & AI Action Planner**: Triggers emergency alerts (medical, crowd bottlenecks, scanner failures). When selected, the backend uses Gemini to assess the situation and match standby volunteers based on location and specialty.
- **Volunteer Live Dispatch**: Dispatched volunteers update their status to `ON MISSION` and resolve the incident automatically after 6 seconds.

---

## 4. Assumptions Made

1. **Secure Context (HTTPS)**: It is assumed that the client accesses the site in a secure context (`localhost` during development or `HTTPS` in production). Modern browser policies block the Web Speech microphone APIs in insecure `http://` remote contexts.
2. **Cluster Configuration**: In clustered container environments, it is assumed that `REDIS_URL` is set in the environment to synchronize rate-limits. If unset, the server defaults to the local memory store.
3. **Deployment Proxies**: The server expects proxy configurations to pass IP parameters correctly. The `TRUST_PROXY=1` setting is enabled by default to allow correct client address mapping.
4. **GenAI Key Availability**: If no `GEMINI_API_KEY` is set, the application continues to run in fallback mode with no user experience degradation.

---

## 5. Development & Testing

### Running Locally
1. Install dependencies:
   ```bash
   cd backend
   npm.cmd install
   ```
2. Configure `.env`:
   - Copy `.env.example` to `.env`.
   - Update `GEMINI_API_KEY` (optional) and settings.
3. Run dev server:
   ```bash
   node server.js
   ```
4. Access the web app at `http://localhost:8080`.

### Running Integration Tests
The test suite validates 39 assertions across 12 test suites:
```bash
npm.cmd test
```

**Test Coverage Areas:**
| Suite | Tests | Coverage |
|-------|-------|----------|
| Authentication Flow | 2 | Login success/failure, JWT issuance |
| Telemetry Endpoints | 2 | Auth guard, data retrieval |
| Telemetry Input Validation | 3 | Numeric type guards, negative value rejection |
| Incidents CRUD | 3 | List, create, resolve |
| Incident Edge Cases | 2 | Missing fields, non-existent ID |
| Volunteers CRUD | 2 | Roster list, status update |
| Volunteer Status Enum | 2 | Invalid enum rejection, valid acceptance |
| GenAI Chat | 1 | Fallback response with highlight keys |
| GenAI Incident Analyzer | 1 | Assessment and volunteer specialty match |
| Security Headers | 2 | CSP, XSS, HSTS, Referrer-Policy, Permissions-Policy |
| XSS Sanitization | 1 | HTML entity escaping on user input |
| RBAC Dispatch | 5 | Missing params, non-existent vol, role forbidden, admin success |

