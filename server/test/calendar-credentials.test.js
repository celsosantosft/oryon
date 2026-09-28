const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('gera uma chave persistente quando nao existe variavel de ambiente', () => {
    const { resolveCalendarEncryptionKey } = require('../services/calendarCredentials');
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oryon-calendar-'));
    try {
        const first = resolveCalendarEncryptionKey({ env: {}, dataDir });
        const second = resolveCalendarEncryptionKey({ env: {}, dataDir });
        assert.equal(first, second);
        assert.ok(first.length >= 32);
        assert.equal(fs.existsSync(path.join(dataDir, '.calendar-encryption-key')), true);
    } finally {
        fs.rmSync(dataDir, { recursive: true, force: true });
    }
});

test('monta cliente Google usando segredo criptografado da empresa', () => {
    const { encryptCredential } = require('../services/googleCalendarClient');
    const { buildStoredGoogleConfig } = require('../services/calendarCredentials');
    const key = 'uma-chave-local-segura-para-o-teste';
    const config = buildStoredGoogleConfig({
        google_client_id: 'cliente.apps.googleusercontent.com',
        encrypted_client_secret: encryptCredential('segredo-google', key),
        oauth_redirect_uri: 'https://app.test/api/calendar/oauth/callback'
    }, key);
    assert.deepEqual(config, {
        clientId: 'cliente.apps.googleusercontent.com',
        clientSecret: 'segredo-google',
        redirectUri: 'https://app.test/api/calendar/oauth/callback'
    });
});
