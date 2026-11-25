const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const express = require('express');
const jwt = require('jsonwebtoken');
const { financeQueries } = require('../utils/financeWrite');

test('pedido, recibo, cancelamento e reconversão conservam os pagamentos da mesma venda', async t => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'oryon-order-finance-'));
    Object.assign(process.env, {
        APP_DATA_DIR: dir, APP_DATABASE_PATH: path.join(dir, 'test.db'), APP_UPLOADS_DIR: path.join(dir, 'uploads'),
        NODE_ENV: 'test', ADMIN_PASSWORD: '', JWT_SECRET: 'order-finance-test-secret'
    });
    const db = require('../database');
    await db.ready;
    const tx = financeQueries(db);
    const app = express();
    app.use(express.json());
    app.use(require('../routes/orders'), require('../routes/quotes'), require('../routes/finance'), require('../routes/reverterPedidoParaOrcamento').router);
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    t.after(async () => {
        await new Promise(resolve => server.close(resolve));
        await new Promise(resolve => db.close(resolve));
        await rm(dir, { recursive: true, force: true });
    });
    await tx.run("INSERT INTO users(id,name,email,password,role) VALUES(9001,'Teste','test@example.invalid','x','admin')");
    const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt.sign({ id: 9001 }, process.env.JWT_SECRET) };
    async function request(method, route, data, status = 200) {
        const response = await fetch('http://127.0.0.1:' + server.address().port + route,
            { method, headers, body: data && JSON.stringify(data) });
        const result = await response.json();
        assert.equal(response.status, status, JSON.stringify(result));
        return result;
    }
    const pedido = { client_name: 'Cliente sem telefone', product_type: 'Camisa', sizes_json: { M: 1 }, unit_price: 1000, amount_paid: 300, delivery_date: '2026-11-30' };
    const created = await request('POST', '/api/orders', pedido);
    const code = encodeURIComponent(created.tracking_code);
    const { id } = await tx.get('SELECT id FROM orders WHERE tracking_code=?', [created.tracking_code]);
    const paid = await tx.get("SELECT id FROM transactions WHERE order_id=? AND status='Pago'", [id]);
    const pending = await tx.get("SELECT id, amount FROM transactions WHERE order_id=? AND status='Pendente'", [id]);
    assert.equal(pending.amount, 700);
    await tx.run("UPDATE transactions SET payment_date='2026-10-10', payment_method='Pix' WHERE id=?", [paid.id]);
    await request('PUT', '/api/finance/transactions/' + pending.id + '/pay', { payment_date: '2026-11-04', paid_amount: 200 });
    await request('PUT', '/api/orders/' + id, pedido);
    await request('POST', '/api/orders/' + code + '/status', { new_status: 'Corte Iniciado' });
    await request('POST', '/api/orders/' + code + '/convert-to-quote', {}, 409);
    const receipt = await request('GET', '/api/orders/' + code + '/history');
    assert.equal(receipt.received_total, 500);
    assert.equal(receipt.amount_paid, 300);
    assert.equal((await tx.get("SELECT SUM(amount) AS amount FROM transactions WHERE order_id=? AND status='Pendente'", [id])).amount, 500);
    await request('POST', '/api/orders/' + code + '/status', { new_status: 'Cancelado' });
    await request('DELETE', '/api/orders/' + id, null, 409);
    assert.deepEqual(await tx.get('SELECT payment_date,payment_method,amount FROM transactions WHERE id=?', [paid.id]),
        { payment_date: '2026-10-10', payment_method: 'Pix', amount: 300 });
    assert.equal((await tx.get("SELECT SUM(amount) AS amount FROM transactions WHERE order_id=? AND status='Pago'", [id])).amount, 500);

    // Old ledgers can contain a full paid line instead of a distinct deposit,
    // or have a balance split by hand. Changing stage must respect both.
    const legacy = await request('POST', '/api/orders', pedido);
    const legacyCode = encodeURIComponent(legacy.tracking_code);
    const legacyId = (await tx.get('SELECT id FROM orders WHERE tracking_code=?', [legacy.tracking_code])).id;
    await tx.run("UPDATE transactions SET description='Pedido legado',amount=400 WHERE order_id=? AND status='Pago'", [legacyId]);
    await tx.run("INSERT INTO transactions(description,type,status,amount,due_date,order_id) VALUES('Parcela manual','Receita','Pendente',250,'2026-12-15',?)", [legacyId]);
    await request('POST', '/api/orders/' + legacyCode + '/status', { new_status: 'Corte Iniciado' });
    await request('POST', '/api/orders/' + legacyCode + '/status', { new_status: 'Corte Iniciado' });
    assert.deepEqual(await tx.all("SELECT amount,due_date FROM transactions WHERE order_id=? AND status='Pendente' ORDER BY id", [legacyId]), [
        { amount: 350, due_date: pedido.delivery_date }, { amount: 250, due_date: '2026-12-15' }
    ]);
    assert.equal((await request('GET', '/api/orders/' + legacyCode + '/history')).received_total, 400);
    await request('PUT', '/api/orders/' + legacyId, { ...pedido, amount_paid: 450 }, 409);
    assert.equal((await tx.get('SELECT amount_paid FROM orders WHERE id=?', [legacyId])).amount_paid, 300);

    // Some old orders only recorded the deposit on the order, but retained an
    // identifiable subsequent payment and a partially outstanding installment.
    await tx.run("UPDATE transactions SET description='Falta Pagar - Pedido legado',amount=200 WHERE order_id=? AND status='Pago'", [legacyId]);
    await tx.run("UPDATE transactions SET status='Parcial' WHERE order_id=? AND description='Parcela manual'", [legacyId]);
    await request('POST', '/api/orders/' + legacyCode + '/status', { new_status: 'Corte Iniciado' });
    await request('POST', '/api/orders/' + legacyCode + '/status', { new_status: 'Corte Iniciado' });
    assert.equal((await request('GET', '/api/orders/' + legacyCode + '/history')).received_total, 500);
    assert.deepEqual(await tx.all("SELECT status,amount FROM transactions WHERE order_id=? AND status<>'Pago' ORDER BY id", [legacyId]), [
        { status: 'Pendente', amount: 250 }, { status: 'Parcial', amount: 250 }
    ]);

    await request('POST', '/api/quotes', pedido);
    const quote = await tx.get('SELECT id,tracking_code FROM quotes ORDER BY id DESC LIMIT 1');
    const approvals = await Promise.all([1, 2].map(() => request('POST', '/api/quotes/' + quote.id + '/convert', {})));
    assert.equal(approvals[0].tracking_code, approvals[1].tracking_code);
    assert.equal(approvals.filter(row => row.already_exists).length, 1);
    const converted = await tx.get('SELECT id FROM orders WHERE quote_id=?', [quote.id]);
    const deposit = await tx.get("SELECT id FROM transactions WHERE order_id=? AND status='Pago'", [converted.id]);
    await request('POST', '/api/quotes/' + encodeURIComponent(quote.tracking_code) + '/reset', {}, 409);
    await request('POST', '/orders/' + converted.id + '/reverter-para-orcamento', {});
    await request('POST', '/api/quotes/' + quote.id + '/convert', {});
    await request('POST', '/api/quotes/' + quote.id + '/convert', {});
    assert.deepEqual(await tx.all("SELECT id,amount FROM transactions WHERE order_id=? AND status='Pago'", [converted.id]), [{ id: deposit.id, amount: 300 }]);
    assert.deepEqual(await tx.all("SELECT id,status FROM orders WHERE quote_id=?", [quote.id]), [{ id: converted.id, status: 'Criação de Arte' }]);
    assert.deepEqual(await tx.all("SELECT amount FROM transactions WHERE order_id=? AND status='Pendente'", [converted.id]), [{ amount: 700 }]);
});
