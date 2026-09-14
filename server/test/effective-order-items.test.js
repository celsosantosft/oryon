const test = require('node:test');
const assert = require('node:assert/strict');

const { chooseEffectiveOrderItems } = require('../utils/effectiveOrderItems');

test('uses the newer quote list for an already converted order', () => {
    const orderItems = [
        { player_name: 'BRUNO', player_number: '10', size: 'M', created_at: '2026-09-02 12:58:39' }
    ];
    const quoteItems = [
        { player_name: 'VITORIA', player_number: '20', size: 'P', created_at: '2026-09-12 13:32:43' },
        { player_name: 'BRUNO G.', player_number: '10', size: 'M', created_at: '2026-09-12 13:32:43' }
    ];

    assert.deepEqual(chooseEffectiveOrderItems(orderItems, quoteItems), quoteItems);
});

test('keeps the order list when it is the newest source', () => {
    const orderItems = [
        { player_name: 'LISTA NOVA', player_number: '7', size: 'G', created_at: '2026-09-13 09:00:00' }
    ];
    const quoteItems = [
        { player_name: 'LISTA ANTIGA', player_number: '8', size: 'P', created_at: '2026-09-12 13:32:43' }
    ];

    assert.deepEqual(chooseEffectiveOrderItems(orderItems, quoteItems), orderItems);
});
