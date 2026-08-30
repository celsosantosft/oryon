const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { applyHttpSecurity } = require('../middlewares/security');

async function startTestServer(options = {}) {
    const app = express();
    applyHttpSecurity(app, options);
    app.use(express.json());
    app.get('/health', (req, res) => res.json({ ok: true }));
    app.post('/api/login', (req, res) => {
        if (req.body.password === 'correta') {
            return res.status(200).json({ token: 'teste' });
        }

        return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
    });

    const server = await new Promise((resolve) => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    const { port } = server.address();

    return {
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        })
    };
}

test('API responses include browser security headers', async (t) => {
    const server = await startTestServer();
    t.after(server.close);

    const response = await fetch(`${server.baseUrl}/health`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
});

test('login limiter blocks repeated failures without counting successful logins', async (t) => {
    const server = await startTestServer({
        loginWindowMs: 60_000,
        loginMaxAttempts: 2
    });
    t.after(server.close);

    const login = (password) => fetch(`${server.baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'admin@atos.com', password })
    });

    assert.equal((await login('correta')).status, 200);
    assert.equal((await login('errada-1')).status, 401);
    assert.equal((await login('errada-2')).status, 401);

    const blocked = await login('errada-3');
    assert.equal(blocked.status, 429);
    assert.deepEqual(await blocked.json(), {
        message: 'Muitas tentativas de login. Tente novamente em alguns minutos.'
    });
});

test('login limiter only counts real login submissions', async (t) => {
    const server = await startTestServer({
        loginWindowMs: 60_000,
        loginMaxAttempts: 1
    });
    t.after(server.close);

    const ignored = await fetch(`${server.baseUrl}/api/login`, { method: 'GET' });
    assert.equal(ignored.status, 404);

    const failedLogin = await fetch(`${server.baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'admin@atos.com', password: 'errada' })
    });
    assert.equal(failedLogin.status, 401);
});
