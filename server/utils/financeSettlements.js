const { createHash } = require('node:crypto');
const { ACTIVE_RECEIVABLE_FILTER_SQL, normalizeBatchTransactionIds } = require('./financeTransactions');
const { withFinanceWrite } = require('./financeWrite');

function financeError(status, message) {
    return Object.assign(new Error(message), { status });
}

function isDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00Z');
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isMoney(value) {
    return Number.isFinite(value) && value > 0 && Number.isSafeInteger(Math.round(value * 100))
        && Number(value.toFixed(2)) === value;
}

async function recordSeries(path, userId, { request_id: key, entries }) {
    if (typeof key !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(key)
        || !Array.isArray(entries) || !entries.length || entries.length > 60) {
        throw financeError(400, 'Informe uma série de 1 a 60 lançamentos.');
    }
    const rows = entries.map(entry => {
        if (!entry || typeof entry.description !== 'string' || !entry.description.trim()
            || !['Receita', 'Despesa'].includes(entry.type) || !['Pendente', 'Pago'].includes(entry.status)
            || !isMoney(entry.amount) || !isDate(entry.due_date)
            || (entry.status === 'Pago' && !isDate(entry.payment_date))) {
            throw financeError(400, 'Revise o valor, a descrição e as datas de cada lançamento.');
        }
        return [entry.description.trim(), entry.type, entry.status, entry.amount, entry.due_date,
            entry.status === 'Pago' ? entry.payment_date : null, entry.cost_center_id || null, entry.chart_of_account_id || null];
    });
    const hash = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
    return withFinanceWrite(path, async ({ get, run }) => {
        const receipt = await get('SELECT payload_hash FROM finance_series_receipts WHERE user_id = ? AND request_id = ?', [userId, key]);
        if (receipt) {
            if (receipt.payload_hash !== hash) throw financeError(409, 'A série já foi registrada com dados diferentes.');
            return { count: rows.length, replay: true };
        }
        for (const row of rows) {
            await run(`INSERT INTO transactions (description, type, status, amount, due_date, payment_date, cost_center_id, chart_of_account_id)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, row);
        }
        await run('INSERT INTO finance_series_receipts (user_id, request_id, payload_hash) VALUES (?, ?, ?)', [userId, key, hash]);
        return { count: rows.length, replay: false };
    });
}

async function settleAccounts(path, ids, { payment_date, payment_method, paid_amount }, single = false) {
    if (!Array.isArray(ids) || !ids.length || ids.length > 500 || ids.some(id => !Number.isInteger(Number(id)) || Number(id) <= 0)) {
        throw financeError(400, 'Selecione de 1 a 500 contas válidas para dar baixa.');
    }
    if (!isDate(payment_date)) throw financeError(400, 'Informe uma data válida para a baixa.');
    const uniqueIds = normalizeBatchTransactionIds(ids);
    const slots = uniqueIds.map(() => '?').join(', ');
    const method = typeof payment_method === 'string' ? payment_method.trim() || null : null;
    return withFinanceWrite(path, async ({ run, all }) => {
        const rows = await all(`SELECT t.* FROM transactions t LEFT JOIN orders o ON t.order_id = o.id
                                WHERE t.id IN (${slots}) AND t.status IN ('Pendente','Parcial') ${ACTIVE_RECEIVABLE_FILTER_SQL}`, uniqueIds);
        if (rows.length !== uniqueIds.length) {
            throw financeError(409, 'Conta indisponível para baixa. Verifique se já foi paga ou se o pedido foi cancelado ou arquivado.');
        }
        if (single && paid_amount !== undefined && paid_amount !== null && paid_amount !== '') {
            const transaction = rows[0];
            const paid = Number(paid_amount);
            if (!isMoney(paid) || paid > transaction.amount) throw financeError(400, 'Informe um valor válido que não exceda o saldo pendente.');
            const remainder = Number((transaction.amount - paid).toFixed(2));
            if (remainder > 0) {
                await run("UPDATE transactions SET status = 'Pago', amount = ?, payment_date = ?, payment_method = ? WHERE id = ?",
                    [paid, payment_date, method, transaction.id]);
                await run(`INSERT INTO transactions (description, type, status, amount, due_date, order_id, cost_center_id, chart_of_account_id)
                           VALUES (?, ?, 'Pendente', ?, ?, ?, ?, ?)`, [transaction.description, transaction.type, remainder, transaction.due_date,
                    transaction.order_id, transaction.cost_center_id, transaction.chart_of_account_id]);
                return { count: 1, message: 'Baixa parcial registrada com sucesso!' };
            }
        }
        await run(`UPDATE transactions SET status = 'Pago', payment_date = ?, payment_method = ? WHERE id IN (${slots})`,
            [payment_date, method, ...uniqueIds]);
        return { count: rows.length, message: single ? 'Transação baixada com sucesso!' : `${rows.length} conta(s) baixada(s) com sucesso!` };
    });
}

module.exports = { isDate, recordSeries, settleAccounts };
