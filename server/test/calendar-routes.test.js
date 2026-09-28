const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('rotas administrativas do Google Agenda existem e nao serializam credenciais', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'routes', 'calendar.js'), 'utf8');
    for (const route of ['/calendar/integration', '/calendar/oauth/start', '/calendar/oauth/callback', '/calendar/integration/retry', '/calendar/integration/sync-active']) {
        assert.match(source, new RegExp(route.replaceAll('/', '\\/')));
    }
    assert.match(source, /authenticateToken/);
    assert.match(source, /authorizeRole\(\['admin'\]\)/);
    assert.doesNotMatch(source, /res\.json\([^)]*encrypted_refresh_token/);
});

test('servidor monta o roteador do calendario', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    assert.match(source, /routes\/calendar/);
    assert.match(source, /calendarRoutes/);
});
