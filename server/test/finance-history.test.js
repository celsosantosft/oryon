const test = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3');
const { promisify } = require('node:util');
const { RESTORE_MISSING_RECEIVABLES_SQL } = require('../utils/financeHistory');

test('restores only the missing balance, preserving dated installments and paid history on retries', async (t) => {
    const db = new sqlite3.Database(':memory:');
    const exec = promisify(db.exec.bind(db));
    const all = promisify(db.all.bind(db));
    t.after(() => promisify(db.close.bind(db))());
    await exec(`
        CREATE TABLE orders(id INTEGER PRIMARY KEY, tracking_code, client_name, delivery_date, status, total_price, amount_paid);
        CREATE TABLE transactions(id INTEGER PRIMARY KEY, description, type, status, amount, due_date, payment_date, order_id);
        INSERT INTO orders VALUES
            (1, 'A', 'A', '2026-11-10', 'Em Produção', 1000, 300),
            (2, 'B', 'B', '2026-11-10', 'Em Produção', 1000, 300),
            (3, 'C', 'C', '2026-11-10', 'Cancelado', 1000, 0),
            (4, 'D', 'D', '2026-11-10', 'Entregue/Concluído', 1000, 0),
            (5, 'E', 'E', '2026-11-10', 'Em Produção', 1000, 300),
            (6, 'F', 'F', '2026-11-10', 'Em Produção', 100, 0);
        INSERT INTO transactions VALUES
            (1, 'Sinal/Pago - Pedido A', 'Receita', 'Pago', 300, '2026-10-01', '2026-10-01', 1),
            (2, 'Parcela negociada', 'Receita', 'Pendente', 100, '2026-12-13', NULL, 1),
            (3, 'Fornecedor', 'Despesa', 'Pendente', 60, '2026-11-09', NULL, 1),
            (4, 'Sinal/Pago - Pedido B', 'Receita', 'Pago', 300, '2026-10-01', '2026-10-01', 2),
            (5, 'Parcela legada', 'Receita', 'Pago', 25, '2026-10-01', '2026-10-01', 5),
            (6, 'Pedido F - F', 'Receita', 'Pendente', 100, '2026-11-07', NULL, 6);
    `);
    const before = await all('SELECT * FROM transactions ORDER BY id');
    await exec(RESTORE_MISSING_RECEIVABLES_SQL);
    await exec(RESTORE_MISSING_RECEIVABLES_SQL);
    assert.deepEqual(await all('SELECT * FROM transactions WHERE id <= 6 ORDER BY id'), before);
    assert.deepEqual(await all('SELECT order_id, status, amount, payment_date FROM transactions WHERE id > 6 ORDER BY order_id'), [
        { order_id: 1, status: 'Pendente', amount: 600, payment_date: null },
        { order_id: 2, status: 'Pendente', amount: 700, payment_date: null }
    ]);
});
