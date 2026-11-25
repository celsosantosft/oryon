const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sqlite3 = require('sqlite3');
const { financeQueries } = require('../utils/financeWrite');
const { settleAccounts, recordSeries } = require('../utils/financeSettlements');

async function fixture(t) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oryon-settlements-'));
    const file = path.join(dir, 'test.db');
    const db = new sqlite3.Database(file);
    t.after(async () => {
        await new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
        fs.rmSync(dir, { recursive: true, force: true });
    });
    const queries = financeQueries(db);
    const schema = fs.readFileSync(path.resolve(__dirname, '../database.js'), 'utf8');
    await queries.run('CREATE TABLE orders(id INTEGER PRIMARY KEY, status TEXT)');
    await queries.run('CREATE TABLE cost_centers(id INTEGER PRIMARY KEY)');
    await queries.run('CREATE TABLE chart_of_accounts(id INTEGER PRIMARY KEY)');
    for (const table of ['transactions', 'finance_series_receipts']) {
        await queries.run(schema.match(new RegExp('CREATE TABLE IF NOT EXISTS ' + table + ' \\([\\s\\S]*?\\)\x60'))[0].slice(0,-1));
    }
    return { file, ...queries };
}

const date = '2026-11-30';
const payment = { payment_date: date, payment_method: 'PIX' };
const entries = [1,2,3].map(n => ({
    description: 'Parcela ' + n, type: 'Despesa', status: 'Pendente', due_date: date, amount: 300
}));
const series = { request_id: 'test-series-1234567', entries };

test('a failed installment rolls back every row and receipt; concurrent retries commit only one series', async t => {
    const db = await fixture(t);
    const broken = entries.map((item, i) => i === 1 ? { ...item, chart_of_account_id: 99 } : item);
    await assert.rejects(recordSeries(db.file, 1, { ...series, entries: broken }), /FOREIGN KEY/);
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM transactions')).n, 0);
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM finance_series_receipts')).n, 0);
    const results = await Promise.all(Array.from({ length: 12 }, () => recordSeries(db.file, 1, series)));
    assert.equal(results.filter(r => !r.replay).length, 1);
    assert.deepEqual(await db.get('SELECT COUNT(*) AS n, SUM(amount) AS total FROM transactions'), { n: 3, total: 900 });
    await assert.rejects(recordSeries(db.file, 1, { ...series, entries: [entries[0]] }), { status: 409 });
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM transactions')).n, 3);
});

test('partial settlement preserves cents, due date and category and cannot be applied twice', async t => {
    const db = await fixture(t);
    await db.run("INSERT INTO chart_of_accounts VALUES (7)");
    await db.run("INSERT INTO transactions(description,type,status,amount,due_date,chart_of_account_id) VALUES ('P','Despesa','Pendente',100.12,?,7)", [date]);
    const attempts = await Promise.allSettled([1,2].map(() => settleAccounts(db.file,[1],{ ...payment, paid_amount: 30.09 },true)));
    assert.equal(attempts.filter(x => x.status === 'fulfilled').length, 1);
    assert.deepEqual(await db.all('SELECT amount, status, payment_date, due_date, chart_of_account_id FROM transactions ORDER BY id'), [
        { amount: 30.09, status: 'Pago', payment_date: date, due_date: date, chart_of_account_id: 7 },
        { amount: 70.03, status: 'Pendente', payment_date: null, due_date: date, chart_of_account_id: 7 }
    ]);
    await assert.rejects(settleAccounts(db.file, [2], { payment_date: '2026-02-30' }), { status: 400 });
    await settleAccounts(db.file,[2],payment,true);
    assert.deepEqual(await db.get("SELECT ROUND(SUM(amount),2) AS total FROM transactions WHERE status='Pago'"),{ total:100.12 });
});

test('a stale open order cannot be settled individually or in batch after cancellation or archiving', async t => {
    const db = await fixture(t);
    await db.run("INSERT INTO orders VALUES (1,'Em Produção')");
    await db.run("INSERT INTO transactions(description,type,status,amount,due_date,order_id) VALUES ('R','Receita','Pendente',80,?,1), ('D','Despesa','Pendente',25,?,1)", [date,date]);
    for (const state of ['Cancelado','Arte Arquivada']) {
        await db.run('UPDATE orders SET status=? WHERE id=1',[state]);
        await assert.rejects(settleAccounts(db.file,[1],{ ...payment, paid_amount: 30 },true), { status:409 });
        await assert.rejects(settleAccounts(db.file,[1,2],payment),{ status:409 });
        assert.deepEqual(await db.get("SELECT COUNT(*) AS n FROM transactions WHERE status='Pendente'"),{ n:2 });
    }
    await settleAccounts(db.file,[2],payment);
    assert.equal((await db.get('SELECT status FROM transactions WHERE id=2')).status,'Pago');
});

test('only pending and partial accounts can be settled', async t => {
    const db = await fixture(t);
    await db.run("INSERT INTO transactions(description,type,status,amount,due_date) VALUES ('A','Despesa','Estornado',10,?), ('B','Receita','Parcial',15,?)", [date,date]);
    await assert.rejects(settleAccounts(db.file,[1],payment,true), { status:409 });
    await assert.rejects(settleAccounts(db.file,[2,1],payment), { status:409 });
    assert.equal((await db.get('SELECT status FROM transactions WHERE id=1')).status, 'Estornado');
    await settleAccounts(db.file,[2],payment,true);
    assert.equal((await db.get('SELECT status FROM transactions WHERE id=2')).status, 'Pago');
});
