const DEPOSIT_PREFIX = 'Sinal/Pago - Pedido ';
const BALANCE_PREFIX = 'Falta Pagar - Pedido ';
const cents = amount => Math.round((Number(amount || 0) + Number.EPSILON) * 100);
const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit' });

function receivedTotalExpression(alias) {
    const deposit = `CAST(COALESCE(${alias}.amount_paid, 0) AS REAL)`;
    // A legacy order may have its deposit only on the order. A settled "Falta Pagar"
    // is explicitly a later installment; other legacy receipts may include the deposit.
    return `(SELECT ROUND(MAX(
        COALESCE(SUM(t.amount), 0),
        ${deposit} + CASE WHEN COUNT(CASE WHEN t.description LIKE '${DEPOSIT_PREFIX}%' THEN 1 END) = 0
            THEN COALESCE(SUM(CASE WHEN t.description LIKE '${BALANCE_PREFIX}%' THEN t.amount ELSE 0 END), 0)
            ELSE 0 END
    ), 2) FROM transactions t
    WHERE t.order_id = ${alias}.id AND t.type = 'Receita' AND t.status = 'Pago')`;
}

// Called inside the same transaction as the order change. Only an explicit
// change to the deposit field may create or correct a paid movement.
async function syncOrderFinance(tx, orderId, { depositChanged = false, previousDelivery } = {}) {
    const o = await tx.get('SELECT status, tracking_code, client_name, total_price, amount_paid, delivery_date FROM orders WHERE id=?', [orderId]);
    if (!o) return;

    const rows = await tx.all("SELECT id, description, status, amount, due_date FROM transactions WHERE order_id=? AND type='Receita' ORDER BY id", [orderId]);
    const paid = rows.filter(r => r.status === 'Pago');
    const deposits = paid.filter(r => r.description.startsWith(DEPOSIT_PREFIX));
    const deposit = Math.max(0, cents(o.amount_paid));
    const today = localDate.format(new Date());
    const suffix = o.tracking_code + (o.client_name ? ' - ' + o.client_name : '');

    if (depositChanged) {
        if (deposits.length > 1 || (!deposits.length && paid.some(r => !r.description.startsWith(BALANCE_PREFIX)))) {
            throw Object.assign(new Error('Confira os recebimentos vinculados no Financeiro antes de alterar o sinal.'), { status: 409 });
        }
        const existing = deposits[0];
        if (existing && cents(existing.amount) !== deposit) {
            if (deposit === 0) await tx.run('DELETE FROM transactions WHERE id=?', [existing.id]);
            else await tx.run('UPDATE transactions SET amount=? WHERE id=?', [deposit / 100, existing.id]);
        } else if (!existing && deposit > 0) {
            await tx.run("INSERT INTO transactions(description,type,status,amount,due_date,payment_date,order_id) VALUES (?,'Receita','Pago',?,?,?,?)",
                [DEPOSIT_PREFIX + suffix, deposit / 100, today, today, orderId]);
        }
    }

    if (['Cancelado', 'Arte Arquivada'].includes(o.status)) return;
    const { received } = await tx.get(`SELECT ${receivedTotalExpression('o')} AS received FROM orders o WHERE id=?`, [orderId]);
    const pending = rows.filter(r => r.status === 'Pendente' || r.status === 'Parcial');
    const automatic = pending.find(r => r.status === 'Pendente' && r.description.startsWith(BALANCE_PREFIX));
    const otherPending = pending.reduce((sum, r) => sum + (r === automatic ? 0 : cents(r.amount)), 0);
    const residual = Math.max(0, cents(o.total_price) - cents(received) - otherPending);
    const due = o.delivery_date || today;
    if (!automatic) {
        if (residual > 0) await tx.run("INSERT INTO transactions(description,type,status,amount,due_date,order_id) VALUES (?,'Receita','Pendente',?,?,?)",
            [BALANCE_PREFIX + suffix, residual / 100, due, orderId]);
    } else if (residual === 0) {
        await tx.run('DELETE FROM transactions WHERE id=?', [automatic.id]);
    } else {
        const dueDate = previousDelivery === automatic.due_date ? due : automatic.due_date;
        if (residual !== cents(automatic.amount) || dueDate !== automatic.due_date) {
            await tx.run('UPDATE transactions SET amount=?, due_date=? WHERE id=?', [residual / 100, dueDate, automatic.id]);
        }
    }
}

async function deleteUnpaidOrder(tx, id) {
    const paid = await tx.get(`SELECT id FROM orders WHERE id=? AND (COALESCE(amount_paid,0)>0 OR EXISTS (
        SELECT 1 FROM transactions WHERE order_id=orders.id AND status='Pago'
    ))`, [id]);
    if (paid) throw Object.assign(new Error('O pedido tem pagamentos registrados. Cancele o pedido para preservar o histórico financeiro.'), { status: 409 });
    await tx.run('DELETE FROM order_history WHERE order_id=?', [id]);
    await tx.run('DELETE FROM transactions WHERE order_id=?', [id]);
    await tx.run("DELETE FROM order_items WHERE order_id=? AND (reference_type='order' OR reference_type IS NULL)", [id]);
    await tx.run('DELETE FROM order_product_lines WHERE order_id=?', [id]);
    await tx.run('DELETE FROM orders WHERE id=?', [id]);
}

module.exports = { receivedTotalExpression, syncOrderFinance, deleteUnpaidOrder };
