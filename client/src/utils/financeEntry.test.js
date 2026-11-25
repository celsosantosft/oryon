import test from 'node:test';
import assert from 'node:assert/strict';
import { financeDay, seriesRequestId } from './financeEntry.js';

test('settlements use the Fortaleza day on the last evening of a month', () => {
    assert.equal(financeDay(new Date('2026-12-01T02:59:59Z')), '2026-11-30');
    assert.equal(financeDay(new Date('2026-12-01T03:00:00Z')), '2026-12-01');
});

test('an unacknowledged form submission keeps its request id, while a new submission gets its own', () => {
    const data = new Map();
    const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
    const entries = [{ description: 'Parcela', amount: 125.25 }];
    const first = seriesRequestId(storage, 'form', entries);
    assert.equal(seriesRequestId(storage, 'form', JSON.parse(JSON.stringify(entries))), first);
    assert.notEqual(seriesRequestId(storage, 'form', [{ ...entries[0], amount: 22 }]), first);
    data.clear();
    assert.notEqual(seriesRequestId(storage, 'form', entries), first);
});
