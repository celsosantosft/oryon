import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCalendarReminderInputs, getCalendarConnectionTone } from './calendarIntegration.js';

test('normaliza os dias de lembrete como o servidor', () => {
    assert.deepEqual(normalizeCalendarReminderInputs(['0', '7', '3', '7', '1']), [7, 3, 1, 0]);
    assert.throws(() => normalizeCalendarReminderInputs([]));
    assert.throws(() => normalizeCalendarReminderInputs([29]));
});

test('escolhe tom do estado da integracao', () => {
    assert.equal(getCalendarConnectionTone({ configured: false }), 'neutral');
    assert.equal(getCalendarConnectionTone({ configured: true, health: 'connected' }), 'success');
    assert.equal(getCalendarConnectionTone({ configured: true, health: 'reconnect_required' }), 'danger');
    assert.equal(getCalendarConnectionTone({ configured: true, health: 'connected', failed_count: 1 }), 'danger');
    assert.equal(getCalendarConnectionTone({ configured: true, pending_count: 2 }), 'warning');
});
