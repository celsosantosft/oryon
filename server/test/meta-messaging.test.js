const test = require('node:test');
const assert = require('node:assert/strict');
const { extractClickId, applyMessaging, datasetFor } = require('../services/metaMessaging');
const config = { pixelId: 'legacy', messagingDatasetId: 'messaging', pageId: 'page', whatsappBusinessAccountId: 'waba' };
const event = () => ({ action_source: 'chat', user_data: { ph: ['hashed-phone'] } });

test('reads the original Evolution and Cloud API click without accepting quoted or other contacts', () => {
    const message = { key: { remoteJid: '5581999990000@s.whatsapp.net', fromMe: false }, message: {
        extendedTextMessage: { contextInfo: { externalAdReply: { ctwaClid: 'real-click-12345' } } }
    } };
    assert.equal(extractClickId({ data: message }, '81999990000'), 'real-click-12345');
    assert.equal(extractClickId({ data: message }, '81999990001'), '');
    assert.equal(extractClickId({ messages: [{ from: '5581999990000', referral: { ctwa_clid: 'cloud-click-12345' } }] }, '81999990000'), 'cloud-click-12345');
    assert.equal(extractClickId({ ...message, key: { ...message.key, fromMe: true } }, '81999990000'), '');
    assert.equal(extractClickId({ key: message.key, message: { quotedMessage: message } }, '81999990000'), '');
    assert.equal(extractClickId('{bad json', '81999990000'), '');
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
