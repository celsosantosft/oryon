const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const sqlite3 = require('sqlite3');

test('os relatórios e a lista conciliam pelo pagamento, conservando baixas sem data para conferência', async (t) => {
    const db = new sqlite3.Database(':memory:');
    const exec = (sql) => new Promise((resolve, reject) => db.exec(sql, err => err ? reject(err) : resolve()));
    await exec(`
        CREATE TABLE orders (id INTEGER PRIMARY KEY, status TEXT);
        CREATE TABLE cost_centers (id INTEGER PRIMARY KEY, name TEXT);
        CREATE TABLE chart_of_accounts (id INTEGER PRIMARY KEY, name TEXT, type TEXT);
        CREATE TABLE financial_accounts (id INTEGER PRIMARY KEY, name TEXT, color TEXT, is_default INTEGER);
        CREATE TABLE transactions (id INTEGER PRIMARY KEY, type TEXT, status TEXT, amount REAL,
            due_date TEXT, payment_date TEXT, order_id INTEGER, cost_center_id INTEGER, chart_of_account_id INTEGER,
            description TEXT, payment_method TEXT);
        INSERT INTO transactions (id, type, status, amount, due_date, payment_date) VALUES
            (1, 'Despesa', 'Pago', 30, '2026-03-10', NULL),
            (2, 'Receita', 'Pago', 200, '2026-03-10', '2026-03-20'),
            (3, 'Despesa', 'Pago', 70, '2026-03-10', '2026-04-09'),
            (4, 'Despesa', 'Pendente', 40, '2026-03-11', NULL),
            (5, 'Receita', 'Pago', 80, '2026-03-02', '2026-02-30');
    `);
    t.after(() => new Promise(resolve => db.close(resolve)));
    require.cache[require.resolve('../database')] = { exports: db };
    const pass = (req, res, next) => next();
    require.cache[require.resolve('../middlewares/auth')] = { exports: { authenticateToken: pass, authorizeRole: () => pass } };
    const app = express();
    app.use(require('../routes/finance'));
    const server = await new Promise(resolve => {
        const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    t.after(() => new Promise(resolve => server.close(resolve)));
    const get = async (url) => {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/finance/${url}`);
        const data = await response.json();
        assert.equal(response.status, 200, JSON.stringify(data));
        return data;
    };
    const period = 'start_date=2026-03-01&end_date=2026-03-31';
    const list = await get('transactions');
    assert.deepEqual(list.filter(row => row.movement_date === null).map(row => row.id), [1, 5]);
    assert.deepEqual((await get(`transactions?${period}`)).map(row => row.id), [4, 2]);
    assert.deepEqual((await get('transactions?status=Pago&start_date=2026-04-01')).map(row => row.id), [3]);
    const cash = await get(`cash-summary?${period}`);
    assert.equal(cash.variacao_caixa, 200);
    assert.deepEqual(cash.undated, { count: 2, income: 80, expense: 30 });
    const annual = await get('cash-summary');
    assert.deepEqual(annual.monthlyData, [
        { name: '2026-03', Receitas: 200, Despesas: 0 }, { name: '2026-04', Receitas: 0, Despesas: 70 }
    ]);
    assert.equal(annual.despesas, 70);
    assert.equal(annual.categoryData[0].total, 70);
    assert.equal((await get('dre')).lucro_operacional, 130);
    assert.equal((await get(`expense-report?${period}`)).summary.paid, 0);
    const expenses = await get('expense-report');
    assert.equal(expenses.summary.paid, 70);
    assert.equal(expenses.summary.pending, 40);
    await exec("UPDATE transactions SET payment_date = '2026-03-20' WHERE id = 1");
    assert.equal((await get(`expense-report?${period}`)).summary.paid, 30);
    const updated = await get(`cash-summary?${period}`);
    assert.equal(updated.variacao_caixa, 170);
    assert.deepEqual(updated.undated, { count: 1, income: 80, expense: 0 });
});
