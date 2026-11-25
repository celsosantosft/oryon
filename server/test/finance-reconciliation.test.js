const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');
const { randomUUID } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');

test('reconciling an undated payment puts it in the documented month exactly once', async (t) => {
    const dir = await mkdtemp(path.join(tmpdir(), 'oryon-cash-test-'));
    process.env.APP_DATA_DIR = dir;
    process.env.APP_DATABASE_PATH = path.join(dir, 'test.db');
    process.env.APP_UPLOADS_DIR = path.join(dir, 'uploads');
    process.env.JWT_SECRET = randomUUID();
    process.env.ADMIN_PASSWORD = '';
    const db = require('../database');
    await db.ready;
    const app = express();
    app.use(express.json());
    app.use('/api', require('../routes/finance'));
    const server = app.listen(0, '127.0.0.1');
    t.after(async () => {
        await promisify(server.close.bind(server))();
        await promisify(db.close.bind(db))();
        await rm(dir, { recursive: true, force: true });
    });
    const run = promisify(db.run.bind(db));
    await run("INSERT INTO users(id,name,email,password,role) VALUES (99991,'Financeiro','financeiro@example.test','disabled','admin')");
    await run(`INSERT INTO transactions(id, description, type, status, amount, due_date)
               VALUES (200, 'Despesa', 'Despesa', 'Pago', 123.45, '2026-03-31')`);
    const headers = {
        Authorization: 'Bearer ' + jwt.sign({ id: 99991 }, process.env.JWT_SECRET),
        'Content-Type': 'application/json'
    };
    const base = `http://127.0.0.1:${server.address().port}/api/api/finance`;
    const summary = async (bounds = '') => {
        const response = await fetch(base + '/cash-summary' + bounds, { headers });
        assert.equal(response.status, 200);
        return response.json();
    };
    const correct = (date) => fetch(base + '/transactions/200/payment-date', {
        method: 'PUT', headers, body: JSON.stringify({ payment_date: date })
    });

    assert.equal((await summary()).undated.expense, 123.45);
    assert.equal((await correct('2026-02-30')).status, 400);
    assert.equal((await correct('2026-04-02')).status, 200);
    assert.equal((await correct('2026-03-31')).status, 409);
    const after = await summary();
    assert.equal(after.undated.count, 0);
    assert.deepEqual(after.monthlyData, [{ name: '2026-04', Receitas: 0, Despesas: 123.45 }]);
    assert.equal((await summary('?start_date=2026-03-01&end_date=2026-03-31')).despesas, 0);
});
