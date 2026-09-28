const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('normaliza lembretes do Google Agenda', () => {
    const { normalizeReminderDays } = require('../utils/calendarSettings');
    assert.deepEqual(normalizeReminderDays([0, 7, 3, 7, 1]), [7, 3, 1, 0]);
});

test('rejeita lembretes invalidos', () => {
    const { normalizeReminderDays } = require('../utils/calendarSettings');
    for (const value of [[], [1, 2, 3, 4, 5, 6], [1.5], [-1], [29]]) {
        assert.throws(() => normalizeReminderDays(value));
    }
});

test('banco possui persistencia segura e idempotente do calendario', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'database.js'), 'utf8');
    assert.match(source, /CREATE TABLE IF NOT EXISTS calendar_integrations/);
    assert.match(source, /encrypted_refresh_token/);
    assert.match(source, /google_client_id/);
    assert.match(source, /encrypted_client_secret/);
    assert.match(source, /oauth_redirect_uri/);
    assert.match(source, /CREATE TABLE IF NOT EXISTS calendar_oauth_sessions/);
    assert.match(source, /expires_at/);
    assert.match(source, /CREATE TABLE IF NOT EXISTS order_calendar_events/);
    assert.match(source, /UNIQUE\s*\(tenant_key, order_id\)/);
    assert.match(source, /desired_operation/);
    assert.match(source, /retry_count/);
    assert.match(source, /event_id/);
    assert.match(source, /order_snapshot_json/);
});
