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

test('monta autorizacao Google com PKCE e acesso somente ao calendario criado pelo app', () => {
    const { createGoogleCalendarClient } = require('../services/googleCalendarClient');
    const client = createGoogleCalendarClient({
        config: { clientId: 'client', clientSecret: 'secret', redirectUri: 'https://app.test/callback' }
    });
    const url = new URL(client.buildAuthorizationUrl({ state: 'state', codeChallenge: 'challenge' }));
    assert.equal(url.searchParams.get('state'), 'state');
    assert.equal(url.searchParams.get('code_challenge'), 'challenge');
    const scopes = url.searchParams.get('scope').split(' ');
    assert.ok(scopes.includes('https://www.googleapis.com/auth/calendar.app.created'));
    assert.ok(!scopes.includes('https://www.googleapis.com/auth/calendar'));
    assert.equal(url.searchParams.get('access_type'), 'offline');
});

test('cria a agenda de entregas sem consultar todas as agendas da conta', async () => {
    const requests = [];
    const http = {
        get: async (url) => { requests.push(['get', url]); throw new Error('nao deveria listar agendas'); },
        post: async (url) => {
            requests.push(['post', url]);
            return { data: { id: 'oryon-calendar', summary: 'Entregas Oryon' } };
        }
    };
    const { createGoogleCalendarClient } = require('../services/googleCalendarClient');
    const client = createGoogleCalendarClient({ http, config: {} });

    const calendar = await client.ensureDeliveryCalendar('token');

    assert.equal(calendar.id, 'oryon-calendar');
    assert.deepEqual(requests, [['post', 'https://www.googleapis.com/calendar/v3/calendars']]);
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
