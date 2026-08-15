const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, authorizeRole } = require('../middlewares/auth');

function ensureDefaultFinanceAccounts() {
    const defaults = [
        { name: 'Marketing', type: 'Despesa' }
    ];

    defaults.forEach(({ name, type }) => {
        db.get(
            `SELECT id FROM chart_of_accounts WHERE LOWER(name) = LOWER(?) AND type = ? LIMIT 1`,
            [name, type],
            (err, row) => {
                if (err || row) return;
                db.run(`INSERT INTO chart_of_accounts (name, type) VALUES (?, ?)`, [name, type]);
            }
        );
    });
}

ensureDefaultFinanceAccounts();

function ensureDefaultObjectiveAccounts() {
    const defaults = [
        { name: 'Santander', color: '#DC2626', is_default: 1 },
        { name: 'Nubank', color: '#7C3AED', is_default: 0 }
    ];

    defaults.forEach(({ name, color, is_default }) => {
        db.get(
            `SELECT id FROM financial_accounts WHERE LOWER(name) = LOWER(?) LIMIT 1`,
            [name],
            (err, row) => {
                if (err || row) return;
                db.run(`INSERT INTO financial_accounts (name, color, is_default) VALUES (?, ?, ?)`, [name, color, is_default]);
            }
        );
    });
}

ensureDefaultObjectiveAccounts();

function serializeObjectiveRows(rows, deposits) {
    const depositsByObjective = deposits.reduce((accumulator, deposit) => {
        if (!accumulator[deposit.objective_id]) accumulator[deposit.objective_id] = [];
        accumulator[deposit.objective_id].push({
            id: deposit.id,
            amount: Number(deposit.amount || 0),
            date: deposit.deposit_date,
            note: deposit.note || '',
            created_at: deposit.created_at
        });
        return accumulator;
    }, {});

    return rows.map((row) => ({
        id: row.id,
        template_key: row.template_key,
        name: row.name,
        description: row.description || '',
        target_amount: Number(row.target_amount || 0),
        initial_amount: Number(row.initial_amount || 0),
        due_date: row.due_date,
        color: row.color,
        icon_key: row.icon_key,
        status: row.status || 'active',
        financial_account_id: row.financial_account_id || null,
        account_name: row.account_name || '',
        account_color: row.account_color || '',
        created_at: row.created_at,
        updated_at: row.updated_at,
        deposits: depositsByObjective[row.id] || []
    }));
}

function fetchObjectivesResponse(res, objectiveId = null) {
    const params = [];
    let sql = `
        SELECT
            o.*,
            fa.name AS account_name,
            fa.color AS account_color
        FROM finance_objectives o
        LEFT JOIN financial_accounts fa ON fa.id = o.financial_account_id
    `;

    if (objectiveId) {
        sql += ` WHERE o.id = ?`;
        params.push(objectiveId);
    }

    sql += ` ORDER BY o.created_at DESC, o.id DESC`;

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length === 0) return res.json(objectiveId ? null : []);

        const ids = rows.map((row) => row.id);
        const placeholders = ids.map(() => '?').join(', ');

        db.all(
            `SELECT * FROM finance_objective_deposits WHERE objective_id IN (${placeholders}) ORDER BY deposit_date DESC, id DESC`,
            ids,
            (depositErr, deposits) => {
                if (depositErr) return res.status(500).json({ error: depositErr.message });
                const payload = serializeObjectiveRows(rows, deposits || []);
                res.json(objectiveId ? payload[0] || null : payload);
            }
        );
    });
}

function validateObjectivePayload(body) {
    const safeName = typeof body.name === 'string' ? body.name.trim() : '';
    const safeTargetAmount = Number(body.target_amount);
    const safeInitialAmount = Number(body.initial_amount || 0);
    const safeDueDate = body.due_date;
    const safeStatus = body.status || 'active';

    if (!safeName) return 'Nome do objetivo é obrigatório.';
    if (!Number.isFinite(safeTargetAmount) || safeTargetAmount <= 0) return 'Valor do objetivo inválido.';
    if (!Number.isFinite(safeInitialAmount) || safeInitialAmount < 0) return 'Valor inicial inválido.';
    if (!safeDueDate) return 'Data do objetivo é obrigatória.';
    if (!['active', 'completed'].includes(safeStatus)) return 'Status do objetivo inválido.';

    return null;
}

function validateObjectiveAccountPayload(body) {
    const safeName = typeof body.name === 'string' ? body.name.trim() : '';
    const safeColor = typeof body.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(body.color) ? body.color : '#2563EB';

    if (!safeName) return { error: 'Nome da conta é obrigatório.' };

    return {
        name: safeName,
        color: safeColor,
        is_default: body.is_default ? 1 : 0
    };
}

function setObjectiveAccountDefault(accountId, callback) {
    db.run(`UPDATE financial_accounts SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END`, [accountId], callback);
}

function fetchObjectiveAccountRow(accountId, callback) {
    db.get(`SELECT * FROM financial_accounts WHERE id = ?`, [accountId], callback);
}

function syncOrderAmountPaid(orderId, callback = () => {}) {
    const safeOrderId = Number(orderId);
    if (!Number.isInteger(safeOrderId) || safeOrderId <= 0) return callback(null);

    // amount_paid e o sinal digitado no pedido; baixas financeiras nao devem sobrescrever esse campo.
    callback(null);
}

function syncOrderAmounts(orderIds, callback = () => {}) {
    const uniqueIds = [...new Set((Array.isArray(orderIds) ? orderIds : [orderIds])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0))];

    if (uniqueIds.length === 0) return callback(null);

    let pending = uniqueIds.length;
    let finished = false;

    uniqueIds.forEach((orderId) => {
        syncOrderAmountPaid(orderId, (err) => {
            if (finished) return;
            if (err) {
                finished = true;
                return callback(err);
            }

            pending -= 1;
            if (pending === 0) {
                finished = true;
                callback(null);
            }
        });
    });
}

// ==========================================
// 0. OBJETIVOS E CONFIGURAÇÕES
// ==========================================
router.get('/api/finance/goal-settings', authenticateToken, (req, res) => {
    db.get(`SELECT revenue, revenue_annual, pieces, efficiency, updated_at FROM finance_goal_settings WHERE id = 1`, [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row || { revenue: 25000, revenue_annual: 300000, pieces: 500, efficiency: 95 });
    });
});

router.put('/api/finance/goal-settings', authenticateToken, authorizeRole(['admin', 'gerente']), (req, res) => {
    const revenue = Number(req.body.revenue);
    const revenueAnnual = Number(req.body.revenue_annual);
    const pieces = Number(req.body.pieces);
    const efficiency = Number(req.body.efficiency);

    if (!Number.isFinite(revenue) || revenue <= 0) return res.status(400).json({ error: 'Meta mensal inválida.' });
    if (!Number.isFinite(revenueAnnual) || revenueAnnual <= 0) return res.status(400).json({ error: 'Meta anual inválida.' });
    if (!Number.isFinite(pieces) || pieces <= 0) return res.status(400).json({ error: 'Meta de peças inválida.' });
    if (!Number.isFinite(efficiency) || efficiency <= 0) return res.status(400).json({ error: 'Meta de eficiência inválida.' });

    db.run(
        `
            INSERT INTO finance_goal_settings (id, revenue, revenue_annual, pieces, efficiency, updated_at)
            VALUES (1, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                revenue = excluded.revenue,
                revenue_annual = excluded.revenue_annual,
                pieces = excluded.pieces,
                efficiency = excluded.efficiency,
                updated_at = CURRENT_TIMESTAMP
        `,
        [revenue, revenueAnnual, Math.round(pieces), efficiency],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Metas salvas com sucesso!' });
        }
    );
});

router.get('/api/finance/objective-accounts', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM financial_accounts ORDER BY is_default DESC, name ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

router.post('/api/finance/objective-accounts', authenticateToken, authorizeRole(['admin', 'gerente']), (req, res) => {
    const payload = validateObjectiveAccountPayload(req.body);
    if (payload.error) return res.status(400).json({ error: payload.error });

    db.get(`SELECT id FROM financial_accounts WHERE LOWER(name) = LOWER(?) LIMIT 1`, [payload.name], (duplicateErr, duplicateRow) => {
        if (duplicateErr) return res.status(500).json({ error: duplicateErr.message });
        if (duplicateRow) return res.status(400).json({ error: 'Já existe uma conta com esse nome.' });

        db.get(`SELECT COUNT(*) AS total FROM financial_accounts`, [], (countErr, countRow) => {
            if (countErr) return res.status(500).json({ error: countErr.message });

            const shouldBeDefault = payload.is_default || Number(countRow?.total || 0) === 0 ? 1 : 0;

            db.run(
                `INSERT INTO financial_accounts (name, color, is_default) VALUES (?, ?, ?)`,
                [payload.name, payload.color, shouldBeDefault],
                function(err) {
                    if (err) return res.status(500).json({ error: err.message });

                    const createdId = this.lastID;
                    const finish = () => fetchObjectiveAccountRow(createdId, (fetchErr, row) => {
                        if (fetchErr) return res.status(500).json({ error: fetchErr.message });
                        res.status(201).json(row);
                    });

                    if (shouldBeDefault) {
                        return setObjectiveAccountDefault(createdId, (defaultErr) => {
                            if (defaultErr) return res.status(500).json({ error: defaultErr.message });
                            finish();
                        });
                    }

                    finish();
                }
            );
        });
    });
});

router.put('/api/finance/objective-accounts/:id', authenticateToken, authorizeRole(['admin', 'gerente']), (req, res) => {
    const payload = validateObjectiveAccountPayload(req.body);
    if (payload.error) return res.status(400).json({ error: payload.error });

    db.get(`SELECT * FROM financial_accounts WHERE id = ?`, [req.params.id], (findErr, currentRow) => {
        if (findErr) return res.status(500).json({ error: findErr.message });
        if (!currentRow) return res.status(404).json({ error: 'Conta não encontrada.' });

        db.get(
            `SELECT id FROM financial_accounts WHERE LOWER(name) = LOWER(?) AND id != ? LIMIT 1`,
            [payload.name, req.params.id],
            (duplicateErr, duplicateRow) => {
                if (duplicateErr) return res.status(500).json({ error: duplicateErr.message });
                if (duplicateRow) return res.status(400).json({ error: 'Já existe uma conta com esse nome.' });

                const nextIsDefault = payload.is_default ? 1 : currentRow.is_default ? 1 : 0;

                db.run(
                    `UPDATE financial_accounts SET name = ?, color = ?, is_default = ? WHERE id = ?`,
                    [payload.name, payload.color, nextIsDefault, req.params.id],
                    function(updateErr) {
                        if (updateErr) return res.status(500).json({ error: updateErr.message });
                        if (this.changes === 0) return res.status(404).json({ error: 'Conta não encontrada.' });

                        const finish = () => fetchObjectiveAccountRow(req.params.id, (fetchErr, row) => {
                            if (fetchErr) return res.status(500).json({ error: fetchErr.message });
                            res.json(row);
                        });

                        if (nextIsDefault) {
                            return setObjectiveAccountDefault(req.params.id, (defaultErr) => {
                                if (defaultErr) return res.status(500).json({ error: defaultErr.message });
                                finish();
                            });
                        }

                        finish();
                    }
                );
            }
        );
    });
});

router.delete('/api/finance/objective-accounts/:id', authenticateToken, authorizeRole(['admin', 'gerente']), (req, res) => {
    db.get(`SELECT * FROM financial_accounts WHERE id = ?`, [req.params.id], (findErr, currentRow) => {
        if (findErr) return res.status(500).json({ error: findErr.message });
        if (!currentRow) return res.status(404).json({ error: 'Conta não encontrada.' });

        db.all(`SELECT * FROM financial_accounts WHERE id != ? ORDER BY is_default DESC, name ASC`, [req.params.id], (listErr, otherAccounts) => {
            if (listErr) return res.status(500).json({ error: listErr.message });
            if (!otherAccounts.length) return res.status(400).json({ error: 'Você precisa manter pelo menos uma conta cadastrada.' });

            const fallbackAccountId = Number(otherAccounts.find((account) => account.is_default)?.id || otherAccounts[0].id);

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                db.run(
                    `UPDATE finance_objectives SET financial_account_id = ? WHERE financial_account_id = ?`,
                    [fallbackAccountId, req.params.id],
                    (reassignErr) => {
                        if (reassignErr) {
                            return db.run('ROLLBACK', () => res.status(500).json({ error: reassignErr.message }));
                        }

                        db.run(`DELETE FROM financial_accounts WHERE id = ?`, [req.params.id], function(deleteErr) {
                            if (deleteErr) {
                                return db.run('ROLLBACK', () => res.status(500).json({ error: deleteErr.message }));
                            }

                            if (this.changes === 0) {
                                return db.run('ROLLBACK', () => res.status(404).json({ error: 'Conta não encontrada.' }));
                            }

                            setObjectiveAccountDefault(fallbackAccountId, (defaultErr) => {
                                if (defaultErr) {
                                    return db.run('ROLLBACK', () => res.status(500).json({ error: defaultErr.message }));
                                }

                                db.run('COMMIT', (commitErr) => {
                                    if (commitErr) return res.status(500).json({ error: commitErr.message });
                                    res.json({ message: 'Conta removida com sucesso.', fallback_account_id: fallbackAccountId });
                                });
                            });
                        });
                    }
                );
            });
        });
    });
});

router.get('/api/finance/objectives', authenticateToken, (req, res) => {
    fetchObjectivesResponse(res);
});

router.post('/api/finance/objectives', authenticateToken, authorizeRole(['admin', 'gerente']), (req, res) => {
    const validationError = validateObjectivePayload(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    db.run(
        `
            INSERT INTO finance_objectives
            (template_key, name, description, target_amount, initial_amount, due_date, color, icon_key, status, financial_account_id, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `,
        [
            req.body.template_key || 'custom',
            req.body.name.trim(),
            req.body.description || '',
            Number(req.body.target_amount),
            Number(req.body.initial_amount || 0),
            req.body.due_date,
            req.body.color || '#0EA5E9',
            req.body.icon_key || 'custom',
            req.body.status || 'active',
            req.body.financial_account_id || null
        ],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            fetchObjectivesResponse(res, this.lastID);
        }
    );
});

router.put('/api/finance/objectives/:id', authenticateToken, authorizeRole(['admin', 'gerente']), (req, res) => {
    const validationError = validateObjectivePayload(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    db.run(
        `
            UPDATE finance_objectives
            SET
                template_key = ?,
                name = ?,
                description = ?,
                target_amount = ?,
                initial_amount = ?,
                due_date = ?,
                color = ?,
                icon_key = ?,
                status = ?,
                financial_account_id = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `,
        [
            req.body.template_key || 'custom',
            req.body.name.trim(),
            req.body.description || '',
            Number(req.body.target_amount),
            Number(req.body.initial_amount || 0),
            req.body.due_date,
            req.body.color || '#0EA5E9',
            req.body.icon_key || 'custom',
            req.body.status || 'active',
            req.body.financial_account_id || null,
            req.params.id
        ],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Objetivo não encontrado.' });
            fetchObjectivesResponse(res, req.params.id);
        }
    );
});

router.delete('/api/finance/objectives/:id', authenticateToken, authorizeRole(['admin', 'gerente']), (req, res) => {
    db.run(`DELETE FROM finance_objectives WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Objetivo não encontrado.' });
        res.json({ message: 'Objetivo excluído com sucesso.' });
    });
});

router.post('/api/finance/objectives/:id/deposits', authenticateToken, authorizeRole(['admin', 'gerente']), (req, res) => {
    const amount = Number(req.body.amount);
    const depositDate = req.body.deposit_date;
    const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';

    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Valor do depósito inválido.' });
    if (!depositDate) return res.status(400).json({ error: 'Data do depósito é obrigatória.' });

    db.run(
        `INSERT INTO finance_objective_deposits (objective_id, amount, deposit_date, note) VALUES (?, ?, ?, ?)`,
        [req.params.id, amount, depositDate, note],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: 'Depósito criado com sucesso!', id: this.lastID });
        }
    );
});

router.delete('/api/finance/objective-deposits/:id', authenticateToken, authorizeRole(['admin', 'gerente']), (req, res) => {
    db.run(`DELETE FROM finance_objective_deposits WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Depósito não encontrado.' });
        res.json({ message: 'Depósito excluído com sucesso.' });
    });
});

// ==========================================
// 1. PLANO DE CONTAS (Receitas / Despesas)
// ==========================================
router.post('/api/finance/accounts', authenticateToken, authorizeRole(['admin', 'gerente']), (req, res) => {
    const { name, type } = req.body;
    db.run(`INSERT INTO chart_of_accounts (name, type) VALUES (?, ?)`, [name, type], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Conta criada com sucesso!', id: this.lastID });
    });
});

router.get('/api/finance/accounts', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM chart_of_accounts ORDER BY type, name`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

router.put('/api/finance/accounts/:id', authenticateToken, authorizeRole(['admin', 'gerente']), (req, res) => {
    const { name, type } = req.body;
    const safeName = typeof name === 'string' ? name.trim() : '';

    if (!safeName) return res.status(400).json({ error: 'Nome da conta é obrigatório.' });
    if (!['Receita', 'Despesa'].includes(type)) return res.status(400).json({ error: 'Tipo da conta inválido.' });

    db.run(
        `UPDATE chart_of_accounts SET name = ?, type = ? WHERE id = ?`,
        [safeName, type, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Conta não encontrada.' });
            res.json({ message: 'Conta atualizada com sucesso!' });
        }
    );
});

router.delete('/api/finance/accounts/:id', authenticateToken, authorizeRole(['admin', 'gerente']), (req, res) => {
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run(`UPDATE transactions SET chart_of_account_id = NULL WHERE chart_of_account_id = ?`, [req.params.id], (updateErr) => {
            if (updateErr) {
                return db.run('ROLLBACK', () => res.status(500).json({ error: updateErr.message }));
            }

            db.run(`DELETE FROM chart_of_accounts WHERE id = ?`, [req.params.id], function(deleteErr) {
                if (deleteErr) {
                    return db.run('ROLLBACK', () => res.status(500).json({ error: deleteErr.message }));
                }

                if (this.changes === 0) {
                    return db.run('ROLLBACK', () => res.status(404).json({ error: 'Conta não encontrada.' }));
                }

                db.run('COMMIT', (commitErr) => {
                    if (commitErr) return res.status(500).json({ error: commitErr.message });
                    res.json({ message: 'Conta excluída.' });
                });
            });
        });
    });
});

// ==========================================
// 2. CENTROS DE CUSTOS (Produção, Comercial...)
// ==========================================
router.post('/api/finance/cost-centers', authenticateToken, authorizeRole(['admin', 'gerente']), (req, res) => {
    const { name } = req.body;
    db.run(`INSERT INTO cost_centers (name) VALUES (?)`, [name], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Centro de custo criado!', id: this.lastID });
    });
});

router.get('/api/finance/cost-centers', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM cost_centers ORDER BY name`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ==========================================
// 3. TRANSAÇÕES (Contas a Pagar e Receber)
// ==========================================
router.post('/api/finance/transactions', authenticateToken, authorizeRole(['admin', 'gerente']), (req, res) => {
    const { description, type, status, amount, due_date, payment_date, payment_method, order_id, cost_center_id, chart_of_account_id } = req.body;

    db.run(`
        INSERT INTO transactions
        (description, type, status, amount, due_date, payment_date, payment_method, order_id, cost_center_id, chart_of_account_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [description, type, status || 'Pendente', amount, due_date, payment_date || null, payment_method || null, order_id || null, cost_center_id || null, chart_of_account_id || null],
    function(err) {
        if (err) return res.status(500).json({ error: err.message });
        syncOrderAmounts(order_id, (syncErr) => {
            if (syncErr) return res.status(500).json({ error: syncErr.message });
            res.status(201).json({ message: 'Transação registrada!', id: this.lastID });
        });
    });
});

router.get('/api/finance/transactions', authenticateToken, (req, res) => {
    const { type, status, start_date, end_date } = req.query;
    let sql = `
        SELECT t.*, COALESCE(t.payment_date, t.due_date) AS movement_date, c.name as cost_center_name, a.name as account_name
        FROM transactions t
        LEFT JOIN cost_centers c ON t.cost_center_id = c.id
        LEFT JOIN chart_of_accounts a ON t.chart_of_account_id = a.id
        WHERE 1=1
    `;
    const params = [];

    if (type) { sql += ` AND t.type = ?`; params.push(type); }
    if (status) { sql += ` AND t.status = ?`; params.push(status); }
    if (start_date && end_date) { sql += ` AND COALESCE(t.payment_date, t.due_date) BETWEEN ? AND ?`; params.push(start_date, end_date); }

    sql += ` ORDER BY movement_date ASC, t.id ASC`;

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

router.put('/api/finance/transactions/:id', authenticateToken, authorizeRole(['admin', 'gerente']), (req, res) => {
    const {
        description,
        type,
        status,
        amount,
        due_date,
        payment_date,
        payment_method,
        order_id,
        cost_center_id,
        chart_of_account_id
    } = req.body;

    const safeDescription = typeof description === 'string' ? description.trim() : '';
    const safeType = type;
    const safeStatus = status || 'Pendente';
    const safeAmount = Number(amount);
    const safeDueDate = due_date;

    if (!safeDescription) return res.status(400).json({ error: 'Descrição é obrigatória.' });
    if (!['Receita', 'Despesa'].includes(safeType)) return res.status(400).json({ error: 'Tipo inválido.' });
    if (!['Pendente', 'Pago', 'Parcial'].includes(safeStatus)) return res.status(400).json({ error: 'Status inválido.' });
    if (!Number.isFinite(safeAmount) || safeAmount <= 0) return res.status(400).json({ error: 'Valor inválido.' });
    if (!safeDueDate) return res.status(400).json({ error: 'Data é obrigatória.' });

    db.get(`SELECT order_id FROM transactions WHERE id = ?`, [req.params.id], (fetchErr, existingTransaction) => {
        if (fetchErr) return res.status(500).json({ error: fetchErr.message });
        if (!existingTransaction) return res.status(404).json({ error: 'Transação não encontrada.' });

        db.run(`
            UPDATE transactions
            SET description = ?, type = ?, status = ?, amount = ?, due_date = ?, payment_date = ?, payment_method = ?, order_id = ?, cost_center_id = ?, chart_of_account_id = ?
            WHERE id = ?
        `, [
            safeDescription,
            safeType,
            safeStatus,
            safeAmount,
            safeDueDate,
            payment_date || null,
            payment_method || null,
            order_id || null,
            cost_center_id || null,
            chart_of_account_id || null,
            req.params.id
        ], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Transação não encontrada.' });
            syncOrderAmounts([existingTransaction.order_id, order_id], (syncErr) => {
                if (syncErr) return res.status(500).json({ error: syncErr.message });
                res.json({ message: 'Transação atualizada com sucesso!' });
            });
        });
    });
});

router.put('/api/finance/transactions/:id/pay', authenticateToken, authorizeRole(['admin', 'gerente']), (req, res) => {
    const { payment_date, payment_method, paid_amount } = req.body;

    db.get(`SELECT * FROM transactions WHERE id = ?`, [req.params.id], (fetchErr, transaction) => {
        if (fetchErr) return res.status(500).json({ error: fetchErr.message });
        if (!transaction) return res.status(404).json({ error: 'Transação não encontrada.' });
        if (transaction.status === 'Pago') return res.status(400).json({ error: 'Esta transação já foi baixada.' });

        const originalAmount = Number(transaction.amount || 0);
        const requestedAmount = paid_amount === undefined || paid_amount === null || paid_amount === ''
            ? originalAmount
            : Number(paid_amount);

        if (!payment_date) return res.status(400).json({ error: 'Informe a data da baixa.' });
        if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
            return res.status(400).json({ error: 'Informe um valor válido para a baixa.' });
        }
        if (requestedAmount > originalAmount) {
            return res.status(400).json({ error: 'O valor da baixa não pode ser maior que o valor pendente.' });
        }

        const normalizedPaidAmount = Number(requestedAmount.toFixed(2));
        const remainingAmount = Number((originalAmount - normalizedPaidAmount).toFixed(2));
        const finalizeResponse = (message) => {
            syncOrderAmounts(transaction.order_id, (syncErr) => {
                if (syncErr) return res.status(500).json({ error: syncErr.message });
                res.json({ message });
            });
        };

        if (remainingAmount <= 0) {
            db.run(
                `UPDATE transactions SET status = 'Pago', payment_date = ?, payment_method = ? WHERE id = ?`,
                [payment_date, payment_method || null, req.params.id],
                function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    finalizeResponse('Transação baixada com sucesso!');
                }
            );
            return;
        }

        db.serialize(() => {
            let rolledBack = false;

            const rollbackWithError = (errorMessage, statusCode = 500) => {
                if (rolledBack) return;
                rolledBack = true;
                db.run('ROLLBACK', () => res.status(statusCode).json({ error: errorMessage }));
            };

            db.run('BEGIN TRANSACTION', (beginErr) => {
                if (beginErr) return res.status(500).json({ error: beginErr.message });

                db.run(
                    `UPDATE transactions SET status = 'Pago', amount = ?, payment_date = ?, payment_method = ? WHERE id = ?`,
                    [normalizedPaidAmount, payment_date, payment_method || null, req.params.id],
                    function(updateErr) {
                        if (updateErr) return rollbackWithError(updateErr.message);

                        db.run(
                            `INSERT INTO transactions (description, type, status, amount, due_date, payment_date, payment_method, order_id, cost_center_id, chart_of_account_id)
                             VALUES (?, ?, 'Pendente', ?, ?, NULL, NULL, ?, ?, ?)`,
                            [
                                transaction.description,
                                transaction.type,
                                remainingAmount,
                                transaction.due_date,
                                transaction.order_id || null,
                                transaction.cost_center_id || null,
                                transaction.chart_of_account_id || null
                            ],
                            function(insertErr) {
                                if (insertErr) return rollbackWithError(insertErr.message);

                                db.run('COMMIT', (commitErr) => {
                                    if (commitErr) return rollbackWithError(commitErr.message);
                                    finalizeResponse('Baixa parcial registrada com sucesso!');
                                });
                            }
                        );
                    }
                );
            });
        });
    });
});

router.delete('/api/finance/transactions/:id', authenticateToken, authorizeRole(['admin', 'gerente']), (req, res) => {
    db.get(`SELECT order_id FROM transactions WHERE id = ?`, [req.params.id], (fetchErr, transaction) => {
        if (fetchErr) return res.status(500).json({ error: fetchErr.message });
        if (!transaction) return res.status(404).json({ error: 'Transação não encontrada.' });

        db.run(`DELETE FROM transactions WHERE id = ?`, [req.params.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            syncOrderAmounts(transaction.order_id, (syncErr) => {
                if (syncErr) return res.status(500).json({ error: syncErr.message });
                res.json({ message: 'Transação excluída.' });
            });
        });
    });
});

router.get('/api/finance/expense-report', authenticateToken, authorizeRole(['admin', 'gerente']), (req, res) => {
    const { start_date, end_date, account_id, status, payment_method, search } = req.query;

    let sql = `
        SELECT
            t.*,
            COALESCE(t.payment_date, t.due_date) AS movement_date,
            c.name AS cost_center_name,
            a.name AS account_name
        FROM transactions t
        LEFT JOIN cost_centers c ON t.cost_center_id = c.id
        LEFT JOIN chart_of_accounts a ON t.chart_of_account_id = a.id
        WHERE t.type = 'Despesa'
    `;

    const params = [];

    if (start_date && end_date) {
        sql += ` AND COALESCE(t.payment_date, t.due_date) BETWEEN ? AND ?`;
        params.push(start_date, end_date);
    }

    if (account_id && account_id !== 'all') {
        if (account_id === 'uncategorized') {
            sql += ` AND t.chart_of_account_id IS NULL`;
        } else {
            sql += ` AND t.chart_of_account_id = ?`;
            params.push(account_id);
        }
    }

    if (status && status !== 'all') {
        sql += ` AND t.status = ?`;
        params.push(status);
    }

    if (payment_method && payment_method !== 'all') {
        if (payment_method === 'uncategorized') {
            sql += ` AND (t.payment_method IS NULL OR TRIM(t.payment_method) = '')`;
        } else {
            sql += ` AND t.payment_method = ?`;
            params.push(payment_method);
        }
    }

    if (search && search.trim()) {
        sql += ` AND (
            t.description LIKE ?
            OR COALESCE(a.name, '') LIKE ?
            OR COALESCE(t.payment_method, '') LIKE ?
            OR COALESCE(c.name, '') LIKE ?
        )`;
        const term = `%${search.trim()}%`;
        params.push(term, term, term, term);
    }

    sql += ` ORDER BY movement_date DESC, t.id DESC`;

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const summary = {
            total: 0,
            paid: 0,
            pending: 0,
            count: rows.length,
            average: 0,
            highest: null,
            top_category: null,
            top_method: null
        };

        const categoryMap = {};
        const methodMap = {};
        const dailyMap = {};
        const statusMap = {};

        rows.forEach(row => {
            const amount = Number(row.amount) || 0;
            const category = row.account_name || 'Geral/Sem Categoria';
            const method = row.payment_method || 'Sem forma definida';
            const day = row.movement_date || row.due_date || 'Sem data';
            const rowStatus = row.status || 'Pendente';

            summary.total += amount;
            if (rowStatus === 'Pago') summary.paid += amount;
            else summary.pending += amount;

            if (!summary.highest || amount > summary.highest.amount) {
                summary.highest = { id: row.id, description: row.description, amount, movement_date: day };
            }

            if (!categoryMap[category]) categoryMap[category] = { id: row.chart_of_account_id || null, name: category, total: 0, count: 0 };
            categoryMap[category].total += amount;
            categoryMap[category].count += 1;

            if (!methodMap[method]) methodMap[method] = { name: method, total: 0, count: 0 };
            methodMap[method].total += amount;
            methodMap[method].count += 1;

            if (!dailyMap[day]) dailyMap[day] = { name: day, total: 0, count: 0 };
            dailyMap[day].total += amount;
            dailyMap[day].count += 1;

            if (!statusMap[rowStatus]) statusMap[rowStatus] = { name: rowStatus, total: 0, count: 0 };
            statusMap[rowStatus].total += amount;
            statusMap[rowStatus].count += 1;
        });

        summary.average = summary.count > 0 ? summary.total / summary.count : 0;

        const withPercent = (items) => items
            .sort((a, b) => b.total - a.total)
            .map(item => ({
                ...item,
                percent: summary.total > 0 ? Number(((item.total / summary.total) * 100).toFixed(1)) : 0
            }));

        const categoryData = withPercent(Object.values(categoryMap));
        const methodData = withPercent(Object.values(methodMap));
        const statusData = withPercent(Object.values(statusMap));
        const dailyData = Object.values(dailyMap).sort((a, b) => a.name.localeCompare(b.name));

        summary.top_category = categoryData[0] || null;
        summary.top_method = methodData[0] || null;

        res.json({
            summary,
            categoryData,
            methodData,
            statusData,
            dailyData,
            transactions: rows
        });
    });
});

// ==========================================
// ⭐ 4. DRE & INDICADORES BI (Motor de Gráficos)
// ==========================================
router.get('/api/finance/dre', authenticateToken, authorizeRole(['admin', 'gerente']), async (req, res) => {
    const { start_date, end_date } = req.query;

    let dateFilter = '';
    let params = [];
    if (start_date && end_date) {
        dateFilter = ` AND payment_date BETWEEN ? AND ?`;
        params.push(start_date, end_date);
    }

    try {
        // 1. Resumo Total
        const totals = await new Promise((resolve, reject) => {
            db.all(`SELECT type, SUM(amount) as total FROM transactions WHERE status = 'Pago' ${dateFilter} GROUP BY type`, params, (err, rows) => {
                if (err) reject(err); else resolve(rows);
            });
        });

        let receitas = 0; let despesas = 0;
        totals.forEach(r => {
            if (r.type === 'Receita') receitas = r.total;
            if (r.type === 'Despesa') despesas = r.total;
        });

        const lucro_operacional = receitas - despesas;
        const margem = receitas > 0 ? (lucro_operacional / receitas) * 100 : 0;

        // 2. Gráfico Mensal (Evolução)
        const monthly = await new Promise((resolve, reject) => {
            db.all(`
                SELECT strftime('%Y-%m', payment_date) as month, type, SUM(amount) as total 
                FROM transactions 
                WHERE status = 'Pago' AND payment_date IS NOT NULL ${dateFilter} 
                GROUP BY month, type ORDER BY month ASC
            `, params, (err, rows) => {
                if (err) reject(err); else resolve(rows);
            });
        });

        const monthlyMap = {};
        monthly.forEach(r => {
            if (!monthlyMap[r.month]) monthlyMap[r.month] = { name: r.month, Receitas: 0, Despesas: 0 };
            if (r.type === 'Receita') monthlyMap[r.month].Receitas = r.total;
            if (r.type === 'Despesa') monthlyMap[r.month].Despesas = r.total;
        });

        // 3. Gráfico de Categorias (Para onde está indo o dinheiro?)
        const categories = await new Promise((resolve, reject) => {
            db.all(`
                SELECT c.name as category, SUM(t.amount) as total 
                FROM transactions t
                LEFT JOIN chart_of_accounts c ON t.chart_of_account_id = c.id
                WHERE t.status = 'Pago' AND t.type = 'Despesa' ${dateFilter}
                GROUP BY category ORDER BY total DESC LIMIT 7
            `, params, (err, rows) => {
                if (err) reject(err); else resolve(rows);
            });
        });

        const categoryData = categories.map(c => ({
            name: c.category || 'Geral/Sem Categoria',
            total: c.total
        }));

        res.json({
            receitas, despesas, lucro_operacional, margem: margem.toFixed(1),
            monthlyData: Object.values(monthlyMap),
            categoryData
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 5. MÁQUINA DO TEMPO
// ==========================================
router.post('/api/finance/sync-history', authenticateToken, authorizeRole(['admin']), (req, res) => {
    db.all(`SELECT * FROM orders WHERE status NOT IN ('Cancelado', 'Arte Arquivada')`, [], (err, orders) => {
        if (err) return res.status(500).json({ error: err.message });
        db.run(`DELETE FROM transactions WHERE order_id IS NOT NULL AND status = 'Pendente'`, [], () => {
            let processed = 0;
            if (orders.length === 0) return res.json({ message: 'Nenhum pedido pendente para sincronizar.' });
            orders.forEach(o => {
                const isPaid = o.status === 'Entregue/Concluído' ? 'Pago' : 'Pendente';
                const date = o.delivery_date || new Date().toISOString().split('T')[0];
                db.get(`SELECT id FROM transactions WHERE order_id = ? AND type = 'Receita' AND status = 'Pago'`, [o.id], (err, rowRev) => {
                    if (!rowRev && o.total_price && o.total_price > 0) {
                        db.run(`INSERT INTO transactions (description, type, status, amount, due_date, order_id) VALUES (?, 'Receita', ?, ?, ?, ?)`, 
                        [`Pedido ${o.tracking_code} - ${o.client_name}`, isPaid, o.total_price, date, o.id]);
                    }
                    db.get(`SELECT id FROM transactions WHERE order_id = ? AND type = 'Despesa' AND status = 'Pago'`, [o.id], (err, rowExp) => {
                        if (!rowExp && o.cost_price && o.cost_price > 0) {
                            db.run(`INSERT INTO transactions (description, type, status, amount, due_date, order_id) VALUES (?, 'Despesa', ?, ?, ?, ?)`, 
                            [`Custo Prod: ${o.tracking_code}`, isPaid, o.cost_price, date, o.id]);
                        }
                        processed++;
                        if (processed === orders.length) res.json({ message: 'Caixa sincronizado com todos os pedidos!' });
                    });
                });
            });
        });
    });
});

module.exports = router;
