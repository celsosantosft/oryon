const test = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3').verbose();

const {
    ACTIVE_RECEIVABLE_FILTER_SQL,
    normalizeBatchTransactionIds
} = require('../utils/financeTransactions');

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, (error) => error ? reject(error) : resolve());
    });
}

function all(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
    });
}

test('normalizes transaction ids for a batch settlement', () => {
    assert.deepEqual(normalizeBatchTransactionIds(['7', 7, 3, 0, 'x', -2]), [7, 3]);
});

test('hides only pending receivables from canceled or archived orders', async () => {
    const db = new sqlite3.Database(':memory:');
    await run(db, 'CREATE TABLE orders (id INTEGER PRIMARY KEY, status TEXT)');
    await run(db, 'CREATE TABLE transactions (id INTEGER PRIMARY KEY, order_id INTEGER, type TEXT, status TEXT)');

    await run(db, "INSERT INTO orders (id, status) VALUES (1, 'Em Produção'), (2, 'Cancelado'), (3, 'Arte Arquivada')");
    await run(db, `INSERT INTO transactions (id, order_id, type, status) VALUES
        (10, 1, 'Receita', 'Pendente'),
        (11, 2, 'Receita', 'Pendente'),
        (12, 2, 'Receita', 'Pago'),
        (13, 3, 'Receita', 'Pendente'),
        (14, 2, 'Despesa', 'Pendente'),
        (15, NULL, 'Receita', 'Pendente')`);

    const rows = await all(db, `
        SELECT t.id
        FROM transactions t
        LEFT JOIN orders o ON t.order_id = o.id
        WHERE 1=1
        ${ACTIVE_RECEIVABLE_FILTER_SQL}
        ORDER BY t.id
    `);

    assert.deepEqual(rows.map((row) => row.id), [10, 12, 14, 15]);
    await new Promise((resolve) => db.close(resolve));
});
