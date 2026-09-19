const test = require('node:test');
const assert = require('node:assert/strict');
const { EVOLUTION_WEBHOOK_EVENTS } = require('../config/evolution');

test('Evolution webhook subscribes only to events used by Oryon', () => {
    assert.deepEqual(EVOLUTION_WEBHOOK_EVENTS, [
        'APPLICATION_STARTUP',
        'QRCODE_UPDATED',
        'CHATS_SET',
        'CONTACTS_SET',
        'MESSAGES_UPSERT',
        'SEND_MESSAGE',
        'LABELS_EDIT',
        'LABELS_ASSOCIATION',
        'CONNECTION_UPDATE'
    ]);
});
