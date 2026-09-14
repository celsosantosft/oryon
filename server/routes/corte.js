const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, authorizeRole } = require('../middlewares/auth');

const ACTIVE_CUTTING_STATUSES = ['Arte Aprovada/Liberada', 'Corte Iniciado'];
const COMPLETABLE_CUTTING_STATUSES = ACTIVE_CUTTING_STATUSES;
const HISTORICAL_CUTTING_STATUSES = ['Corte Concluido', 'Corte Concluído', 'Na Costura', 'Costura Iniciada'];
const FINALIZED_CUTTING_STATUS = 'Costura Iniciada';
const CUTTING_PART_TYPES = ['frente', 'costas', 'mangas'];
const CUTTING_ROLES = ['admin', 'gerente', 'gerente_producao', 'gerente_operacoes', 'corte'];

function ensureProgressTable(callback) {
    db.run(`
        CREATE TABLE IF NOT EXISTS corte_progresso (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lote_id TEXT NOT NULL,
            tamanho TEXT NOT NULL,
            tipo_peca TEXT NOT NULL,
            quantidade INTEGER NOT NULL DEFAULT 0,
            updated_by_user_id INTEGER,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(lote_id, tamanho, tipo_peca)
        )
    `, callback);
}

function safeParseGrade(value) {
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        return {};
    }
}

function safeParseStringArray(value) {
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return Array.isArray(parsed)
            ? parsed.map((item) => String(item || '').trim()).filter(Boolean)
            : [];
    } catch (error) {
        return [];
    }
}

function extractSoldGrade(value) {
    return Object.entries(safeParseGrade(value))
        .map(([tamanho, quantidade]) => ({
            tamanho,
            quantidade: Number(quantidade) || 0
        }))
        .filter((item) => item.quantidade > 0);
}

function sumGrade(grade) {
    return grade.reduce((sum, item) => sum + (Number(item.quantidade) || 0), 0);
}

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function isCottonProduction(row) {
    const productionDetails = [
        row.tipo_estampa,
        row.category,
        row.tecido_pedido,
        row.tecido,
        row.production_label
    ].map(normalizeText).join(' ');

    return productionDetails.includes('algodao');
}

function isActiveCuttingStatus(status) {
    return ACTIVE_CUTTING_STATUSES.includes(status);
}

function parseCuttingDimension(value, label) {
    const parsed = Number(String(value ?? '').trim().replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 30 || parsed > 5000) {
        throw new Error(`${label} deve estar entre 30 e 5000 cm.`);
    }
    return Math.round(parsed * 10) / 10;
}

function parseCuttingFabricPayload(payload = {}) {
    const malhaNome = String(payload.malha_nome || '').trim().replace(/\s+/g, ' ');
    if (!malhaNome) throw new Error('Informe a malha que será configurada.');

    return {
        malha_key: normalizeText(malhaNome).trim().replace(/\s+/g, ' '),
        malha_nome: malhaNome,
        malha_largura_cm: parseCuttingDimension(payload.malha_largura_cm, 'A largura da malha')
    };
}

function parseCuttingTablePayload(payload = {}) {
    return {
        mesa_largura_cm: parseCuttingDimension(payload.mesa_largura_cm, 'A largura da mesa'),
        mesa_comprimento_cm: parseCuttingDimension(payload.mesa_comprimento_cm, 'O comprimento da mesa')
    };
}

router.get('/corte/configuracoes', authenticateToken, authorizeRole(CUTTING_ROLES), (req, res) => {
    db.get(`
        SELECT largura_cm, comprimento_cm, updated_at
        FROM corte_configuracao_mesa
        WHERE id = 1
    `, [], (tableErr, mesa) => {
        if (tableErr) return res.status(500).json({ error: tableErr.message });

        db.all(`
            SELECT malha_key, malha_nome, largura_cm, updated_at
            FROM corte_configuracao_malha
            ORDER BY malha_nome COLLATE NOCASE ASC
        `, [], (fabricErr, malhas) => {
            if (fabricErr) return res.status(500).json({ error: fabricErr.message });
            res.json({
                mesa: {
                    largura_cm: Number(mesa?.largura_cm) || 180,
                    comprimento_cm: Number(mesa?.comprimento_cm) || 280
                },
                malhas: malhas || []
            });
        });
    });
});

router.put('/corte/configuracoes/mesa', authenticateToken, authorizeRole(CUTTING_ROLES), (req, res) => {
    let settings;
    try {
        settings = parseCuttingTablePayload(req.body);
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }

    db.run(`
        INSERT INTO corte_configuracao_mesa
            (id, largura_cm, comprimento_cm, updated_by_user_id, updated_at)
        VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
            largura_cm = excluded.largura_cm,
            comprimento_cm = excluded.comprimento_cm,
            updated_by_user_id = excluded.updated_by_user_id,
            updated_at = CURRENT_TIMESTAMP
    `, [settings.mesa_largura_cm, settings.mesa_comprimento_cm, req.user.id || null], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
            message: 'Medidas da mesa atualizadas.',
            mesa: {
                largura_cm: settings.mesa_largura_cm,
                comprimento_cm: settings.mesa_comprimento_cm
            }
        });
    });
});

router.put('/corte/configuracoes/malha', authenticateToken, authorizeRole(CUTTING_ROLES), (req, res) => {
    let settings;
    try {
        settings = parseCuttingFabricPayload(req.body);
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }

    db.run(`
        INSERT INTO corte_configuracao_malha
            (malha_key, malha_nome, largura_cm, updated_by_user_id, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(malha_key) DO UPDATE SET
            malha_nome = excluded.malha_nome,
            largura_cm = excluded.largura_cm,
            updated_by_user_id = excluded.updated_by_user_id,
            updated_at = CURRENT_TIMESTAMP
    `, [settings.malha_key, settings.malha_nome, settings.malha_largura_cm, req.user.id || null], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
            message: 'Largura da malha atualizada.',
            malha: {
                malha_key: settings.malha_key,
                malha_nome: settings.malha_nome,
                largura_cm: settings.malha_largura_cm
            }
        });
    });
});

router.get('/corte/pedidos', authenticateToken, authorizeRole(CUTTING_ROLES), (req, res) => {
    const isHistory = normalizeText(req.query.aba).trim() === 'historico';
    const statuses = isHistory ? HISTORICAL_CUTTING_STATUSES : ACTIVE_CUTTING_STATUSES;
    const statusPlaceholders = statuses.map(() => '?').join(', ');
    const statusFilter = `o.status IN (${statusPlaceholders})`;

    db.all(`
        SELECT
            o.id AS id_pedido,
            o.tracking_code,
            o.client_name AS cliente,
            o.status,
            o.cor AS cor_tecido,
            o.delivery_date,
            o.layout_path,
            o.observacao,
            o.url_referencia,
            o.tipo_estampa,
            o.category,
            o.product_type AS produto_pedido,
            o.fabric_type AS tecido_pedido,
            COALESCE(product_counts.product_count, 0) AS product_count,
            submitted_sizes.sizes_json AS submitted_sizes_json,
            opl.production_label,
            COALESCE(opl.printing_types_json, '[]') AS acabamentos_json,
            COALESCE(NULLIF(opl.production_label, ''), opl.product_type, o.product_type) AS nome_produto,
            COALESCE(NULLIF(opl.fabric_type, ''), o.fabric_type, '') AS tecido,
            COALESCE(opl.sizes_json, o.sizes_json, '{}') AS sizes_json
        FROM orders o
        LEFT JOIN order_product_lines opl ON opl.order_id = o.id
        LEFT JOIN (
            SELECT order_id, COUNT(*) AS product_count
            FROM order_product_lines
            GROUP BY order_id
        ) product_counts ON product_counts.order_id = o.id
        LEFT JOIN (
            SELECT
                order_id,
                json_group_object(size, qty) AS sizes_json
            FROM (
                SELECT order_id, size, COUNT(*) AS qty
                FROM order_items
                WHERE (reference_type = 'order' OR reference_type IS NULL)
                  AND COALESCE(size, '') <> ''
                GROUP BY order_id, size
            )
            GROUP BY order_id
        ) submitted_sizes ON submitted_sizes.order_id = o.id
        WHERE ${statusFilter}
        ORDER BY o.id ASC, COALESCE(opl.sort_order, 0) ASC, COALESCE(opl.id, 0) ASC
    `, statuses, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const pedidos = new Map();

        (rows || []).forEach((row) => {
            if (!pedidos.has(row.id_pedido)) {
                pedidos.set(row.id_pedido, {
                    id_pedido: row.id_pedido,
                    tracking_code: row.tracking_code,
                    cliente: row.cliente,
                    status: row.status,
                    can_concluir_corte: COMPLETABLE_CUTTING_STATUSES.includes(row.status),
                    delivery_date: row.delivery_date,
                    priority: 'normal',
                    layout_path: row.layout_path,
                    observacao: row.observacao,
                    url_referencia: row.url_referencia,
                    tipo_producao: 'Sublimacao',
                    cor_tecido: row.cor_tecido || 'Não Informado',
                    produtos: []
                });
            }

            const pedido = pedidos.get(row.id_pedido);
            const productGrade = extractSoldGrade(row.sizes_json);
            const submittedGrade = extractSoldGrade(row.submitted_sizes_json);
            const canUseSubmittedGrade = Number(row.product_count || 0) <= 1;
            const grade = sumGrade(productGrade) > 0
                ? productGrade
                : (canUseSubmittedGrade ? submittedGrade : []);
            const nomeProduto = String(row.nome_produto || '').trim();
            const modeloMigradoSemOrigem = !String(row.produto_pedido || '').trim() && nomeProduto === 'Produto';

            if (isCottonProduction(row)) {
                pedido.tipo_producao = 'Algodao';
            }

            pedido.produtos.push({
                nome_produto: modeloMigradoSemOrigem ? 'Não Informado' : (nomeProduto || 'Não Informado'),
                tecido: row.tecido || 'Não Informado',
                acabamentos: safeParseStringArray(row.acabamentos_json),
                grade
            });
        });

        res.json(Array.from(pedidos.values()));
    });
});

const archiveCuttingLot = (req, res) => {
    const receivedIds = Array.isArray(req.body.ids_pedido) ? req.body.ids_pedido : [req.body.id_pedido];
    const orderIds = Array.from(new Set(
        receivedIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
    ));
    const lotIds = Array.from(new Set(
        (Array.isArray(req.body.lote_ids) ? req.body.lote_ids : [])
            .map((value) => String(value || '').trim())
            .filter(Boolean)
    ));

    if (orderIds.length === 0) {
        return res.status(400).json({ error: 'Informe ao menos um pedido válido para finalizar.' });
    }

    ensureProgressTable((tableErr) => {
        if (tableErr) return res.status(500).json({ error: tableErr.message });

        const orderPlaceholders = orderIds.map(() => '?').join(', ');
        const statusPlaceholders = COMPLETABLE_CUTTING_STATUSES.map(() => '?').join(', ');

        db.all(`
            SELECT id
            FROM orders
            WHERE id IN (${orderPlaceholders})
              AND status IN (${statusPlaceholders})
        `, [...orderIds, ...COMPLETABLE_CUTTING_STATUSES], (selectErr, activeOrders) => {
            if (selectErr) return res.status(500).json({ error: selectErr.message });
            if (!activeOrders || activeOrders.length === 0) {
                return res.status(404).json({ error: 'Nenhum pedido ativo encontrado para este lote.' });
            }

            const finalizedIds = activeOrders.map((order) => order.id);
            const finalizedPlaceholders = finalizedIds.map(() => '?').join(', ');

            db.serialize(() => {
                db.run('BEGIN TRANSACTION', (beginErr) => {
                    if (beginErr) return res.status(500).json({ error: beginErr.message });

                    const rollback = (error) => {
                        db.run('ROLLBACK', () => res.status(500).json({ error: error.message }));
                    };

                    const commit = () => {
                        db.run('COMMIT', (commitErr) => {
                            if (commitErr) return rollback(commitErr);
                            res.json({
                                message: 'Lote finalizado e enviado para costura.',
                                status: FINALIZED_CUTTING_STATUS,
                                ids_pedido: finalizedIds
                            });
                        });
                    };

                    const clearActiveProgress = () => {
                        if (lotIds.length === 0) return commit();
                        const lotPlaceholders = lotIds.map(() => '?').join(', ');
                        db.run(`DELETE FROM corte_progresso WHERE lote_id IN (${lotPlaceholders})`, lotIds, (deleteErr) => {
                            if (deleteErr) return rollback(deleteErr);
                            commit();
                        });
                    };

                    const insertHistory = (index) => {
                        if (index >= finalizedIds.length) return clearActiveProgress();
                        db.run(
                            'INSERT INTO order_history (order_id, status_text, changed_by_user_id) VALUES (?, ?, ?)',
                            [finalizedIds[index], FINALIZED_CUTTING_STATUS, req.user.id || null],
                            (historyErr) => {
                                if (historyErr) return rollback(historyErr);
                                insertHistory(index + 1);
                            }
                        );
                    };

                    db.run(`
                        UPDATE orders
                        SET status = ?, board_order = 999999
                        WHERE id IN (${finalizedPlaceholders})
                    `, [FINALIZED_CUTTING_STATUS, ...finalizedIds], (updateErr) => {
                        if (updateErr) return rollback(updateErr);
                        insertHistory(0);
                    });
                });
            });
        });
    });
};

router.post('/corte/finalizar', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_producao', 'gerente_operacoes', 'corte']), archiveCuttingLot);
router.post('/corte/arquivar', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_producao', 'gerente_operacoes', 'corte']), archiveCuttingLot);

router.get('/corte/progresso', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_producao', 'gerente_operacoes', 'corte']), (req, res) => {
    ensureProgressTable((tableErr) => {
        if (tableErr) return res.status(500).json({ error: tableErr.message });

        db.all(`
            SELECT lote_id, tamanho, tipo_peca, quantidade, quantidade AS quantidade_cortada, updated_at
            FROM corte_progresso
            ORDER BY lote_id ASC, tamanho ASC, tipo_peca ASC
        `, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        });
    });
});

router.post('/corte/salvar-progresso', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_producao', 'gerente_operacoes', 'corte']), (req, res) => {
    const loteId = String(req.body.lote_id || req.body.id_pedido || '').trim();
    const tamanho = String(req.body.tamanho || '').trim().toUpperCase();
    const tipoPeca = normalizeText(req.body.tipo_peca).trim();
    const quantidade = Number(req.body.quantidade);

    if (!loteId || !tamanho || !CUTTING_PART_TYPES.includes(tipoPeca)) {
        return res.status(400).json({ error: 'Lote, tamanho e tipo de peça válido são obrigatórios.' });
    }

    if (!Number.isInteger(quantidade) || quantidade < 0) {
        return res.status(400).json({ error: 'A quantidade deve ser um número inteiro maior ou igual a zero.' });
    }

    ensureProgressTable((tableErr) => {
        if (tableErr) return res.status(500).json({ error: tableErr.message });

        db.run(`
            INSERT INTO corte_progresso (lote_id, tamanho, tipo_peca, quantidade, updated_by_user_id, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(lote_id, tamanho, tipo_peca)
            DO UPDATE SET
                quantidade = excluded.quantidade,
                updated_by_user_id = excluded.updated_by_user_id,
                updated_at = CURRENT_TIMESTAMP
        `, [loteId, tamanho, tipoPeca, quantidade, req.user.id || null], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({
                message: 'Progresso salvo automaticamente.',
                progresso: { lote_id: loteId, tamanho, tipo_peca: tipoPeca, quantidade }
            });
        });
    });
});

router._test = {
    isActiveCuttingStatus,
    parseCuttingFabricPayload,
    parseCuttingTablePayload
};

module.exports = router;
