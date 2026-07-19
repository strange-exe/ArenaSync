const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const app = require('./server');

let server;
let port;
let token;

// Start server on random free port before tests
test.before(() => {
    return new Promise((resolve) => {
        server = http.createServer(app);
        server.listen(0, 'localhost', () => {
            port = server.address().port;
            console.log(`[Test Server] Listening on port ${port}`);
            resolve();
        });
    });
});

// Close server after tests
test.after(() => {
    return new Promise((resolve) => {
        server.close(() => {
            console.log('[Test Server] Closed');
            resolve();
        });
    });
});

// Helper for making HTTP requests
function makeRequest(method, path, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : '';
        const options = {
            hostname: 'localhost',
            port: port,
            path: path,
            method: method,
            headers: {
                ...headers,
                'Content-Type': 'application/json',
                ...(body ? { 'Content-Length': Buffer.byteLength(data) } : {})
            }
        };

        const req = http.request(options, (res) => {
            let resData = '';
            res.on('data', (chunk) => { resData += chunk; });
            res.on('end', () => {
                let parsed = resData;
                try {
                    parsed = JSON.parse(resData);
                } catch (e) {
                    // Not JSON
                }
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: parsed
                });
            });
        });

        req.on('error', (err) => { reject(err); });
        if (body) {
            req.write(data);
        }
        req.end();
    });
}

test('Authentication Flow', async (t) => {
    await t.test('POST /api/auth/login - fails with invalid credentials', async () => {
        const res = await makeRequest('POST', '/api/auth/login', {}, {
            email: 'organizer@arenasync.com',
            password: 'WrongPassword'
        });
        assert.strictEqual(res.statusCode, 401);
        assert.strictEqual(res.body.error, 'Unauthorized');
    });

    await t.test('POST /api/auth/login - succeeds with correct credentials', async () => {
        const res = await makeRequest('POST', '/api/auth/login', {}, {
            email: 'organizer@arenasync.com',
            password: 'SecretWord2026!'
        });
        assert.strictEqual(res.statusCode, 200);
        assert.ok(res.body.accessToken);
        token = res.body.accessToken;
    });
});

test('Telemetry Endpoints', async (t) => {
    await t.test('GET /api/telemetry - fails without token', async () => {
        const res = await makeRequest('GET', '/api/telemetry');
        assert.strictEqual(res.statusCode, 401);
    });

    await t.test('GET /api/telemetry - succeeds with valid token', async () => {
        const res = await makeRequest('GET', '/api/telemetry', {
            'Authorization': `Bearer ${token}`
        });
        assert.strictEqual(res.statusCode, 200);
        assert.ok(res.body.inflowRate);
        assert.ok(res.body.activeVolunteers);
    });
});

test('Incidents Endpoints', async (t) => {
    let incidentId;

    await t.test('GET /api/incidents - returns all active incidents', async () => {
        const res = await makeRequest('GET', '/api/incidents', {
            'Authorization': `Bearer ${token}`
        });
        assert.strictEqual(res.statusCode, 200);
        assert.ok(Array.isArray(res.body));
        assert.ok(res.body.length >= 2);
    });

    await t.test('POST /api/incidents - creates a new incident', async () => {
        const res = await makeRequest('POST', '/api/incidents', {
            'Authorization': `Bearer ${token}`
        }, {
            title: 'Test Incident at Gate A',
            location: 'gate-a',
            type: 'crowd',
            severity: 'high'
        });
        assert.strictEqual(res.statusCode, 201);
        assert.strictEqual(res.body.title, 'Test Incident at Gate A');
        assert.strictEqual(res.body.status, 'active');
        incidentId = res.body.id;
    });

    await t.test('POST /api/incidents/:id/resolve - resolves the incident', async () => {
        const res = await makeRequest('POST', `/api/incidents/${incidentId}/resolve`, {
            'Authorization': `Bearer ${token}`
        });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.incidentId, incidentId);
    });
});

test('Volunteers Endpoints', async (t) => {
    await t.test('GET /api/volunteers - returns volunteer roster', async () => {
        const res = await makeRequest('GET', '/api/volunteers', {
            'Authorization': `Bearer ${token}`
        });
        assert.strictEqual(res.statusCode, 200);
        assert.ok(Array.isArray(res.body));
    });

    await t.test('POST /api/volunteers/:id/status - updates volunteer status', async () => {
        const res = await makeRequest('POST', '/api/volunteers/vol-1/status', {
            'Authorization': `Bearer ${token}`
        }, {
            status: 'busy',
            location: 'Section 104'
        });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.status, 'busy');
        assert.strictEqual(res.body.location, 'Section 104');
    });
});

test('GenAI Chat Assistant Endpoint', async (t) => {
    await t.test('POST /api/chat - returns response with highlight and routing keys', async () => {
        const res = await makeRequest('POST', '/api/chat', {}, {
            query: 'nearest wheelchair restroom',
            lang: 'en'
        });
        assert.strictEqual(res.statusCode, 200);
        assert.ok(res.body.text);
        assert.strictEqual(res.body.highlightElement, 'facility-wc-ne');
    });
});

test('GenAI Incident Analyzer Endpoint', async (t) => {
    await t.test('POST /api/analyze-incident - returns assessment and volunteer match', async () => {
        const res = await makeRequest('POST', '/api/analyze-incident', {
            'Authorization': `Bearer ${token}`
        }, {
            incident: {
                code: 'INC-1234',
                type: 'medical',
                title: 'Medical Emergency near Gate D',
                description: 'Fan reports chest pain',
                locationName: 'Gate D (South-West)',
                severity: 'high'
            },
            telemetry: {
                inflow: 500,
                wait: 12,
                volunteers: '2/5'
            }
        });
        assert.strictEqual(res.statusCode, 200);
        assert.ok(res.body.assessment);
        assert.ok(Array.isArray(res.body.recs));
        assert.strictEqual(res.body.matchedVolunteerSpecialty, 'First Aid');
    });
});

test('Security Headers Verification', async (t) => {
    await t.test('GET / - returns security headers', async () => {
        const res = await makeRequest('GET', '/');
        assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
        assert.strictEqual(res.headers['x-frame-options'], 'DENY');
        assert.strictEqual(res.headers['x-xss-protection'], '1; mode=block');
        assert.ok(res.headers['content-security-policy']);
    });
});

test('Incident Validation and Resolution Edge Cases', async (t) => {
    await t.test('POST /api/incidents - fails with missing title', async () => {
        const res = await makeRequest('POST', '/api/incidents', {
            'Authorization': `Bearer ${token}`
        }, {
            location: 'gate-a'
        });
        assert.strictEqual(res.statusCode, 400);
    });

    await t.test('POST /api/incidents/:id/resolve - fails with non-existent ID', async () => {
        const res = await makeRequest('POST', '/api/incidents/nonexistent-id-xyz/resolve', {
            'Authorization': `Bearer ${token}`
        });
        assert.strictEqual(res.statusCode, 404);
    });
});

test('Volunteer Dispatching & Role Access Verification', async (t) => {
    let volunteerToken;

    // Login as a volunteer (Mateo)
    await t.test('POST /api/auth/login - succeeds with volunteer credentials', async () => {
        const res = await makeRequest('POST', '/api/auth/login', {}, {
            email: 'mateo@arenasync.com',
            password: 'SecretWord2026!'
        });
        assert.strictEqual(res.statusCode, 200);
        assert.ok(res.body.accessToken);
        volunteerToken = res.body.accessToken;
    });

    await t.test('POST /api/dispatch - fails with missing parameters', async () => {
        const res = await makeRequest('POST', '/api/dispatch', {
            'Authorization': `Bearer ${token}` // admin
        }, {
            volunteerId: 'vol-1'
        });
        assert.strictEqual(res.statusCode, 400);
    });

    await t.test('POST /api/dispatch - fails with non-existent volunteer', async () => {
        const res = await makeRequest('POST', '/api/dispatch', {
            'Authorization': `Bearer ${token}` // admin
        }, {
            volunteerId: 'nonexistent-vol',
            incidentId: 'inc-1'
        });
        assert.strictEqual(res.statusCode, 404);
    });

    await t.test('POST /api/dispatch - fails for volunteer role (Forbidden)', async () => {
        const res = await makeRequest('POST', '/api/dispatch', {
            'Authorization': `Bearer ${volunteerToken}` // volunteer
        }, {
            volunteerId: 'vol-1',
            incidentId: 'inc-1'
        });
        assert.strictEqual(res.statusCode, 403);
    });

    await t.test('POST /api/dispatch - succeeds for admin role', async () => {
        const res = await makeRequest('POST', '/api/dispatch', {
            'Authorization': `Bearer ${token}` // admin
        }, {
            volunteerId: 'vol-1',
            incidentId: 'inc-1'
        });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.status, 'Dispatched');
    });
});

test('Telemetry Input Validation', async (t) => {
    await t.test('POST /api/telemetry - rejects non-numeric inflowRate', async () => {
        const res = await makeRequest('POST', '/api/telemetry', {
            'Authorization': `Bearer ${token}`
        }, {
            inflowRate: 'not-a-number'
        });
        assert.strictEqual(res.statusCode, 400);
        assert.ok(res.body.message.includes('inflowRate'));
    });

    await t.test('POST /api/telemetry - rejects negative avgWaitMinutes', async () => {
        const res = await makeRequest('POST', '/api/telemetry', {
            'Authorization': `Bearer ${token}`
        }, {
            avgWaitMinutes: -5
        });
        assert.strictEqual(res.statusCode, 400);
        assert.ok(res.body.message.includes('avgWaitMinutes'));
    });

    await t.test('POST /api/telemetry - accepts valid numeric inputs', async () => {
        const res = await makeRequest('POST', '/api/telemetry', {
            'Authorization': `Bearer ${token}`
        }, {
            inflowRate: 500,
            avgWaitMinutes: 12
        });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.inflowRate, 500);
    });
});

test('Volunteer Status Enum Validation', async (t) => {
    await t.test('POST /api/volunteers/:id/status - rejects invalid status enum', async () => {
        const res = await makeRequest('POST', '/api/volunteers/vol-2/status', {
            'Authorization': `Bearer ${token}`
        }, {
            status: 'hacking',
            location: 'Gate Z'
        });
        assert.strictEqual(res.statusCode, 400);
        assert.ok(res.body.message.includes('must be one of'));
    });

    await t.test('POST /api/volunteers/:id/status - accepts valid status enum', async () => {
        const res = await makeRequest('POST', '/api/volunteers/vol-2/status', {
            'Authorization': `Bearer ${token}`
        }, {
            status: 'standby',
            location: 'Gate A'
        });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.status, 'standby');
    });
});

test('Extended Security Headers Verification', async (t) => {
    await t.test('GET / - returns HSTS and Referrer-Policy headers', async () => {
        const res = await makeRequest('GET', '/');
        assert.strictEqual(res.headers['strict-transport-security'], 'max-age=31536000; includeSubDomains');
        assert.strictEqual(res.headers['referrer-policy'], 'strict-origin-when-cross-origin');
        assert.ok(res.headers['permissions-policy']);
    });
});

test('XSS Input Sanitization', async (t) => {
    await t.test('POST /api/volunteers/:id/status - sanitizes location input', async () => {
        const res = await makeRequest('POST', '/api/volunteers/vol-3/status', {
            'Authorization': `Bearer ${token}`
        }, {
            status: 'busy',
            location: '<script>alert("xss")</script>'
        });
        assert.strictEqual(res.statusCode, 200);
        // Verify HTML entities are escaped
        assert.ok(!res.body.location.includes('<script>'));
        assert.ok(res.body.location.includes('&lt;'));
    });
});

