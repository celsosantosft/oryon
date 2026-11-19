const test = require('node:test');
const assert = require('node:assert/strict');
const { extractClickId, applyMessaging, datasetFor, recordContactSignal, linkOrderConversation } = require('../services/metaMessaging');
const config = { pixelId: 'legacy', messagingDatasetId: 'messaging', pageId: 'page', whatsappBusinessAccountId: 'waba' };
const event = () => ({ action_source: 'chat', user_data: { ph: ['hashed-phone'] } });

test('reads the original Evolution and Cloud API click without accepting quoted or other contacts', () => {
    const message = { key: { remoteJid: '5581999990000@s.whatsapp.net', fromMe: false }, message: {
        extendedTextMessage: { contextInfo: { externalAdReply: { ctwaClid: 'real-click-12345' } } }
    } };
    assert.equal(extractClickId({ data: message }, '81999990000'), 'real-click-12345');
    assert.equal(extractClickId({ data: message }, '558199990000'), 'real-click-12345');
    assert.equal(extractClickId({ data: message }, '81999990001'), '');
    assert.equal(extractClickId({ messages: [{ from: '5581999990000', referral: { ctwa_clid: 'cloud-click-12345' } }] }, '81999990000'), 'cloud-click-12345');
    assert.equal(extractClickId({ ...message, key: { ...message.key, fromMe: true } }, '81999990000'), '');
    assert.equal(extractClickId({ key: message.key, message: { quotedMessage: message } }, '81999990000'), '');
    assert.equal(extractClickId('{bad json', '81999990000'), '');
});

test('order phone links automatically and webhook retains only conversion metadata', async t => {
    const sqlite3 = require('sqlite3');
    const db = new sqlite3.Database(':memory:');
    const exec = sql => new Promise((resolve, reject) => db.exec(sql, e => e ? reject(e) : resolve()));
    const all = sql => new Promise((resolve, reject) => db.all(sql, (e, rows) => e ? reject(e) : resolve(rows)));
    t.after(() => new Promise(resolve => db.close(resolve)));
    await exec(`CREATE TABLE clients(id INTEGER PRIMARY KEY,phone TEXT);
        CREATE TABLE orders(id INTEGER PRIMARY KEY,client_id INTEGER,client_phone TEXT,client_name TEXT);
        CREATE TABLE whatsapp_conversations(id INTEGER PRIMARY KEY,phone TEXT UNIQUE,client_id INTEGER,client_name TEXT);
        CREATE TABLE whatsapp_conversation_orders(order_id INTEGER,conversation_id INTEGER,UNIQUE(order_id,conversation_id));
        CREATE TABLE whatsapp_messages(id INTEGER PRIMARY KEY,conversation_id INTEGER,provider_message_id TEXT UNIQUE,
            phone TEXT,direction TEXT,message_type TEXT,body TEXT,raw_payload TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
        INSERT INTO orders VALUES(1,NULL,'(81) 99999-0000','Cliente');`);
    const linked = await linkOrderConversation(db, 1);
    assert.equal(linked.linked, true);
    await linkOrderConversation(db, 1);
    assert.equal((await all('SELECT * FROM whatsapp_conversation_orders')).length, 1);
    const incoming = { phone: '558199990000', fromMe: false };
    const raw = { apikey: 'must-not-be-stored', data: { key: { remoteJid: '5581999990000@s.whatsapp.net' },
        message: { conversation: 'private-message', contextInfo: { externalAdReply: { ctwaClid: 'real-click-12345' } } } } };
    await recordContactSignal(db, incoming, linked.conversationId, raw);
    await recordContactSignal(db, incoming, linked.conversationId, raw);
    await recordContactSignal(db, { ...incoming, fromMe: true }, linked.conversationId, raw);
    const rows = await all('SELECT * FROM whatsapp_messages');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].body, '');
    assert.doesNotMatch(rows[0].raw_payload, /private-message|must-not-be-stored|apikey/);
    assert.equal(extractClickId(rows[0].raw_payload, incoming.phone), 'real-click-12345');
    await exec(`INSERT INTO whatsapp_conversations(phone) VALUES('5581999990000');`);
    assert.equal((await linkOrderConversation(db, 1)).reason, 'ambiguous_phone');
});

test('messaging uses the WABA and raw click ID, not a manufactured phone/ad ID', () => {
    const actual = applyMessaging(event(), config, 'real-click-12345');
    assert.equal(actual.action_source, 'business_messaging');
    assert.equal(actual.messaging_channel, 'whatsapp');
    assert.deepEqual(actual.user_data, { whatsapp_business_account_id: 'waba', ctwa_clid: 'real-click-12345' });
    assert.equal(datasetFor({ data: [actual] }, config), 'messaging');
});

test('without a click, hashed matching includes the mandatory page ID', () => {
    const actual = applyMessaging(event(), config);
    assert.deepEqual(actual.user_data, { ph: ['hashed-phone'], page_id: 'page', whatsapp_business_account_id: 'waba' });
    assert.throws(() => applyMessaging(event(), { messagingDatasetId: 'messaging' }), /missing_messaging_config/);
    assert.equal(datasetFor({ data: [event()] }, config), 'legacy');
    assert.deepEqual(applyMessaging(event(), {}), event());
});
