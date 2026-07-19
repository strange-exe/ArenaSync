/* ==========================================================================
   ARENASYNC AI - DYNAMIC ENGINE & APPLICATION LOGIC
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    // --- State Management ---
    const state = {
        currentView: "fan", // 'fan' or 'ops'
        selectedStadium: "metlife",
        accessibilityFilter: false,
        densityLayer: true,
        selectedMapElement: null,
        routeStartKey: null,
        chatHistory: [],
        incidents: [
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
        ],
        activeIncidentId: null,
        volunteers: [
            { id: "vol-1", name: "Mateo Ramos", initials: "MR", languages: "ES, EN", specialty: "Crowd Control", status: "standby", location: "Gate A" },
            { id: "vol-2", name: "Chloe Dubois", initials: "CD", languages: "FR, EN", specialty: "First Aid", status: "standby", location: "Gate D" },
            { id: "vol-3", name: "Aoki Kenji", initials: "AK", languages: "JP, EN", specialty: "Guest Relations", status: "standby", location: "Gate A" },
            { id: "vol-4", name: "Sarah Jenkins", initials: "SJ", languages: "EN", specialty: "Technical Staff", status: "standby", location: "Gate B" },
            { id: "vol-5", name: "Lars Lindstrom", initials: "LL", languages: "DE, EN", specialty: "Crowd Control", status: "busy", location: "Section 112" }
        ],
        speechSynthesisActive: true,
        isListening: false
    };

    // --- Coordinates Mapping (SVG Coordinates 800x600) ---
    const coordinates = {
        "gate-a": { x: 120, y: 100, label: "Gate A" },
        "gate-b": { x: 680, y: 100, label: "Gate B" },
        "gate-c": { x: 680, y: 500, label: "Gate C" },
        "gate-d": { x: 120, y: 500, label: "Gate D" },
        "sector-north": { x: 400, y: 160, label: "North Stand" },
        "sector-east": { x: 590, y: 300, label: "East Stand" },
        "sector-south": { x: 400, y: 440, label: "South Stand" },
        "sector-west": { x: 210, y: 300, label: "West Stand" },
        "facility-wc-ne": { x: 580, y: 120, label: "Restroom NE" },
        "facility-wc-sw": { x: 220, y: 480, label: "Restroom SW" },
        "facility-food-east": { x: 650, y: 300, label: "Grill & Tacos (East)" },
        "facility-food-west": { x: 150, y: 300, label: "Hotdogs & Brew (West)" },
        "facility-el-nw": { x: 210, y: 130, label: "Elevator NW" },
        "facility-med-se": { x: 590, y: 470, label: "First Aid SE" }
    };

    // --- DOM Elements Cache ---
    const dom = {
        toggleFan: document.getElementById("toggle-fan"),
        toggleOps: document.getElementById("toggle-ops"),
        viewFan: document.getElementById("view-fan"),
        viewOps: document.getElementById("view-ops"),
        stadiumSelect: document.getElementById("stadium-select"),
        chatFeed: document.getElementById("chat-feed"),
        chatInput: document.getElementById("chat-input"),
        sendBtn: document.getElementById("send-btn"),
        voiceBtn: document.getElementById("voice-btn"),
        assistantLang: document.getElementById("assistant-lang"),
        quickChips: document.querySelectorAll(".chip-btn"),
        
        stadiumCanvas: document.getElementById("stadium-3d-canvas"),
        svgZoomContainer: document.getElementById("svg-zoom-pan-container"),
        accessibilityFilter: document.getElementById("accessibility-filter"),
        crowdDensityLayer: document.getElementById("crowd-density-layer"),
        
        mapTooltip: document.getElementById("map-tooltip"),
        tooltipTitle: document.getElementById("tooltip-title"),
        tooltipWait: document.getElementById("tooltip-wait"),
        tooltipStatus: document.getElementById("tooltip-status"),
        tooltipExtraRow: document.getElementById("tooltip-extra-row"),
        tooltipExtraLabel: document.getElementById("tooltip-extra-label"),
        tooltipExtraValue: document.getElementById("tooltip-extra-value"),
        tooltipBtnRoute: document.getElementById("tooltip-btn-route"),
        
        ecoTransport: document.getElementById("eco-transport"),
        ecoFood: document.getElementById("eco-food"),
        ecoRecycling: document.getElementById("eco-recycling"),
        calculateEcoBtn: document.getElementById("calculate-eco"),
        ecoResult: document.getElementById("eco-result"),
        ecoValue: document.getElementById("eco-value"),
        ecoProgress: document.getElementById("eco-progress"),
        ecoBadgeName: document.getElementById("eco-badge-name"),
        ecoTip: document.getElementById("eco-tip"),
        
        telemetryInflow: document.getElementById("telemetry-inflow"),
        telemetryWait: document.getElementById("telemetry-wait"),
        telemetryVolunteers: document.getElementById("telemetry-volunteers"),
        telemetryCo2: document.getElementById("telemetry-co2"),
        dynamicBar: document.getElementById("dynamic-bar"),
        incidentsList: document.getElementById("incidents-list"),
        incidentCount: document.getElementById("incident-count"),
        aiRecommender: document.getElementById("ai-recommender"),
        aiRecommenderBody: document.getElementById("ai-recommender-body"),
        volunteersList: document.getElementById("volunteers-list"),
        volunteersAvail: document.getElementById("volunteers-avail"),
        volunteersBusy: document.getElementById("volunteers-busy"),
        
        triggerIncidentBtn: document.getElementById("trigger-incident-btn"),
        incType: document.getElementById("inc-type"),
        incLocation: document.getElementById("inc-location"),
        incSeverity: document.getElementById("inc-severity"),
        toastContainer: document.getElementById("toast-container")
    };

    // --- ZOOM & PAN VARIABLES ---
    let zoomLevel = 1.0;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    // --- THREE.JS GLOBALS ---
    let scene, camera, renderer, controls, raycaster;
    let stadiumMeshes = {};
    let coordinates3D = {};
    let wayfinding3DLine = null;
    let cameraLerpTarget = new THREE.Vector3(0, 0, 0);
    let lastInteractionTime = Date.now();
    let resizeTimeout;

    // --- API CLIENT CONFIGURATION & HELPERS ---
    // Dynamically resolves relative to the current window host origin.
    // This supports local development (localhost) and production (Render/Netlify) without hardcoding credentials.
    const API_BASE = `${window.location.origin}/api`;

    let authToken = sessionStorage.getItem("arena_auth_token") || null;
    let backendActive = false;

    async function checkBackendAndLogin() {
        try {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'organizer@arenasync.com',
                    password: 'SecretWord2026!'
                })
            });

            if (response.ok) {
                const data = await response.json();
                authToken = data.accessToken;
                sessionStorage.setItem("arena_auth_token", authToken);
                backendActive = true;
                console.log("[API] Connected to backend service. JWT token acquired successfully.");
                await syncStateWithBackend();
            } else {
                console.warn("[API] Backend active but login failed. Using local fallback.");
            }
        } catch (err) {
            console.log("[API] Backend offline. Using local fallback mode.");
        }
    }

    async function syncStateWithBackend() {
        if (!authToken) return;
        try {
            const incRes = await fetch(`${API_BASE}/incidents`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (incRes.ok) {
                state.incidents = await incRes.json();
            }

            const volRes = await fetch(`${API_BASE}/volunteers`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (volRes.ok) {
                state.volunteers = await volRes.json();
            }

            renderIncidentsList();
            renderVolunteerRoster();
        } catch (err) {
            console.error("[API] Sync error:", err);
        }
    }

    async function updateBackendTelemetry(inflowRate, avgWaitMinutes, co2SavedKg) {
        if (!authToken) return;
        try {
            await fetch(`${API_BASE}/telemetry`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ inflowRate, avgWaitMinutes, co2SavedKg })
            });
        } catch (err) {
            // silent fallback
        }
    }

    async function fetchTelemetryAndIncidents() {
        if (!authToken) return;
        try {
            const telRes = await fetch(`${API_BASE}/telemetry`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (telRes.ok) {
                const data = await telRes.json();
                dom.telemetryVolunteers.innerText = data.activeVolunteers;
                dom.telemetryCo2.innerText = data.co2SavedKg.toLocaleString();
            }

            const incRes = await fetch(`${API_BASE}/incidents`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (incRes.ok) {
                const data = await incRes.json();
                if (JSON.stringify(state.incidents) !== JSON.stringify(data)) {
                    state.incidents = data;
                    renderIncidentsList();
                    renderOperationsConsole();
                }
            }

            const volRes = await fetch(`${API_BASE}/volunteers`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (volRes.ok) {
                const data = await volRes.json();
                if (JSON.stringify(state.volunteers) !== JSON.stringify(data)) {
                    state.volunteers = data;
                    renderVolunteerRoster();
                    renderOperationsConsole();
                }
            }
        } catch (err) {
            // silent
        }
    }

    // --- INIT APP ---
    // Verify production deployment is over HTTPS (needed for Web Speech APIs)
    if (window.location.protocol !== 'https:' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
        setTimeout(() => {
            showToast("Insecure Context", "Voice recognition requires a secure HTTPS connection in production.", "warning");
        }, 1000);
    }

    initMapInteractions();
    initChatCompanion();
    initSustainabilityCalculator();
    initOperationsConsole();
    
    // Connect to backend and start loop
    checkBackendAndLogin().then(() => {
        startSimulationLoop();
    });

    // Parse all Lucide icons on start
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // --- VIEW TOGGLES ---
    dom.toggleFan.addEventListener("click", () => switchView("fan"));
    dom.toggleOps.addEventListener("click", () => switchView("ops"));

    function switchView(view) {
        state.currentView = view;
        if (view === "fan") {
            dom.toggleFan.classList.add("active");
            dom.toggleFan.setAttribute("aria-selected", "true");
            dom.toggleOps.classList.remove("active");
            dom.toggleOps.setAttribute("aria-selected", "false");
            dom.viewFan.classList.add("active-view");
            dom.viewOps.classList.remove("active-view");
            showToast("View Switched", "Entered Fan Experience Matchday Hub.", "success");
        } else {
            dom.toggleFan.classList.remove("active");
            dom.toggleFan.setAttribute("aria-selected", "false");
            dom.toggleOps.classList.add("active");
            dom.toggleOps.setAttribute("aria-selected", "true");
            dom.viewFan.classList.remove("active-view");
            dom.viewOps.classList.add("active-view");
            showToast("View Switched", "Entered Stadium Command & Control Room.", "warning");
            renderOperationsConsole();
        }
        hideTooltip();
    }

    // --- STADIUM CHANGE ---
    dom.stadiumSelect.addEventListener("change", (e) => {
        state.selectedStadium = e.target.value;
        const name = dom.stadiumSelect.options[dom.stadiumSelect.selectedIndex].text;
        showToast("Stadium Switched", `Loaded live operations for ${name}.`, "success");
        clearActiveRoute();
        hideTooltip();
        updateSectorDensityColors();
    });


    // ==========================================================================
    // STADIUM INTERACTIVE SVG MAP ENGINE
    // ==========================================================================

    // ==========================================================================
    // STADIUM INTERACTIVE 3D MAP ENGINE (THREE.JS)
    // ==========================================================================



    function initMapInteractions() {
        const canvasContainer = dom.stadiumCanvas;

        // Initialize 3D positions by scaling SVG coordinates
        for (const key in coordinates) {
            const c = coordinates[key];
            // Scale center x (400) to 0, and y (300) to 0
            const x = (c.x - 400) / 25;
            const z = (c.y - 300) / 25;
            // Height offset
            let y = 0;
            if (key.startsWith("sector-")) {
                y = 0.5; // stands are higher
            } else if (key.startsWith("gate-")) {
                y = 0.1;
            } else {
                y = 0.2; // facilities float slightly
            }
            coordinates3D[key] = new THREE.Vector3(x, y, -z); // invert z for standard WebGL orientation
        }

        // Setup Three.js Scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x08080a); // Match Slash Obsidian background

        // Camera
        camera = new THREE.PerspectiveCamera(40, canvasContainer.clientWidth / canvasContainer.clientHeight, 0.1, 1000);
        camera.position.set(0, 15, 15);

        // Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Remove any existing canvases
        canvasContainer.innerHTML = "";
        canvasContainer.appendChild(renderer.domElement);

        // OrbitControls
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.maxPolarAngle = Math.PI / 2.05; // don't go below ground level
        controls.minDistance = 5;
        controls.maxDistance = 45;

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        dirLight.shadow.bias = -0.001;
        scene.add(dirLight);

        // Add soft copper glow pointlight in the pitch center
        const pitchLight = new THREE.PointLight(0xcc9166, 1.2, 20);
        pitchLight.position.set(0, 1, 0);
        scene.add(pitchLight);

        // Add cyber turf grid helper (gilded gold & graphite stadium lines)
        const gridHelper = new THREE.GridHelper(30, 30, 0xcc9166, 0x1c1d22);
        gridHelper.position.y = -0.05;
        gridHelper.material.opacity = 0.15;
        gridHelper.material.transparent = true;
        scene.add(gridHelper);

        // Setup Raycaster
        raycaster = new THREE.Raycaster();

        // Build Stadium meshes
        buildStadium3DModel();

        // Create overlay markers
        createHTMLMarkers();

        // Update color stands based on initial congestion
        updateSectorDensityColors();

        // Track controls activity to delay idle rotation
        controls.addEventListener('start', () => { lastInteractionTime = Date.now(); });
        controls.addEventListener('change', () => { lastInteractionTime = Date.now(); });

        // Window resize
        window.addEventListener("resize", onWindowResize);

        // Click outside on canvas
        renderer.domElement.addEventListener("click", onCanvasClick);

        // Zoom Buttons Hookup
        document.getElementById("zoom-in").addEventListener("click", () => {
            camera.position.multiplyScalar(0.85);
            controls.update();
        });
        document.getElementById("zoom-out").addEventListener("click", () => {
            camera.position.multiplyScalar(1.15);
            controls.update();
        });
        document.getElementById("zoom-reset").addEventListener("click", () => {
            camera.position.set(0, 15, 15);
            controls.target.set(0, 0, 0);
            cameraLerpTarget.set(0, 0, 0);
            controls.update();
            hideTooltip();
            clearMapHighlights();
        });

        // Accessibility filter change
        dom.accessibilityFilter.addEventListener("change", (e) => {
            state.accessibilityFilter = e.target.checked;
            toggleAccessibilityHighlighting(state.accessibilityFilter);
        });

        // Crowd density layer change
        dom.crowdDensityLayer.addEventListener("change", (e) => {
            state.densityLayer = e.target.checked;
            updateSectorDensityColors();
        });

        // Tooltip Route Button click
        dom.tooltipBtnRoute.addEventListener("click", () => {
            if (state.selectedMapElement) {
                const targetKey = state.selectedMapElement.id;
                const gates = ["gate-a", "gate-b", "gate-c", "gate-d"];
                const startKey = state.routeStartKey || gates[Math.floor(Math.random() * gates.length)];
                
                state.routeStartKey = startKey;
                drawWayfindingPath(startKey, targetKey);
                hideTooltip();

                const fromLabel = coordinates[startKey].label;
                const toLabel = coordinates[targetKey].label;
                addBotMessage(`🗺️ **AI Nav Route Activated:** Calculated optimal 3D path from **${fromLabel}** to **${toLabel}**. Concourse loop clear. Highlighted in glowing gold neon.`);
            }
        });

        // Start animation loop
        animate();
    }

    function buildStadium3DModel() {
        // 1. Center Field Pitch
        const pitchGeom = new THREE.PlaneGeometry(12, 8);
        const pitchMat = new THREE.MeshStandardMaterial({
            color: 0x064e3b, // Emerald Turf green
            roughness: 0.9,
            metalness: 0.1,
            emissive: 0x064e3b,
            emissiveIntensity: 0.15
        });
        const pitch = new THREE.Mesh(pitchGeom, pitchMat);
        pitch.rotation.x = -Math.PI / 2;
        pitch.receiveShadow = true;
        scene.add(pitch);

        // Pitch white markings
        const linesGroup = new THREE.Group();
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
        
        // Outlines
        const boundaryGeom = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-6, 0.01, -4),
            new THREE.Vector3(6, 0.01, -4),
            new THREE.Vector3(6, 0.01, 4),
            new THREE.Vector3(-6, 0.01, 4),
            new THREE.Vector3(-6, 0.01, -4)
        ]);
        const boundary = new THREE.Line(boundaryGeom, lineMat);
        linesGroup.add(boundary);

        // Center line
        const midLineGeom = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0.01, -4),
            new THREE.Vector3(0, 0.01, 4)
        ]);
        const midLine = new THREE.Line(midLineGeom, lineMat);
        linesGroup.add(midLine);

        // Center Circle
        const circlePoints = [];
        for (let i = 0; i <= 32; i++) {
            const theta = (i / 32) * Math.PI * 2;
            circlePoints.push(new THREE.Vector3(Math.cos(theta) * 1.5, 0.01, Math.sin(theta) * 1.5));
        }
        const circleGeom = new THREE.BufferGeometry().setFromPoints(circlePoints);
        const circle = new THREE.Line(circleGeom, lineMat);
        linesGroup.add(circle);

        scene.add(linesGroup);

        // 2. Seating Stands (4 sectors)
        const sectors = {
            "sector-north": { size: [16, 2, 2.5], pos: [0, 1, -6] },
            "sector-south": { size: [16, 2, 2.5], pos: [0, 1, 6] },
            "sector-east": { size: [2.5, 2, 10], pos: [9.5, 1, 0] },
            "sector-west": { size: [2.5, 2, 10], pos: [-9.5, 1, 0] }
        };

        for (const id in sectors) {
            const sec = sectors[id];
            const geom = new THREE.BoxGeometry(...sec.size);
            
            // Slope/step representation using two layers (tier 1 and tier 2)
            const group = new THREE.Group();
            
            // Lower tier
            const tier1Mat = new THREE.MeshStandardMaterial({
                color: 0x1c1d22, // Slash Graphite
                roughness: 0.6,
                metalness: 0.1
            });
            const tier1 = new THREE.Mesh(geom, tier1Mat);
            tier1.castShadow = true;
            tier1.receiveShadow = true;
            group.add(tier1);
            
            // Upper tier (smaller, offset higher and backward)
            const tier2Geom = new THREE.BoxGeometry(
                sec.size[0] * 0.95,
                sec.size[1] * 0.8,
                sec.size[2] * 0.7
            );
            const tier2Mat = new THREE.MeshStandardMaterial({
                color: 0x121317, // Slash Carbon
                roughness: 0.6,
                metalness: 0.1
            });
            const tier2 = new THREE.Mesh(tier2Geom, tier2Mat);
            tier2.position.y = sec.size[1] * 0.7;
            // offset backward based on orientation
            if (id === "sector-north") tier2.position.z = -0.5;
            else if (id === "sector-south") tier2.position.z = 0.5;
            else if (id === "sector-east") tier2.position.x = 0.5;
            else if (id === "sector-west") tier2.position.x = -0.5;
            
            tier2.castShadow = true;
            group.add(tier2);

            group.position.set(...sec.pos);
            scene.add(group);
            
            // Reference the main tier mesh for highlights
            stadiumMeshes[id] = tier1;
            tier1.name = id;
            tier1.userData = { key: id };
        }
    }

    function createHTMLMarkers() {
        const container = dom.svgZoomContainer;
        // Clean existing markers
        const existing = container.querySelectorAll(".map-marker");
        existing.forEach(e => e.remove());

        for (const key in coordinates) {
            const coord = coordinates[key];
            const marker = document.createElement("div");
            marker.id = `marker-${key}`;
            marker.className = "map-marker";

            if (key.startsWith("sector-")) {
                marker.classList.add("stand-marker");
                marker.innerText = key === "sector-north" ? "North Stand" : key === "sector-south" ? "South Stand" : key === "sector-east" ? "East Stand" : "West Stand";
            } else if (key.startsWith("gate-")) {
                marker.classList.add("gate-marker");
                marker.innerText = key.replace("gate-", "").toUpperCase();
            } else {
                marker.classList.add("facility-marker");
                let iconName = "info";
                if (key.includes("wc")) {
                    marker.classList.add("wc-facility");
                    iconName = "accessibility";
                } else if (key.includes("food")) {
                    marker.classList.add("food-facility");
                    iconName = "utensils";
                } else if (key.includes("el")) {
                    marker.classList.add("elevator-facility");
                    iconName = "arrow-up-down";
                } else if (key.includes("med")) {
                    marker.classList.add("firstaid-facility");
                    iconName = "heart";
                }
                marker.innerHTML = `<i data-lucide="${iconName}"></i>`;
            }

            // Click Handler
            marker.addEventListener("click", (e) => {
                e.stopPropagation();
                selectElementByKey(key);
            });

            container.appendChild(marker);
        }

        // Parse icons for newly added HTML overlays
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    const tempV = new THREE.Vector3();
    function updateHTMLMarkers() {
        if (!camera || !renderer) return;
        const widthHalf = renderer.domElement.clientWidth / 2;
        const heightHalf = renderer.domElement.clientHeight / 2;

        for (const key in coordinates3D) {
            const pos3D = coordinates3D[key].clone();
            
            // Adjust position height offsets slightly for better visual alignment above meshes
            if (key.startsWith("sector-")) pos3D.y += 0.8;
            else if (key.startsWith("gate-")) pos3D.y += 0.5;
            else pos3D.y += 0.4;

            pos3D.project(camera);

            const marker = document.getElementById(`marker-${key}`);
            if (!marker) continue;

            // Check behind camera clipping
            if (pos3D.z > 1) {
                marker.style.display = "none";
                continue;
            }

            // Normalize coordinate mapping
            const x = (pos3D.x * widthHalf) + widthHalf;
            const y = -(pos3D.y * heightHalf) + heightHalf;

            marker.style.display = "flex";
            marker.style.left = `${x}px`;
            marker.style.top = `${y}px`;
        }
    }

    function selectElementByKey(key) {
        clearMapHighlights();

        const mesh = stadiumMeshes[key];
        if (mesh) {
            state.selectedMapElement = {
                id: key,
                classList: { contains: (cls) => cls === "seat-sector" }
            };
            mesh.material.emissive.setHex(0xffffff);
            mesh.material.emissiveIntensity = 0.6;
        } else {
            // Virtual wrapper for facilities & gates
            state.selectedMapElement = {
                id: key,
                classList: {
                    contains: (cls) => {
                        if (key.startsWith("gate-")) return cls === "map-gate";
                        if (key.includes("wc")) return cls === "restroom-facility";
                        if (key.includes("food")) return cls === "food-facility";
                        if (key.includes("el")) return cls === "elevator-facility";
                        if (key.includes("med")) return cls === "firstaid-facility";
                        return false;
                    }
                }
            };
        }

        // Pan camera smoothly to coordinates
        const target = coordinates3D[key];
        if (target) {
            // Animate target focus
            gsapCameraTo(target.x, target.z);
        }

        showTooltipForElement(key);
    }

    function gsapCameraTo(x, z) {
        // Sets target lerp coordinates for camera orbit target
        cameraLerpTarget.set(x, 0, z);
    }

    function clearMapHighlights() {
        for (const id in stadiumMeshes) {
            const mesh = stadiumMeshes[id];
            if (mesh) {
                mesh.material.emissiveIntensity = state.densityLayer ? 0.35 : 0.05;
            }
        }
        state.selectedMapElement = null;
        updateSectorDensityColors();
    }

    function updateSectorDensityColors() {
        const sectors = {
            "sector-north": { color: 0x10b981 }, // low
            "sector-east": { color: 0xf59e0b }, // medium
            "sector-south": { color: 0xef4444 }, // high
            "sector-west": { color: 0xf59e0b }  // medium
        };

        if (state.selectedStadium === "sofi") {
            sectors["sector-north"].color = 0xf59e0b;
            sectors["sector-south"].color = 0x10b981;
            sectors["sector-east"].color = 0xef4444;
            sectors["sector-west"].color = 0x10b981;
        } else if (state.selectedStadium === "azteca") {
            sectors["sector-north"].color = 0xef4444;
            sectors["sector-south"].color = 0xf59e0b;
            sectors["sector-east"].color = 0xf59e0b;
            sectors["sector-west"].color = 0xef4444;
        }

        for (const id in sectors) {
            const mesh = stadiumMeshes[id];
            if (!mesh) continue;

            if (state.densityLayer) {
                mesh.material.color.setHex(sectors[id].color);
                mesh.material.emissive.setHex(sectors[id].color);
                mesh.material.emissiveIntensity = 0.35;
            } else {
                mesh.material.color.setHex(0x1e293b);
                mesh.material.emissive.setHex(0x1e293b);
                mesh.material.emissiveIntensity = 0.05;
            }
        }
    }

    function toggleAccessibilityHighlighting(active) {
        if (active) {
            showToast("Accessibility Filter", "Highlighting step-free elevators and accessible restrooms in neon green.", "info");
        }
        
        for (const key in coordinates) {
            const marker = document.getElementById(`marker-${key}`);
            if (!marker) continue;

            if (active) {
                const isAccessible = key === "facility-wc-ne" || key === "facility-el-nw" || key === "facility-med-se" || key.startsWith("gate-");
                if (isAccessible) {
                    marker.style.filter = "drop-shadow(0 0 10px #10b981)";
                    marker.style.opacity = "1";
                } else {
                    marker.style.opacity = "0.2";
                }
            } else {
                marker.style.filter = "";
                marker.style.opacity = "1";
            }
        }
    }

    function onCanvasClick(e) {
        const rect = renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
        );

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(Object.values(stadiumMeshes));

        if (intersects.length > 0) {
            const key = intersects[0].object.name;
            selectElementByKey(key);
        } else {
            if (e.target === renderer.domElement) {
                hideTooltip();
                clearMapHighlights();
            }
        }
    }

    function onWindowResize() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const canvasContainer = dom.stadiumCanvas;
            if (!canvasContainer || !camera || !renderer) return;

            camera.aspect = canvasContainer.clientWidth / canvasContainer.clientHeight;
            camera.updateProjectionMatrix();

            renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
        }, 150);
    }

    function drawWayfindingPath(startKey, endKey) {
        const start3D = coordinates3D[startKey];
        const end3D = coordinates3D[endKey];
        if (!start3D || !end3D) return;

        clearActiveRoute();

        // Waypoints loop around concourse
        const waypoints = [];
        waypoints.push(new THREE.Vector3(start3D.x, 0.15, start3D.z));

        // Center loop ellipse radii
        const cx = 0, cz = 0;
        const rx = 10, rz = 6.5;

        const startAngle = Math.atan2(start3D.z - cz, start3D.x - cx);
        const endAngle = Math.atan2(end3D.z - cz, end3D.x - cx);

        waypoints.push(new THREE.Vector3(cx + rx * Math.cos(startAngle), 0.15, cz + rz * Math.sin(startAngle)));

        let diff = endAngle - startAngle;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        while (diff > Math.PI) diff -= 2 * Math.PI;

        const steps = 12;
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const angle = startAngle + t * diff;
            waypoints.push(new THREE.Vector3(cx + rx * Math.cos(angle), 0.15, cz + rz * Math.sin(angle)));
        }

        waypoints.push(new THREE.Vector3(cx + rx * Math.cos(endAngle), 0.15, cz + rz * Math.sin(endAngle)));
        waypoints.push(new THREE.Vector3(end3D.x, 0.15, end3D.z));

        const curve = new THREE.CatmullRomCurve3(waypoints);
        
        // Render glowing tube for 3D neon pipeway
        const tubeGeom = new THREE.TubeGeometry(curve, 64, 0.12, 8, false);
        const tubeMat = new THREE.MeshBasicMaterial({
            color: 0xae9357, // Slash Gilded Gold
            transparent: true,
            opacity: 0.8
        });

        wayfinding3DLine = new THREE.Mesh(tubeGeom, tubeMat);
        scene.add(wayfinding3DLine);

        // Highlight start/end points with glowing rings
        const ringGeom = new THREE.RingGeometry(0.18, 0.3, 16);
        
        const startRingMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }); // Slash Paper White
        const startRing = new THREE.Mesh(ringGeom, startRingMat);
        startRing.position.copy(start3D).y += 0.05;
        startRing.rotation.x = Math.PI / 2;
        wayfinding3DLine.add(startRing);

        const endRingMat = new THREE.MeshBasicMaterial({ color: 0xcc9166, side: THREE.DoubleSide }); // Slash Copper
        const endRing = new THREE.Mesh(ringGeom, endRingMat);
        endRing.position.copy(end3D).y += 0.05;
        endRing.rotation.x = Math.PI / 2;
        wayfinding3DLine.add(endRing);

        state.routeStartKey = startKey;
    }

    function clearActiveRoute() {
        if (wayfinding3DLine) {
            scene.remove(wayfinding3DLine);
            wayfinding3DLine = null;
        }
        state.routeStartKey = null;
    }

    function showTooltipForElement(key) {
        const coord = coordinates[key];
        if (!coord) return;

        let title = coord.label;
        let wait = "N/A";
        let status = "Operational";
        let extraLabel = "Features";
        let extraVal = "Standard Access";

        if (key.startsWith("sector-")) {
            title = key === "sector-north" ? "North Stand (Sec 100-112)" : key === "sector-south" ? "South Stand (Sec 126-138)" : key === "sector-east" ? "East Stand (Sec 113-125)" : "West Stand (Sec 139-150)";
            wait = key === "sector-north" ? "3 mins" : key === "sector-south" ? "24 mins" : "12 mins";
            const density = key === "sector-north" ? "low" : key === "sector-south" ? "high" : "medium";
            status = density === "high" ? "Highly Congested" : density === "medium" ? "Moderate Crowd" : "Low Density";
            extraLabel = "Access Gates";
            extraVal = key === "sector-north" ? "Gate A, B" : key === "sector-south" ? "Gate C, D" : "Gate B, C";
        } else if (key.startsWith("gate-")) {
            const letter = key.replace("gate-", "").toUpperCase();
            title = `Gate ${letter}`;
            wait = key === "gate-a" ? "4 mins" : key === "gate-b" ? "15 mins" : key === "gate-c" ? "28 mins" : "2 mins";
            status = key === "gate-a" ? "Normal" : key === "gate-b" ? "Busy" : key === "gate-c" ? "Congested" : "Normal";
            extraLabel = "Main Access to";
            extraVal = key === "gate-a" ? "North/West Stands" : "East/South Stands";
        } else if (key.includes("wc")) {
            title = key === "facility-wc-ne" ? "Restroom NE" : "Restroom SW";
            wait = key === "facility-wc-ne" ? "5 mins" : "15 mins";
            status = "Open";
            extraLabel = "Accessibility";
            extraVal = key === "facility-wc-ne" ? "♿ Wheelchair Stall, Step-Free" : "Standard Restroom";
        } else if (key.includes("food")) {
            title = key === "facility-food-east" ? "Stadium Grill & Tacos" : "Arena Hotdogs & Brew";
            wait = key === "facility-food-east" ? "20 mins" : "6 mins";
            status = "Serving";
            extraLabel = "Dietary";
            extraVal = key === "facility-food-east" ? "🌱 Vegan & Gluten Free Options" : "Standard Concessions";
        } else if (key.includes("el-nw")) {
            title = "Elevator NW";
            wait = "0 mins";
            status = "Operational";
            extraLabel = "Access";
            extraVal = "♿ Step-Free Lift, Section 110-120";
        } else if (key.includes("med-se")) {
            title = "First Aid & Sensory Room";
            wait = "Immediate";
            status = "Staffed";
            extraLabel = "Sensory Friendly";
            extraVal = "Quiet room, emergency medical staff";
        }

        dom.tooltipTitle.innerText = title;
        dom.tooltipWait.innerText = wait;
        dom.tooltipStatus.innerText = status;
        dom.tooltipExtraLabel.innerText = extraLabel;
        dom.tooltipExtraValue.innerText = extraVal;

        const marker = document.getElementById(`marker-${key}`);
        if (marker) {
            const markerLeft = parseFloat(marker.style.left);
            const markerTop = parseFloat(marker.style.top);
            
            dom.mapTooltip.style.left = `${markerLeft}px`;
            dom.mapTooltip.style.top = `${markerTop}px`;
            dom.mapTooltip.classList.remove("hidden");
        }
    }

    function hideTooltip() {
        dom.mapTooltip.classList.add("hidden");
    }

    function animate() {
        requestAnimationFrame(animate);

        // Smooth camera LERP transition
        controls.target.lerp(cameraLerpTarget, 0.08);

        // Smooth idle orbit rotation if inactive and nothing is selected
        if (Date.now() - lastInteractionTime > 6000 && !state.selectedMapElement) {
            const time = Date.now() * 0.00015;
            camera.position.x = Math.cos(time) * 16;
            camera.position.z = Math.sin(time) * 16;
            camera.position.y = 12 + Math.sin(time * 0.5) * 2;
        }

        controls.update();

        // Animate glowing neon line
        if (wayfinding3DLine) {
            wayfinding3DLine.material.opacity = 0.6 + Math.sin(Date.now() * 0.006) * 0.25;
        }

        renderer.render(scene, camera);
        updateHTMLMarkers();
    }


    // ==========================================================================
    // MULTILINGUAL GenAI COMPANION ENGINE
    // ==========================================================================

    function initChatCompanion() {
        dom.sendBtn.addEventListener("click", handleUserMessageSubmit);
        dom.chatInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") handleUserMessageSubmit();
        });

        dom.quickChips.forEach(chip => {
            chip.addEventListener("click", () => {
                const query = chip.dataset.query;
                dom.chatInput.value = query;
                handleUserMessageSubmit();
            });
        });

        // Speech-to-Text Voice Button Setup
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;

            recognition.onstart = () => {
                state.isListening = true;
                dom.voiceBtn.setAttribute("class", "icon-btn voice-active");
                showToast("Voice Listening", "Speak your stadium question now...", "info");
            };

            recognition.onerror = (e) => {
                console.error("Speech recognition error:", e);
                state.isListening = false;
                dom.voiceBtn.setAttribute("class", "icon-btn voice-inactive");
                showToast("Voice Error", "Failed to capture speech. Please try again.", "error");
            };

            recognition.onend = () => {
                state.isListening = false;
                dom.voiceBtn.setAttribute("class", "icon-btn voice-inactive");
            };

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                dom.chatInput.value = transcript;
                handleUserMessageSubmit();
            };

            dom.voiceBtn.addEventListener("click", () => {
                if (state.isListening) {
                    recognition.stop();
                } else {
                    recognition.lang = state.assistantLang.value === "es" ? "es-MX" : state.assistantLang.value === "fr" ? "fr-FR" : "en-US";
                    recognition.start();
                }
            });
        } else {
            dom.voiceBtn.addEventListener("click", () => {
                showToast("Not Supported", "Speech recognition is not supported in this browser.", "error");
            });
        }
    }

    function handleUserMessageSubmit() {
        const text = dom.chatInput.value.trim();
        if (!text) return;

        addUserMessage(text);
        dom.chatInput.value = "";

        // Trigger AI Response
        generateBotResponse(text);
    }

    function addUserMessage(message) {
        const msgDiv = document.createElement("div");
        msgDiv.className = "chat-message user";
        msgDiv.innerHTML = `
            <div class="message-bubble">
                <p>${escapeHTML(message)}</p>
            </div>
            <span class="message-meta">You • Just now</span>
        `;
        dom.chatFeed.appendChild(msgDiv);
        scrollToBottom();
    }

    function addBotMessage(markdownText) {
        const msgDiv = document.createElement("div");
        msgDiv.className = "chat-message bot";
        msgDiv.innerHTML = `
            <div class="message-bubble">
                ${parseMarkdown(markdownText)}
            </div>
            <span class="message-meta">ArenaAI • Just now</span>
        `;
        dom.chatFeed.appendChild(msgDiv);
        scrollToBottom();

        // Speak the text if Speech Synthesis is active
        if (state.speechSynthesisActive) {
            speakBotText(markdownText);
        }
    }

    function addBotStreamingPlaceholder() {
        const msgDiv = document.createElement("div");
        msgDiv.className = "chat-message bot streaming-placeholder";
        msgDiv.innerHTML = `
            <div class="message-bubble">
                <p class="typing-indicator-dots"><span></span><span></span><span></span></p>
            </div>
            <span class="message-meta">ArenaAI • Typing...</span>
        `;
        dom.chatFeed.appendChild(msgDiv);
        scrollToBottom();
        return msgDiv;
    }

    function scrollToBottom() {
        dom.chatFeed.scrollTop = dom.chatFeed.scrollHeight;
    }

    // --- GenAI Chat Companion API Connector ---
    async function generateBotResponse(query) {
        const placeholder = addBotStreamingPlaceholder();
        const lang = dom.assistantLang.value;
        const stadium = state.selectedStadium;
        const accessibility = state.accessibilityFilter;

        try {
            const response = await fetch(`${API_BASE}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, lang, stadium, accessibility })
            });

            placeholder.remove();

            if (response.ok) {
                const data = await response.json();
                addBotMessage(data.text);

                if (data.highlightElement) {
                    selectElementByKey(data.highlightElement);
                }
                if (data.drawRoute && data.drawRoute.start && data.drawRoute.end) {
                    drawWayfindingPath(data.drawRoute.start, data.drawRoute.end);
                }
            } else {
                throw new Error("Chat API failed with status " + response.status);
            }
        } catch (err) {
            console.warn("[API] Chat API failed. Falling back to local rules.", err);
            placeholder.remove();
            generateBotResponseLocalFallback(query);
        }
    }

    // Local Fallback Handler in case backend is offline
    function generateBotResponseLocalFallback(query) {
        const lang = dom.assistantLang.value;
        let responseText = "";
        let triggerMapAction = null;
        const q = query.toLowerCase();

        if (lang === "en") {
            if (q.includes("restroom") || q.includes("bathroom") || q.includes("toilet") || q.includes("wc")) {
                if (q.includes("accessible") || q.includes("wheelchair") || q.includes("disabled")) {
                    responseText = "♿ **Accessible restroom located!** The nearest step-free wheelchair-accessible restroom is **Restroom NE** (located in the North-East concourse corridor). It has wide automatic doors and braille signage. I have highlighted it on your map.";
                    triggerMapAction = () => {
                        selectElementByKey("facility-wc-ne");
                        state.routeStartKey = "gate-a";
                        drawWayfindingPath("gate-a", "facility-wc-ne");
                    };
                } else {
                    responseText = "🚻 **Restrooms mapped:** There are restrooms in both the North-East and South-West concourse. If you are near the West side, **Restroom SW** (wait time: 15 mins) is closest. I've highlighted it on your map.";
                    triggerMapAction = () => {
                        selectElementByKey("facility-wc-sw");
                        drawWayfindingPath("gate-d", "facility-wc-sw");
                    };
                }
            } 
            else if (q.includes("gate a") || (q.includes("gate") && q.includes("a"))) {
                responseText = "🚶 **Wayfinding route calculated:** To walk to **Gate A** (North-West Entrance, wait time: 4 mins) from the West seating bowl, exit through Concourse tunnel 8 and proceed left. Path drawn on map.";
                triggerMapAction = () => {
                    selectElementByKey("gate-a");
                    drawWayfindingPath("sector-west", "gate-a");
                };
            }
            else if (q.includes("vegan") || q.includes("vegetarian") || q.includes("salad") || q.includes("plant")) {
                responseText = "🌱 **Vegan Concession Found:** Head to **Stadium Grill & Tacos** in the East Concourse corridor. They serve plant-based tacos and vegan burgers (current wait: 20 mins). Route drawn on your map.";
                triggerMapAction = () => {
                    selectElementByKey("facility-food-east");
                    drawWayfindingPath("gate-b", "facility-food-east");
                };
            }
            else if (q.includes("ride") || q.includes("uber") || q.includes("lyft") || q.includes("taxi")) {
                responseText = "🚗 **Rideshare Transportation Hub:** The official FIFA World Cup Rideshare Lot is located outside **Gate D** (South-West). Rideshare app beacons are configured for zones D1 to D5. Follow the gold accessibility signs from Section 130.";
                triggerMapAction = () => {
                    selectElementByKey("gate-d");
                    drawWayfindingPath("sector-south", "gate-d");
                };
            }
            else if (q.includes("transit") || q.includes("shuttle") || q.includes("bus") || q.includes("train")) {
                responseText = "🚌 **Mass Transit Shuttles:** Rapid transit buses leave from the Transit Terminal located near **Gate A** (North-West) every 6 minutes to Metropark Train Station. Accessible low-floor shuttles are available.";
                triggerMapAction = () => {
                    selectElementByKey("gate-a");
                    drawWayfindingPath("sector-north", "gate-a");
                };
            }
            else if (q.includes("sustainability") || q.includes("eco") || q.includes("carbon") || q.includes("water")) {
                responseText = "💧 **Stadium Sustainability Operations:** MetLife Stadium implements a high-tech water recycling system that saves 40,000 gallons per match. All food packaging is 100% compostable. Complete your carbon calculator on the right panel to earn your **Eco Hero Badge**!";
            }
            else if (q.includes("wheelchair") || q.includes("elevator") || q.includes("ramp") || q.includes("accessibility")) {
                responseText = "♿ **Accessibility Guide Activated:** Accessible elevators are located at the North-West corridor (**Elevator NW**). Level concourses connect all sectors. We also have a Sensory Room near **First Aid SE** for neurodivergent fans. I have set the map to accessibility mode.";
                triggerMapAction = () => {
                    dom.accessibilityFilter.checked = true;
                    toggleAccessibilityHighlighting(true);
                    selectElementByKey("facility-el-nw");
                };
            }
            else {
                responseText = "🤖 **ArenaAI Assistant:** I processed your query: *'" + escapeHTML(query) + "'*. I recommend checking our interactive map to locate concession stands, access gates, and live queue wait times. You can also view wait times on the right widget.";
            }
        } 
        else if (lang === "es") {
            if (q.includes("baño") || q.includes("sanitario") || q.includes("wc") || q.includes("servicio")) {
                responseText = "♿ **¡Sanitario accesible localizado!** El sanitario sin escalones más cercano es **Restroom NE** (en el pasillo noreste). Cuenta con puertas automáticas anchas y señalización braille. Lo he resaltado en el mapa.";
                triggerMapAction = () => {
                    selectElementByKey("facility-wc-ne");
                    drawWayfindingPath("gate-b", "facility-wc-ne");
                };
            } else if (q.includes("puerta") || q.includes("entrada") || q.includes("acceso")) {
                responseText = "🚶 **Ruta calculada:** Para llegar a la **Puerta A** (Entrada Noroeste, espera: 4 min) desde la zona oeste, salga por el túnel 8 del pasillo. Ruta dibujada en el mapa.";
                triggerMapAction = () => {
                    selectElementByKey("gate-a");
                    drawWayfindingPath("sector-west", "gate-a");
                };
            } else if (q.includes("vegano") || q.includes("comida") || q.includes("taco")) {
                responseText = "🌱 **Comida vegana encontrada:** Diríjase a **Stadium Grill & Tacos** en el pasillo este. Sirven tacos de origen vegetal y hamburguesas veganas (espera: 20 min). Ruta trazada.";
                triggerMapAction = () => {
                    selectElementByKey("facility-food-east");
                    drawWayfindingPath("gate-c", "facility-food-east");
                };
            } else {
                responseText = "🤖 **ArenaAI en Español:** Entendido. Puede consultar los tiempos de espera y rutas de accesibilidad en el mapa dinámico. Si tiene una emergencia, comuníquese con el personal voluntario.";
            }
        }
        else if (lang === "fr") {
            if (q.includes("toilette") || q.includes("wc") || q.includes("bain")) {
                responseText = "♿ **Toilettes accessibles localisées!** Les toilettes adaptées aux fauteuils roulants les plus proches sont **Restroom NE** (concourse Nord-Est). J'ai mis l'emplacement en surbrillance sur la carte.";
                triggerMapAction = () => {
                    selectElementByKey("facility-wc-ne");
                    drawWayfindingPath("gate-a", "facility-wc-ne");
                };
            } else if (q.includes("porte") || q.includes("entree")) {
                responseText = "🚶 **Itinéraire tracé:** Pour rejoindre la **Porte A** (Entrée Nord-Ouest, attente: 4 min) depuis les tribunes Ouest, suivez le tracé en surbrillance dorée.";
                triggerMapAction = () => {
                    selectElementByKey("gate-a");
                    drawWayfindingPath("sector-west", "gate-a");
                };
            } else {
                responseText = "🤖 **ArenaAI en Français:** Bonjour. Je peux vous guider vers les concessions, les sorties ou les services d'accessibilité. La carte interactive a été mise à jour.";
            }
        }

        addBotMessage(responseText);
        if (triggerMapAction) triggerMapAction();
    }

    // --- TTS Speech Synthesis ---
    function speakBotText(text) {
        if (!('speechSynthesis' in window)) return;
        
        // Remove markdown chars for speech
        const cleanText = text.replace(/[*#_`♿🌱🚻🚗🚶]/g, "");
        const utterance = new SpeechSynthesisUtterance(cleanText);
        
        const lang = dom.assistantLang.value;
        if (lang === "es") {
            utterance.lang = "es-MX";
        } else if (lang === "fr") {
            utterance.lang = "fr-FR";
        } else {
            utterance.lang = "en-US";
        }

        window.speechSynthesis.cancel(); // Stop current speech
        window.speechSynthesis.speak(utterance);
    }


    // ==========================================================================
    // GAMIFIED SUSTAINABILITY FOOTPRINT ENGINE
    // ==========================================================================

    function initSustainabilityCalculator() {
        dom.calculateEcoBtn.addEventListener("click", () => {
            const transport = dom.ecoTransport.value;
            const food = dom.ecoFood.value;
            const recycling = dom.ecoRecycling.checked;

            // Calculate carbon footprint (KG of CO2)
            let score = 0;
            if (transport === "transit") score += 0.1;
            else if (transport === "rideshare") score += 1.5;
            else score += 4.2;

            if (food === "vegan") score += 0.2;
            else if (food === "chicken") score += 1.1;
            else score += 3.8;

            if (recycling) score -= 0.3;
            score = Math.max(0.1, parseFloat(score.toFixed(1)));

            // Visual Updates
            dom.ecoValue.innerText = score;
            
            // Max potential footprint is ~8.0kg CO2, calculate percentage
            const percentage = Math.max(10, Math.min(100, 100 - (score / 8.0 * 100)));
            dom.ecoProgress.style.width = `${percentage}%`;

            let badge = "";
            let tip = "";
            let badgeClass = "";

            if (score <= 1.0) {
                badge = "Eco Hero";
                badgeClass = "badge-tag green-badge";
                tip = `🏆 Excellent! Your carbon footprint is extremely low. You saved approx. 7.0kg CO2 compared to standard driving and beef meals!`;
                // Add points to operational sustainability offset on the backend and frontend
                updateBackendTelemetry(undefined, undefined, 5);
                const currentOffset = parseInt(dom.telemetryCo2.innerText.replace(/,/g, ""));
                dom.telemetryCo2.innerText = (currentOffset + 5).toLocaleString();
            } else if (score <= 3.0) {
                badge = "Green Supporter";
                badgeClass = "badge-tag yellow-bg";
                tip = `🌱 Great job! You made eco-conscious decisions. Try using public shuttle buses next time to unlock the Eco Hero tier.`;
            } else {
                badge = "Carbon Conscious";
                badgeClass = "badge-tag red-bg";
                tip = `🚗 High impact. You can offset this by carpooling, recycling your plastic bottles, or picking plant-based concessions at Stadium Grill.`;
            }

            dom.ecoBadgeName.innerText = badge;
            dom.ecoBadgeName.className = badgeClass;
            dom.ecoTip.innerText = tip;
            
            dom.ecoResult.classList.remove("hidden");
            showToast("Footprint Calculated", `Your matchday footprint is ${score} kg CO2. Badge Unlocked: ${badge}.`, "success");
        });
    }


    // ==========================================================================
    // OPERATIONS & DECISION CONSOLE ENGINE
    // ==========================================================================

    function initOperationsConsole() {
        // Incident list items selection
        renderIncidentsList();
        renderVolunteerRoster();

        // Trigger manual incident
        dom.triggerIncidentBtn.addEventListener("click", async () => {
            const type = dom.incType.value;
            const locationKey = dom.incLocation.value;
            const severity = dom.incSeverity.value;
            const locName = coordinates[locationKey].label;

            // Generate customized recommendations based on simulated AI logic
            let code = "INC-" + Math.floor(Math.random() * 9000 + 1000);
            let title = "";
            let description = "";
            let volSpecialty = "Crowd Control";
            let volLang = "EN";
            let recs = [];

            if (type === "crowd") {
                title = `Crowd Bottleneck at ${locName}`;
                description = `Heavy congestion build-up. Transit times to seats exceeding safe limits. Density capacity reached 92%.`;
                volSpecialty = "Crowd Control";
                volLang = "EN, ES";
                recs = [
                    `Activate alternate pedestrian lane routes.`,
                    `Deploy 3 Crowd Control volunteers to redirect incoming fan flow.`,
                    `Broadcast digital notification advising fans to utilize alternative stadium concourse bypasses.`
                ];
            } else if (type === "medical") {
                title = `Medical Emergency in ${locName}`;
                description = `Fan reports chest pain / breathing difficulty. First aid dispatch required immediately.`;
                volSpecialty = "First Aid";
                volLang = "EN";
                recs = [
                    `Dispatch emergency first response medical team to sector.`,
                    `Assign nearest First Aid certified volunteer to hold sector corridor clear for stretcher access.`,
                    `Prepare transport vehicle path to Gate D ambulance bay.`
                ];
            } else if (type === "facility") {
                title = `Power Malfunction at ${locName}`;
                description = `Ticketing scanners offline. Fans unable to scan digital passes. Backlog of approx 150 fans.`;
                volSpecialty = "Technical Staff";
                volLang = "EN";
                recs = [
                    `Re-route server gate connectivity to backup stadium cellular system.`,
                    `Deploy Tech Support volunteer with offline ticketing scanners.`,
                    `Inform security staff to perform visual match inspections if queue delay exceeds 15 minutes.`
                ];
            } else {
                title = `Liquid Spill in ${locName}`;
                description = `Fluid spill reported. Highly slippery surface in high-traffic concourse corridor.`;
                volSpecialty = "Crowd Control";
                volLang = "EN, ES";
                recs = [
                    `Dispatch Logistics volunteer with clean-up mop and hazard warning signs.`,
                    `Station nearest standby volunteer to secure area and divert pedestrian foot traffic.`
                ];
            }

            const incidentPayload = {
                code,
                type,
                title,
                description,
                location: locationKey,
                locationName: locName,
                severity,
                recommendedActions: recs,
                volunteerSpecialty: volSpecialty,
                volunteerLang: volLang
            };

            let finalIncident = null;
            if (backendActive && authToken) {
                try {
                    const response = await fetch(`${API_BASE}/incidents`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${authToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(incidentPayload)
                    });
                    if (response.ok) {
                        finalIncident = await response.json();
                    }
                } catch (err) {
                    console.warn("[API] Incident post failed. Using local fallback.", err);
                }
            }

            if (!finalIncident) {
                finalIncident = {
                    id: "inc-" + Date.now(),
                    time: "Just now",
                    status: "active",
                    ...incidentPayload
                };
                state.incidents.unshift(finalIncident);
            } else {
                state.incidents.unshift(finalIncident);
            }

            state.activeIncidentId = finalIncident.id;
            showToast("New Incident Triggered", `Simulated alert deployed: ${title}`, "warning");
            
            // Trigger visual flash on the 3D stand or gate
            const mesh = stadiumMeshes[locationKey];
            if (mesh) {
                const originalColor = mesh.material.emissive.getHex();
                mesh.material.emissive.setHex(0xff0000); // Flash red
                mesh.material.emissiveIntensity = 0.9;
                setTimeout(() => {
                    if (mesh.material) {
                        mesh.material.emissive.setHex(originalColor);
                        mesh.material.emissiveIntensity = state.densityLayer ? 0.35 : 0.05;
                    }
                }, 3000);
            }

            renderIncidentsList();
            renderOperationsConsole();
        });
    }

    function renderIncidentsList() {
        dom.incidentsList.innerHTML = "";
        dom.incidentCount.innerText = state.incidents.length;

        state.incidents.forEach(inc => {
            const item = document.createElement("div");
            item.className = `incident-item ${inc.severity} ${state.activeIncidentId === inc.id ? "active" : ""}`;
            item.dataset.id = inc.id;

            const badgeColor = inc.severity === "high" ? "red-bg" : inc.severity === "medium" ? "yellow-bg" : "green-bg";
            const severityLabel = inc.severity.toUpperCase();

            item.innerHTML = `
                <div class="incident-item-header">
                    <span class="badge ${badgeColor} font-mono">${inc.code}</span>
                    <span class="incident-time">${inc.time}</span>
                </div>
                <h5>${inc.title}</h5>
                <p class="description">${inc.description}</p>
                <div class="incident-meta">
                    <span>Loc: ${inc.locationName}</span>
                    <span class="severity-tag ${inc.severity === 'high' ? 'crit' : 'warn'}">${severityLabel}</span>
                </div>
            `;

            item.addEventListener("click", () => {
                state.activeIncidentId = inc.id;
                if (coordinates[inc.location]) {
                    selectElementByKey(inc.location);
                }
                
                renderIncidentsList();
                renderOperationsConsole();
            });

            dom.incidentsList.appendChild(item);
        });
    }

    async function renderOperationsConsole() {
        const activeInc = state.incidents.find(i => i.id === state.activeIncidentId);

        if (!activeInc) {
            dom.aiRecommenderBody.innerHTML = `
                <div class="no-selection-placeholder">
                    <svg viewBox="0 0 24 24" width="48" height="48" class="icon opacity-20"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    <p>Select an active incident from the list to analyze real-time stadium metrics and formulate a GenAI resolution plan.</p>
                </div>
            `;
            return;
        }

        // Fetch GenAI Analysis if connected and not cached yet
        if (backendActive && authToken && !activeInc.aiAnalysis) {
            dom.aiRecommenderBody.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 40px 20px; text-align:center;">
                    <svg viewBox="0 0 100 100" class="ai-pulse-logo" style="width: 54px; height: 54px; margin-bottom: 15px;">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="var(--accent)" stroke-width="4" />
                        <path d="M25 50 Q40 20 50 50 T75 50" fill="none" stroke="#22d3ee" stroke-width="4" stroke-linecap="round"/>
                    </svg>
                    <h4 style="margin: 5px 0;">Analyzing incident...</h4>
                    <p class="text-secondary" style="font-size: 0.8rem; margin-bottom:15px;">Running Gemini operational advisor...</p>
                    <p class="typing-indicator-dots"><span></span><span></span><span></span></p>
                </div>
            `;

            try {
                const response = await fetch(`${API_BASE}/analyze-incident`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        incident: activeInc,
                        telemetry: {
                            inflow: parseInt(dom.telemetryInflow.innerText),
                            wait: parseFloat(dom.telemetryWait.innerText),
                            volunteers: dom.telemetryVolunteers.innerText
                        }
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    activeInc.aiAnalysis = data;
                    if (data.matchedVolunteerSpecialty) {
                        activeInc.volunteerSpecialty = data.matchedVolunteerSpecialty;
                    }
                    if (data.matchedVolunteerLang) {
                        activeInc.volunteerLang = data.matchedVolunteerLang;
                    }
                    if (data.recs && data.recs.length > 0) {
                        activeInc.recommendedActions = data.recs;
                    }
                    // Re-render with new data
                    renderOperationsConsole();
                    return;
                }
            } catch (err) {
                console.warn("[API] Analyze incident failed. Using local fallback.", err);
            }
        }

        // Find matching volunteer on standby
        const matchVol = state.volunteers.find(v => v.status === "standby" && (v.specialty === activeInc.volunteerSpecialty || v.languages.includes(activeInc.volunteerLang.split(",")[0])));
        const volHTML = matchVol ? `
            <div class="dispatch-recommendation-box">
                <p class="text-secondary" style="font-size: 0.78rem;">GenAI Matched Volunteer on Standby:</p>
                <div class="volunteer-match-card">
                    <div class="vol-match-profile">
                        <div class="vol-avatar-init" style="width:26px; height:26px; font-size:0.7rem;">${matchVol.initials}</div>
                        <div>
                            <span class="vol-match-name">${matchVol.name}</span>
                            <div class="vol-match-specialty">${matchVol.specialty} • ${matchVol.languages}</div>
                        </div>
                    </div>
                    <span class="vol-status-badge status-available vol-match-badge">STANDBY</span>
                </div>
                <button class="accent-border-btn w-full style-btn" id="btn-dispatch-vol" data-vol-id="${matchVol.id}" style="margin-top:10px;">
                    Execute AI Dispatch & Broadcast
                </button>
            </div>
        ` : `
            <div class="dispatch-recommendation-box text-center">
                <p class="text-warning" style="font-size: 0.8rem;">⚠️ No matching specialist volunteers on standby. Recommend broadcasting general task request to nearest section staff.</p>
                <button class="primary-btn w-full small-btn" id="btn-broadcast-general" style="margin-top:10px;">Broadcast Task Request</button>
            </div>
        `;

        const assessmentText = activeInc.aiAnalysis 
            ? activeInc.aiAnalysis.assessment 
            : `Telemetry Impact: Section capacity flow decreased. Localized bottleneck detected near ${activeInc.locationName}. High congestion increases safety risks.`;

        dom.aiRecommenderBody.innerHTML = `
            <div class="rec-content">
                <div class="rec-title-block">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h4>${activeInc.title}</h4>
                        <span class="badge ${activeInc.severity === 'high' ? 'red-bg' : 'yellow-bg'}" style="font-size:0.7rem;">${activeInc.code}</span>
                    </div>
                    <p>${activeInc.description}</p>
                </div>

                <div class="rec-section">
                    <h5>GenAI Incident Assessment</h5>
                    <div class="rec-guideline-box">
                        <p style="font-size: 0.82rem; margin: 0; line-height: 1.4;">${assessmentText}</p>
                    </div>
                </div>

                <div class="rec-section">
                    <h5>GenAI Action Plan Recommendation</h5>
                    <div class="rec-guideline-box">
                        <ul>
                            ${activeInc.recommendedActions.map(action => `<li>${action}</li>`).join("")}
                        </ul>
                    </div>
                </div>

                <div class="rec-section">
                    <h5>Volunteer Resource Allocation</h5>
                    ${volHTML}
                </div>
            </div>
        `;

        // Event listener for dispatch button
        const dispatchBtn = document.getElementById("btn-dispatch-vol");
        if (dispatchBtn) {
            dispatchBtn.addEventListener("click", () => {
                const volId = dispatchBtn.dataset.volId;
                executeVolunteerDispatch(volId, activeInc);
            });
        }

        const broadcastBtn = document.getElementById("btn-broadcast-general");
        if (broadcastBtn) {
            broadcastBtn.addEventListener("click", () => {
                showToast("Broadcast Deployed", "Broadcast general request to all concourse staff.", "success");
                resolveIncident(activeInc.id);
            });
        }
    }

    async function executeVolunteerDispatch(volId, incident) {
        const vol = state.volunteers.find(v => v.id === volId);
        if (!vol) return;

        // Sync dispatch to backend
        let backendDispatched = false;
        if (backendActive && authToken) {
            try {
                const response = await fetch(`${API_BASE}/dispatch`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ volunteerId: volId, incidentId: incident.id })
                });
                if (response.ok) {
                    backendDispatched = true;
                    const data = await response.json();
                    if (data.volunteer) {
                        vol.status = data.volunteer.status;
                        vol.location = data.volunteer.location;
                    }
                }
            } catch (err) {
                console.warn("[API] Dispatch post failed. Using local fallback.", err);
            }
        }

        if (!backendDispatched) {
            vol.status = "busy";
            vol.location = incident.locationName;
        }

        // Show visual dispatch path on the map
        const targetCoord = coordinates[incident.location];
        if (targetCoord) {
            drawWayfindingPath("gate-a", incident.location);
        }

        showToast("Dispatch Commenced", `Dispatched ${vol.name} to ${incident.locationName} for ${incident.type} response.`, "success");
        
        renderVolunteerRoster();
        renderOperationsConsole();

        // Simulate resolution in 6 seconds
        setTimeout(async () => {
            showToast("Incident Resolved", `Incident ${incident.code} has been resolved by ${vol.name}. Telemetry stabilizing.`, "success");
            
            let backendResolved = false;
            if (backendActive && authToken) {
                try {
                    const resRes = await fetch(`${API_BASE}/incidents/${incident.id}/resolve`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${authToken}` }
                    });
                    
                    const volRes = await fetch(`${API_BASE}/volunteers/${vol.id}/status`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${authToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ status: 'standby', location: incident.locationName })
                    });
                    
                    if (resRes.ok && volRes.ok) {
                        backendResolved = true;
                    }
                } catch (err) {
                    console.warn("[API] Resolution sync failed.", err);
                }
            }

            if (backendResolved) {
                await syncStateWithBackend();
            } else {
                resolveIncident(incident.id);
                vol.status = "standby";
                vol.location = incident.locationName;
            }
            
            clearActiveRoute();
            renderVolunteerRoster();
            renderOperationsConsole();
        }, 6000);
    }

    async function resolveIncident(incId) {
        if (backendActive && authToken) {
            try {
                await fetch(`${API_BASE}/incidents/${incId}/resolve`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                await syncStateWithBackend();
                return;
            } catch (err) {
                console.warn("[API] Resolve failed.", err);
            }
        }
        
        state.incidents = state.incidents.filter(i => i.id !== incId);
        if (state.activeIncidentId === incId) {
            state.activeIncidentId = state.incidents.length > 0 ? state.incidents[0].id : null;
        }
        renderIncidentsList();
        renderOperationsConsole();
    }

    function renderVolunteerRoster() {
        dom.volunteersList.innerHTML = "";
        
        let availCount = 0;
        let busyCount = 0;

        state.volunteers.forEach(vol => {
            if (vol.status === "standby") availCount++;
            else busyCount++;

            const row = document.createElement("div");
            row.className = "volunteer-row";
            row.innerHTML = `
                <div class="vol-profile">
                    <div class="vol-avatar-init">${vol.initials}</div>
                    <div class="vol-details">
                        <span class="vol-name">${vol.name}</span>
                        <span class="vol-meta">${vol.languages} • ${vol.specialty}</span>
                    </div>
                </div>
                <div class="vol-status-badge ${vol.status === 'standby' ? 'status-available' : 'status-busy'}">
                    ${vol.status === 'standby' ? 'STANDBY' : 'ON MISSION (' + vol.location.split(" ")[0].toUpperCase() + ')'}
                </div>
            `;
            dom.volunteersList.appendChild(row);
        });

        dom.volunteersAvail.innerText = availCount;
        dom.volunteersBusy.innerText = busyCount;
        dom.telemetryVolunteers.innerText = `${busyCount} / ${state.volunteers.length}`;
    }


    // ==========================================================================
    // REAL-TIME TELEMETRY SIMULATION LOOP
    // ==========================================================================

    function startSimulationLoop() {
        setInterval(() => {
            // 1. Simulate inflow rate fluctuate
            const currentInflow = parseInt(dom.telemetryInflow.innerText);
            const fluctuation = Math.floor(Math.random() * 21 - 10); // -10 to +10
            const newInflow = Math.max(350, Math.min(600, currentInflow + fluctuation));
            dom.telemetryInflow.innerText = newInflow;

            // 2. Simulate average wait times fluctuate
            const currentWait = parseFloat(dom.telemetryWait.innerText);
            const waitFluct = parseFloat((Math.random() * 0.8 - 0.4).toFixed(1)); // -0.4 to +0.4
            const newWait = Math.max(8.0, Math.min(22.0, parseFloat((currentWait + waitFluct).toFixed(1))));
            dom.telemetryWait.innerText = newWait;

            // 3. Update the dynamic telemetry chart bar height
            const barHeight = Math.max(10, Math.min(100, Math.floor(newInflow / 600 * 100)));
            dom.dynamicBar.style.height = `${barHeight}%`;

            // 4. Randomly update stadium attendance slightly
            const attText = document.getElementById("header-attendance").innerText;
            const parts = attText.split("/");
            const currentAtt = parseInt(parts[0].replace(/,/g, ""));
            const maxAtt = parseInt(parts[1].replace(/,/g, ""));
            
            if (currentAtt < maxAtt) {
                const addAtt = Math.floor(Math.random() * 5);
                const nextAtt = Math.min(maxAtt, currentAtt + addAtt);
                document.getElementById("header-attendance").innerText = `${nextAtt.toLocaleString()} / ${maxAtt.toLocaleString()}`;
            }

            // Sync with backend if connected
            if (backendActive && authToken) {
                updateBackendTelemetry(newInflow, newWait);
                fetchTelemetryAndIncidents();
            }

        }, 3000);
    }


    // ==========================================================================
    // UTILITY HELPER FUNCTIONS
    // ==========================================================================

    function showToast(title, message, type = "info") {
        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        
        let iconSVG = "";
        if (type === "success") {
            iconSVG = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        } else if (type === "warning" || type === "error") {
            iconSVG = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2.5"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
        } else {
            iconSVG = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
        }

        toast.innerHTML = `
            <div class="toast-icon">${iconSVG}</div>
            <div class="toast-body">
                <span class="toast-title">${title}</span>
                <span class="toast-message">${message}</span>
            </div>
        `;
        dom.toastContainer.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.classList.add("toast-exit");
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    function parseMarkdown(text) {
        // Simplified markdown parsing for formatting bubbles
        let html = text;
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        html = html.replace(/`([^`]+)`/g, '<code class="font-mono">$1</code>');
        
        // Convert emoji code labels or headings if needed, but since we feed regular text:
        // Wrap newlines in paragraphs
        return html.split('\n\n').map(p => `<p>${p}</p>`).join("");
    }
});
