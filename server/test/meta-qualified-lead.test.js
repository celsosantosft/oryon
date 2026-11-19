const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database(':memory:');
// Inject an isolated DB/config/transport: no live customers, credentials or network.
require.cache[require.resolve('../database')] = { exports: db };
require.cache[require.resolve('../config/metaCapi')] = { exports: {
    metaCapiConfig: { pixelId: 'test', accessToken: 'test', graphVersion: 'v26.0',
        qualifiedLeadEventName: 'Lead', defaultCountryCode: '55', qualifiedLeadLabels: [] },
    getMetaCapiDiagnostics: () => ({ hasPixelId: true, hasAccessToken: true })
} };
const axios = require('axios');
const { sendQualifiedLeadEvent: send, normalizePhone } = require('../services/metaCapiService');
const all = sql => new Promise((resolve, reject) => db.all(sql, (e, rows) => e ? reject(e) : resolve(rows)));
const run = sql => new Promise((resolve, reject) => db.run(sql, e => e ? reject(e) : resolve()));
let calls;
before(async () => { await send({}, { sourceId: 'initialize' }); });
beforeEach(async () => {
    await run('DELETE FROM meta_capi_events');
    calls = [];
    axios.post = async (_url, payload) => {
        calls.push(structuredClone(payload));
        return { data: { events_received: 1 } };
    };
});
after(() => new Promise(resolve => db.close(resolve)));
const lead = { phone: '81999990000' };
const options = { source: 'whatsapp', sourceId: '1', conversationId: 1, eventId: 'lead-1' };

test('confirmed receipt is required and success suppresses manual/label duplicates', async () => {
    assert.equal((await send(lead, options)).sent, true);
    assert.equal((await send(lead, { ...options, source: 'whatsapp_manual', sourceId: lead.phone })).reason, 'already_sent');
    assert.equal((await send(lead, { ...options, eventName: 'QualifiedLead' })).reason, 'already_sent');
    assert.equal(calls.length, 1);
    assert.match(calls[0].data[0].event_id, /:whatsapp:1:lead$/);
    assert.doesNotMatch(calls[0].data[0].event_id, /81999990000/);
    assert.equal((await all('SELECT event_id,status FROM meta_capi_events'))[0].status, 'sent');
});

test('HTTP success without receipt is failed, never a successful lead', async () => {
    axios.post = async () => ({ data: { events_received: 0 } });
    await assert.rejects(send(lead, options), e => e.metaCapi.error.message === 'meta_did_not_confirm_receipt');
    assert.equal((await all('SELECT status FROM meta_capi_events'))[0].status, 'failed');
});

test('timeout retry reuses the exact event ID, time and payload and redacts errors', async () => {
    let original;
    axios.post = async (_url, payload) => {
        original = structuredClone(payload);
        const e = new Error('secret-token and private-phone');
        e.response = { status: 400, data: { error: { code: 100, message: 'secret-token' } } };
        throw e;
    };
    await assert.rejects(send(lead, options));
    assert.doesNotMatch(JSON.stringify(await all('SELECT error FROM meta_capi_events')), /secret-token|private-phone/);
    axios.post = async (_url, payload) => {
        assert.deepEqual(payload, original);
        return { data: { events_received: 1 } };
    };
    assert.equal((await send({ ...lead, email: 'changed@example.com' }, options)).sent, true);
});

test('concurrent manual and label qualification sends one event', async () => {
    await Promise.all([send(lead, options), send(lead, { ...options, source: 'whatsapp_manual', sourceId: lead.phone })]);
    assert.equal(calls.length, 1);
});

test('old saved events are not assigned a new date', async () => {
    axios.post = async () => { throw new Error('timeout'); };
    await assert.rejects(send(lead, options));
    const [row] = await all('SELECT request_payload FROM meta_capi_events');
    const payload = JSON.parse(row.request_payload);
    payload.data[0].event_time -= 8 * 86400;
    await new Promise((resolve, reject) => db.run('UPDATE meta_capi_events SET request_payload=?',
        [JSON.stringify(payload)], e => e ? reject(e) : resolve()));
    assert.equal((await send(lead, options)).reason, 'expired_event_requires_review');
});

test('invalid identifiers are not sent and Brazilian DDD 55 receives a country prefix', async () => {
    assert.equal((await send({ phone: '123', email: 'invalid' }, options)).reason, 'missing_user_data');
    assert.equal(calls.length, 0);
    assert.equal(normalizePhone('55999990000'), '5555999990000');
    assert.equal(normalizePhone('+55 81 99999-0000'), '5581999990000');
});

test('ambiguous messaging delivery requires review instead of sending the event again', async t => {
    const config = require('../config/metaCapi').metaCapiConfig;
    Object.assign(config, { messagingDatasetId: 'messages', pageId: 'page', whatsappBusinessAccountId: 'waba' });
    t.after(() => { delete config.messagingDatasetId; delete config.pageId; delete config.whatsappBusinessAccountId; });
    let attempts = 0;
    axios.post = async (url, payload) => {
        attempts += 1;
        assert.match(url, /\/messages\/events$/);
        assert.equal(payload.data[0].action_source, 'business_messaging');
        assert.equal(payload.data[0].user_data.page_id, 'page');
        throw new Error('timeout');
    };
    const manual = { source: 'whatsapp_manual', sourceId: lead.phone, eventName: 'QualifiedLead' };
    await assert.rejects(send(lead, manual));
    assert.equal((await send(lead, manual)).reason, 'uncertain_delivery_requires_review');
    assert.equal(attempts, 1);
    assert.equal((await all('SELECT status FROM meta_capi_events'))[0].status, 'review');
});
