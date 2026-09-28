const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

test('protege credencial com AES-GCM e rejeita adulteracao', () => {
    const { encryptCredential, decryptCredential } = require('../services/googleCalendarClient');
    const key = crypto.randomBytes(32).toString('base64');
    const encrypted = encryptCredential('refresh-secret', key);
    assert.notEqual(encrypted, 'refresh-secret');
    assert.equal(decryptCredential(encrypted, key), 'refresh-secret');
    assert.throws(() => decryptCredential(`${encrypted}x`, key));
});

test('monta autorizacao Google com PKCE e escopo de calendario', () => {
    const { createGoogleCalendarClient } = require('../services/googleCalendarClient');
    const client = createGoogleCalendarClient({
        config: { clientId: 'client', clientSecret: 'secret', redirectUri: 'https://app.test/callback' }
    });
    const url = new URL(client.buildAuthorizationUrl({ state: 'state', codeChallenge: 'challenge' }));
    assert.equal(url.searchParams.get('state'), 'state');
    assert.equal(url.searchParams.get('code_challenge'), 'challenge');
    assert.match(url.searchParams.get('scope'), /calendar/);
    assert.equal(url.searchParams.get('access_type'), 'offline');
});

test('exclui evento inexistente como sucesso', async () => {
    const http = { delete: async () => { const error = new Error('not found'); error.response = { status: 404 }; throw error; } };
    const { createGoogleCalendarClient } = require('../services/googleCalendarClient');
    const client = createGoogleCalendarClient({ http, config: {} });
    await assert.doesNotReject(() => client.deleteEvent('token', 'calendar', 'event'));
});

test('busca evento por propriedades privadas repetidas sem colchetes', async () => {
    let receivedConfig;
    const http = { get: async (url, config) => { receivedConfig = config; return { data: { items: [] } }; } };
    const { createGoogleCalendarClient } = require('../services/googleCalendarClient');
    const client = createGoogleCalendarClient({ http, config: {} });
    await client.findOrderEvent('token', 'calendar', 'atos', 42);
    assert.deepEqual(receivedConfig.params.privateExtendedProperty, ['oryonTenant=atos', 'oryonOrderId=42']);
    assert.equal(receivedConfig.paramsSerializer.indexes, null);
});
