const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function source(file) {
    return fs.readFileSync(path.join(__dirname, '..', 'routes', file), 'utf8');
}

test('pedidos enfileiram sincronizacao sem bloquear a resposta', () => {
    const orders = source('orders.js');
    assert.match(orders, /enqueueCalendarUpsert\(orderId\)/);
    assert.match(orders, /enqueueCalendarUpsert\(req\.params\.id\)/);
    assert.match(orders, /enqueueCalendarDelete\(req\.params\.id\)/);
    assert.match(orders, /enqueueCalendarState\(order\.id\)/);
});

test('conversao e reversao cobrem o ciclo do calendario', () => {
    const quotes = source('quotes.js');
    const revert = source('reverterPedidoParaOrcamento.js');
    assert.match(quotes, /enqueueCalendarUpsert\(order\.id\)/);
    assert.match(quotes, /enqueueCalendarUpsert\(orderId\)/);
    assert.match(revert, /enqueueCalendarDelete\(order\.id\)/);
});
