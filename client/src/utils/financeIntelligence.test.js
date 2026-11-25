import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPresetRange, calculateMarketingInsights, calculateRangeInsights, getDisplayDate } from './financeIntelligence.js';

test('sinais parciais contam uma vez por pedido e só as despesas vinculadas contam na cobertura', () => {
    const transactions = [
        { type: 'Receita', order_id: 1, amount: 200 },
        { type: 'Receita', order_id: 1, amount: 100 },
        { type: 'Receita', order_id: 2, amount: 700 },
        { type: 'Despesa', order_id: 2, amount: 50 },
        { type: 'Despesa', order_id: 3, amount: 600 },
        { type: 'Despesa', amount: 50 },
        { type: 'Receita', amount: 400 }
    ];
    const range = calculateRangeInsights(transactions, 10);
    const report = calculateMarketingInsights(transactions, [transactions[5]], range, 10, 12);
    assert.equal(report.paidOrderCount, 2);
    assert.equal(report.ordersWithLinkedExpenses, 1);
    assert.equal(report.orderRevenue, 1000);
    assert.equal(report.averageRevenuePerOrder, 500);
    assert.equal(report.receiptsPerMarketingReal, 20);
    assert.equal(report.projectedBudget, 120);
    assert.equal(report.currentDailyMarketing, 5);
    const empty = calculateMarketingInsights([], [], calculateRangeInsights([], 10), 10, 12);
    assert.equal(empty.receiptsPerMarketingReal, null);
    assert.equal(empty.averageRevenuePerOrder, null);
    assert.equal(calculateRangeInsights([transactions[3]], 10).cashChangePercent, null);
});

test('o histórico não atribui baixas sem data válida ao mês de vencimento', () => {
    assert.equal(getDisplayDate({ status: 'Pago', movement_date: null, payment_date: '2026-02-30', due_date: '2026-01-02' }), '');
    assert.equal(getDisplayDate({ status: 'Pago', due_date: '2026-01-02' }), '');
    assert.equal(getDisplayDate({ status: 'Pendente', due_date: '2026-01-02' }), '2026-01-02');
});

test('os filtros usam o mesmo dia financeiro da baixa no fechamento do mês em Fortaleza', () => {
    const now = new Date('2026-12-01T00:30:00Z');
    assert.deepEqual(buildPresetRange('current-month', now), { startDate: '2026-11-01', endDate: '2026-11-30' });
    assert.deepEqual(buildPresetRange('last-30', now), { startDate: '2026-11-01', endDate: '2026-11-30' });
});
