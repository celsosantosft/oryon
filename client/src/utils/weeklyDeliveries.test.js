import test from 'node:test';
import assert from 'node:assert/strict';

import { buildWeeklyDeliveryView, getDeliveryFinancialSummary } from './weeklyDeliveries.js';

test('shows overdue and next seven days first while counting later deliveries', () => {
    const orders = [
        { id: 4, delivery_date: '2026-09-21', status: 'Costura Iniciada' },
        { id: 2, delivery_date: '2026-09-13', status: 'Pronto para Envio' },
        { id: 5, delivery_date: '2026-09-15', status: 'Entregue/Concluído' },
        { id: 1, delivery_date: '2026-09-10', status: 'Controle de Qualidade' },
        { id: 3, delivery_date: '2026-09-20', status: 'Corte Iniciado' },
        { id: 6, delivery_date: null, status: 'Costura Iniciada' }
    ];

    const collapsed = buildWeeklyDeliveryView(orders, new Date(2026, 8, 13), false);
    const expanded = buildWeeklyDeliveryView(orders, new Date(2026, 8, 13), true);

    assert.deepEqual(collapsed.orders.map(({ id }) => id), [1, 2, 3]);
    assert.equal(collapsed.remainingCount, 1);
    assert.deepEqual(expanded.orders.map(({ id }) => id), [1, 2, 3, 4]);
    assert.equal(expanded.remainingCount, 0);
});

test('uses synchronized payment when calculating the outstanding amount', () => {
    assert.deepEqual(getDeliveryFinancialSummary({
        total_price: 1200,
        amount_paid: 300,
        synced_amount_paid: 450
    }), {
        total: 1200,
        paid: 450,
        remaining: 750
    });
});
