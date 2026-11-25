const express = require('express');
const { promisify } = require('node:util');
const router = express.Router();
const db = require('../database');
const { syncOrderFinance, deleteUnpaidOrder } = require('../utils/orderFinance');
const { withFinanceWrite } = require('../utils/financeWrite');
const { appPaths } = require('../config/paths');
const crypto = require('crypto');
const { authenticateToken, authorizeRole } = require('../middlewares/auth');
const { appConfig, buildTrackingCode } = require('../config/appConfig');
const { createLayoutUpload } = require('../utils/layoutUpload');
const { buildOrderCodeFromQuoteCode } = require('../utils/quoteOrderTracking');
const { buildPortalSharePath } = require('../utils/portalShare');
const { enqueueUpsert: enqueueCalendarUpsert } = require('../services/orderCalendarSync');
db.run("ALTER TABLE quotes ADD COLUMN portal_token TEXT", () => {});
db.run("ALTER TABLE orders ADD COLUMN portal_token TEXT", () => {});

const upload = createLayoutUpload();

function safeParseJSON(jsonString) {
    try {
        if (!jsonString || jsonString === '[object Object]') return {};
        return JSON.parse(jsonString);
    } catch (e) {
        return {};
    }
}

function safeStringifyJSON(value) {
    try {
        return JSON.stringify(value || {});
    } catch (error) {
        return '{}';
    }
}

function generateQuoteTrackingCode() {
    return buildTrackingCode(appConfig.quotePrefix);
}

function generateTrackingCode() {
    return buildTrackingCode(appConfig.orderPrefix);
}

function generatePortalToken() {
    return crypto.randomBytes(24).toString('base64url');
}

function buildPortalPath(record) {
    return buildPortalSharePath(record);
}

const QUOTE_CONVERTED_STATUS = 'Convertido em Pedido';
const QUOTE_STATUS_VALUES = new Set(['Em Análise', 'Enviado ao Cliente', 'Aprovado', 'Recusado', 'Cancelado', QUOTE_CONVERTED_STATUS]);

function shouldShowQuoteInList(quote) {
    return quote?.status !== QUOTE_CONVERTED_STATUS;
}

function normalizeClientName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function canAdoptOrderForQuote(order, quote) {
    return !order?.quote_id && normalizeClientName(order?.client_name) === normalizeClientName(quote?.client_name);
}

function parseStringArray(value) {
    if (Array.isArray(value)) {
        return value.map((item) => String(item || '').trim()).filter(Boolean);
    }

    if (typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed.map((item) => String(item || '').trim()).filter(Boolean);
            }
        } catch (error) {
            return value.split(',').map((item) => item.trim()).filter(Boolean);
        }
    }

    return [];
}

function parseSizesValue(value) {
    if (!value) return {};
    if (typeof value === 'string') return safeParseJSON(value);
    if (typeof value === 'object') return value;
    return {};
}

function filesByFieldName(files = []) {
    return files.reduce((accumulator, file) => {
        accumulator[file.fieldname] = file.filename;
        return accumulator;
    }, {});
}

function normalizeQuoteProductLines(body, files = []) {
    const fileMap = filesByFieldName(files);
    const incomingLines = Array.isArray(body.product_lines)
        ? body.product_lines
        : safeParseJSON(body.product_lines);

    const normalizedSource = Array.isArray(incomingLines) && incomingLines.length > 0
        ? incomingLines
        : [{
            line_key: 'legacy',
            product_type: body.product_type || '',
            fabric_type: body.fabric_type || '',
            sizes_json: parseSizesValue(body.sizes_json),
            unit_price: body.unit_price || 0,
            unit_cost: body.unit_cost || 0,
            total_price: body.total_price || 0,
            cost_price: body.cost_price || 0,
            production_label: body.production_label || '',
            printing_types_json: body.printing_types_json || [],
            production_notes: body.production_notes || body.observacao || '',
            existing_layout_path: body.layout_path || null
        }];

    return normalizedSource
        .map((line, index) => {
            const sizes = parseSizesValue(line.sizes_json || line.sizes || {});
            const totalQty = Object.values(sizes).reduce((sum, value) => sum + (Number(value) || 0), 0);
            const unitPrice = Number(line.unit_price || 0);
            const unitCost = Number(line.unit_cost || 0);
            const lineKey = line.line_key || `line-${index}`;
            const uploadedLayout = fileMap[`layout_file_${lineKey}`] || fileMap.layout_file || null;
            const totalPrice = Number(line.total_price || (totalQty * unitPrice) || 0);
            const costPrice = Number(line.cost_price || (totalQty * unitCost) || 0);
            const printingTypes = parseStringArray(line.printing_types_json);

            return {
                sort_order: index,
                product_type: String(line.product_type || '').trim(),
                production_label: String(line.production_label || '').trim(),
                printing_types_json: JSON.stringify(printingTypes),
                production_notes: String(line.production_notes || '').trim(),
                fabric_type: String(line.fabric_type || '').trim(),
                sizes,
                sizes_json: safeStringifyJSON(sizes),
                unit_price: unitPrice,
                unit_cost: unitCost,
                total_price: totalPrice,
                cost_price: costPrice,
                layout_path: uploadedLayout || line.existing_layout_path || null
            };
        })
        .filter((line) => line.product_type);
}

function summarizeLines(lines, discount = 0) {
    const aggregateSizes = {};
    let grossTotal = 0;
    let totalCost = 0;

    lines.forEach((line) => {
        grossTotal += Number(line.total_price || 0);
        totalCost += Number(line.cost_price || 0);

        Object.entries(line.sizes || {}).forEach(([size, qty]) => {
            aggregateSizes[size] = (aggregateSizes[size] || 0) + (Number(qty) || 0);
        });
    });

    const uniqueProducts = [...new Set(lines.map((line) => line.product_type).filter(Boolean))];
    const uniqueFabrics = [...new Set(lines.map((line) => line.fabric_type).filter(Boolean))];
    const firstLayout = lines.find((line) => line.layout_path)?.layout_path || null;

    return {
        product_type: uniqueProducts.length <= 1 ? (uniqueProducts[0] || 'Produto') : `Orçamento com ${uniqueProducts.length} produtos`,
        fabric_type: uniqueFabrics.length <= 1 ? (uniqueFabrics[0] || '') : 'Variados',
        sizes_json: safeStringifyJSON(aggregateSizes),
        total_price: Math.max(0, grossTotal - (Number(discount) || 0)),
        cost_price: totalCost,
        unit_price: lines.length === 1 ? Number(lines[0].unit_price || 0) : 0,
        unit_cost: lines.length === 1 ? Number(lines[0].unit_cost || 0) : 0,
        layout_path: firstLayout
    };
}

function saveQuoteProductLines(quoteId, lines, callback) {
    db.run(`DELETE FROM quote_product_lines WHERE quote_id = ?`, [quoteId], (deleteErr) => {
        if (deleteErr) return callback(deleteErr);
        if (!lines.length) return callback(null);

        const stmt = db.prepare(`
            INSERT INTO quote_product_lines
            (quote_id, sort_order, product_type, production_label, printing_types_json, production_notes, fabric_type, sizes_json, unit_price, unit_cost, total_price, cost_price, layout_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let pending = lines.length;
        let finished = false;

        const finish = (runErr) => {
            if (finished) return;
            if (runErr) {
                finished = true;
                return stmt.finalize(() => callback(runErr));
            }

            pending -= 1;
            if (pending === 0) {
                finished = true;
                stmt.finalize((finalizeErr) => callback(finalizeErr || null));
            }
        };

        lines.forEach((line) => {
            stmt.run([
                quoteId,
                line.sort_order || 0,
                line.product_type,
                line.production_label || null,
                line.printing_types_json || '[]',
                line.production_notes || null,
                line.fabric_type || '',
                line.sizes_json,
                Number(line.unit_price || 0),
                Number(line.unit_cost || 0),
                Number(line.total_price || 0),
                Number(line.cost_price || 0),
                line.layout_path || null
            ], finish);
        });
    });
}

function fetchQuoteProductLines(connection, quoteId, callback) {
    connection.all(`SELECT * FROM quote_product_lines WHERE quote_id = ? ORDER BY sort_order ASC, id ASC`, [quoteId], (err, rows) => {
        if (err) return callback(err);

        if (rows && rows.length > 0) {
            return callback(null, rows.map((row) => ({
                ...row,
                printing_types_json: parseStringArray(row.printing_types_json),
                sizes_json: safeParseJSON(row.sizes_json)
            })));
        }

        connection.get(`SELECT * FROM quotes WHERE id = ?`, [quoteId], (quoteErr, quote) => {
            if (quoteErr) return callback(quoteErr);
            if (!quote) return callback(null, []);

            callback(null, [{
                id: `legacy-${quote.id}`,
                quote_id: quote.id,
                sort_order: 0,
                product_type: quote.product_type || 'Produto',
                production_label: quote.product_type || 'Produto',
                printing_types_json: [],
                production_notes: quote.observacao || '',
                fabric_type: quote.fabric_type || '',
                sizes_json: safeParseJSON(quote.sizes_json),
                unit_price: Number(quote.unit_price || 0),
                unit_cost: Number(quote.unit_cost || 0),
                total_price: Number(quote.total_price || 0),
                cost_price: Number(quote.cost_price || 0),
                layout_path: quote.layout_path || null
            }]);
        });
    });
}

function saveOrderProductLines(connection, orderId, lines, callback) {
    connection.run(`DELETE FROM order_product_lines WHERE order_id = ?`, [orderId], (deleteErr) => {
        if (deleteErr) return callback(deleteErr);
        if (!lines.length) return callback(null);

        const stmt = connection.prepare(`
            INSERT INTO order_product_lines
            (order_id, sort_order, product_type, production_label, printing_types_json, production_notes, fabric_type, sizes_json, unit_price, unit_cost, total_price, cost_price, layout_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let pending = lines.length;
        let finished = false;

        const finish = (runErr) => {
            if (finished) return;
            if (runErr) {
                finished = true;
                return stmt.finalize(() => callback(runErr));
            }

            pending -= 1;
            if (pending === 0) {
                finished = true;
                stmt.finalize((finalizeErr) => callback(finalizeErr || null));
            }
        };

        lines.forEach((line) => {
            stmt.run([
                orderId,
                line.sort_order || 0,
                line.product_type,
                line.production_label || null,
                line.printing_types_json || '[]',
                line.production_notes || null,
                line.fabric_type || '',
                line.sizes_json,
                Number(line.unit_price || 0),
                Number(line.unit_cost || 0),
                Number(line.total_price || 0),
                Number(line.cost_price || 0),
                line.layout_path || null
            ], finish);
        });
    });
}

function getQuoteItems(connection, quoteId, callback) {
    connection.all(`SELECT player_name, player_number, size, model FROM quote_items WHERE quote_id = ? ORDER BY id ASC`, [quoteId], (err, items) => {
        if (err) return callback(err);
        if (items && items.length > 0) return callback(null, items);

        connection.all(`SELECT player_name, player_number, size, model FROM order_items WHERE order_id = ? AND reference_type = 'quote' ORDER BY id ASC`, [quoteId], callback);
    });
}

function syncQuoteDataToOrder(connection, quote, orderId, callback) {
    connection.run(
        `
            UPDATE orders
            SET
                client_name = ?,
                product_type = ?,
                fabric_type = ?,
                category = ?,
                sizes_json = ?,
                total_price = ?,
                status = CASE WHEN status = 'Cancelado' AND quote_id IS NULL AND EXISTS (
                    SELECT 1 FROM order_history WHERE order_id = orders.id AND status_text = 'Pedido revertido para orcamento'
                ) THEN 'Criação de Arte' ELSE status END,
                cost_price = ?,
                delivery_date = ?,
                layout_path = ?,
                discount = ?,
                cor = ?,
                tipo_estampa = ?,
                observacao = ?,
                url_referencia = ?,
                allowed_sizes = ?,
                allowed_models = ?,
                unit_price = ?,
                unit_cost = ?,
                quote_id = ?,
                is_locked_by_client = CASE WHEN ? = 1 THEN 1 ELSE is_locked_by_client END
            WHERE id = ?
        `,
        [
            quote.client_name,
            quote.product_type,
            quote.fabric_type,
            quote.category,
            quote.sizes_json,
            quote.total_price,
            quote.cost_price,
            quote.delivery_date,
            quote.layout_path,
            quote.discount || 0,
            quote.cor || null,
            quote.tipo_estampa || null,
            quote.observacao || null,
            quote.url_referencia || null,
            quote.allowed_sizes || null,
            quote.allowed_models || null,
            Number(quote.unit_price || 0),
            Number(quote.unit_cost || 0),
            quote.id,
            quote.is_locked_by_client ? 1 : 0,
            orderId
        ],
        callback
    );
}

function copyQuoteItemsToOrder(connection, quoteId, orderId, callback) {
    getQuoteItems(connection, quoteId, (err, items) => {
        if (err) return callback(err);
        connection.run(`DELETE FROM order_items WHERE order_id = ? AND (reference_type = 'order' OR reference_type IS NULL)`, [orderId], (deleteErr) => {
            if (deleteErr) return callback(deleteErr);
            if (!items || items.length === 0) return callback(null, 0);

            const stmt = connection.prepare(`INSERT INTO order_items (order_id, player_name, player_number, size, model, reference_type) VALUES (?, ?, ?, ?, ?, 'order')`);
            let pending = items.length;
            let inserted = 0;
            let done = false;

            const finish = (runErr) => {
                if (done) return;
                if (runErr) {
                    done = true;
                    return stmt.finalize(() => callback(runErr));
                }

                pending -= 1;
                if (pending === 0) {
                    done = true;
                    stmt.finalize((finalizeErr) => callback(finalizeErr, inserted));
                }
            };

            items.forEach((item) => {
                const safeName = (item.player_name || '').replace(/,/g, '');
                stmt.run([orderId, safeName, item.player_number, item.size, item.model || ''], (runErr) => {
                    if (!runErr) inserted += 1;
                    finish(runErr);
                });
            });
        });
    });
}

function copyQuoteProductLinesToOrder(connection, quoteId, orderId, callback) {
    fetchQuoteProductLines(connection, quoteId, (err, lines) => {
        if (err) return callback(err);

        const normalizedLines = (lines || []).map((line, index) => {
            const sizes = parseSizesValue(line.sizes_json);
            return {
                sort_order: line.sort_order ?? index,
                product_type: line.product_type || 'Produto',
                production_label: line.production_label || line.product_type || 'Produto',
                printing_types_json: JSON.stringify(parseStringArray(line.printing_types_json)),
                production_notes: line.production_notes || '',
                fabric_type: line.fabric_type || '',
                sizes_json: safeStringifyJSON(sizes),
                unit_price: Number(line.unit_price || 0),
                unit_cost: Number(line.unit_cost || 0),
                total_price: Number(line.total_price || 0),
                cost_price: Number(line.cost_price || 0),
                layout_path: line.layout_path || null
            };
        });

        saveOrderProductLines(connection, orderId, normalizedLines, callback);
    });
}

router.post('/api/quotes', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_vendas', 'gerente_operacoes', 'designer']), upload.any(), (req, res) => {
    const {
        client_name,
        category,
        delivery_date,
        status,
        discount,
        cor,
        tipo_estampa,
        observacao,
        url_referencia,
        allowed_sizes,
        allowed_models,
        amount_paid
    } = req.body;

    const initialStatus = status || 'Em Análise';
    const quoteLines = normalizeQuoteProductLines(req.body, req.files || []);

    if (!quoteLines.length) {
        return res.status(400).json({ error: 'Adicione pelo menos um produto ao orçamento.' });
    }

    const summary = summarizeLines(quoteLines, discount);
    const sizesStr = typeof allowed_sizes === 'object' ? JSON.stringify(allowed_sizes) : allowed_sizes;
    const modelsStr = typeof allowed_models === 'object' ? JSON.stringify(allowed_models) : allowed_models;
    const portalToken = generatePortalToken();

    db.run(
        `INSERT INTO quotes (
            tracking_code, client_name, product_type, fabric_type, category, sizes_json, total_price, cost_price,
            delivery_date, layout_path, status, discount, cor, tipo_estampa, observacao, url_referencia,
            created_by_user_id, board_order, unit_price, unit_cost, allowed_sizes, allowed_models, amount_paid, portal_token
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
        [
            generateQuoteTrackingCode(),
            client_name,
            summary.product_type,
            summary.fabric_type,
            category || 'Geral',
            summary.sizes_json,
            summary.total_price,
            summary.cost_price,
            delivery_date,
            summary.layout_path,
            initialStatus,
            Number(discount || 0),
            cor || null,
            tipo_estampa || null,
            observacao || null,
            url_referencia || null,
            req.user.id,
            summary.unit_price,
            summary.unit_cost,
            sizesStr || null,
            modelsStr || null,
            Number(amount_paid || 0),
            portalToken
        ],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });

            const quoteId = this.lastID;
            saveQuoteProductLines(quoteId, quoteLines, (linesErr) => {
                if (linesErr) return res.status(500).json({ error: linesErr.message });
                db.run(`INSERT INTO quote_history (quote_id, status_text, changed_by_user_id) VALUES (?, ?, ?)`, [quoteId, initialStatus, req.user.id]);
                db.get(`SELECT tracking_code, portal_token FROM quotes WHERE id = ?`, [quoteId], (fetchErr, createdQuote) => {
                    if (fetchErr) return res.status(500).json({ error: fetchErr.message });
                    res.json({
                        message: 'Orçamento criado com sucesso!',
                        tracking_code: createdQuote.tracking_code,
                        portal_path: buildPortalPath(createdQuote)
                    });
                });
            });
        }
    );
});

router.put('/api/quotes/:id', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_vendas', 'gerente_operacoes', 'designer']), upload.any(), (req, res) => {
    const {
        client_name,
        category,
        delivery_date,
        discount,
        cor,
        tipo_estampa,
        observacao,
        url_referencia,
        allowed_sizes,
        allowed_models,
        amount_paid
    } = req.body;

    const quoteLines = normalizeQuoteProductLines(req.body, req.files || []);

    if (!quoteLines.length) {
        return res.status(400).json({ error: 'Adicione pelo menos um produto ao orçamento.' });
    }

    const summary = summarizeLines(quoteLines, discount);
    const sizesStr = typeof allowed_sizes === 'object' ? JSON.stringify(allowed_sizes) : allowed_sizes;
    const modelsStr = typeof allowed_models === 'object' ? JSON.stringify(allowed_models) : allowed_models;

    db.run(
        `UPDATE quotes SET
            client_name = ?,
            product_type = ?,
            fabric_type = ?,
            category = ?,
            sizes_json = ?,
            total_price = ?,
            cost_price = ?,
            delivery_date = ?,
            layout_path = ?,
            discount = ?,
            cor = ?,
            tipo_estampa = ?,
            observacao = ?,
            url_referencia = ?,
            unit_price = ?,
            unit_cost = ?,
            allowed_sizes = ?,
            allowed_models = ?,
            amount_paid = ?
        WHERE id = ?`,
        [
            client_name,
            summary.product_type,
            summary.fabric_type,
            category || 'Geral',
            summary.sizes_json,
            summary.total_price,
            summary.cost_price,
            delivery_date,
            summary.layout_path,
            Number(discount || 0),
            cor || null,
            tipo_estampa || null,
            observacao || null,
            url_referencia || null,
            summary.unit_price,
            summary.unit_cost,
            sizesStr || null,
            modelsStr || null,
            Number(amount_paid || 0),
            req.params.id
        ],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Orçamento não encontrado.' });

            saveQuoteProductLines(req.params.id, quoteLines, (linesErr) => {
                if (linesErr) return res.status(500).json({ error: linesErr.message });
                res.json({ message: 'Orçamento atualizado.' });
            });
        }
    );
});

router.get('/api/quotes', authenticateToken, (req, res) => {
    db.all(`
        SELECT q.*
        FROM quotes q
        WHERE (q.status IS NULL OR q.status != ?)
          AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.quote_id = q.id)
        ORDER BY q.created_at DESC
    `, [QUOTE_CONVERTED_STATUS], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
            quotes: (rows || []).filter(shouldShowQuoteInList).map((row) => ({
                ...row,
                sizes_json: safeParseJSON(row.sizes_json)
            }))
        });
    });
});

router.delete('/api/quotes/:id', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_vendas', 'gerente_operacoes']), (req, res) => {
    db.run('DELETE FROM quote_items WHERE quote_id=?', [req.params.id], () => {
        db.run('DELETE FROM quote_history WHERE quote_id=?', [req.params.id], () => {
            db.run('DELETE FROM quote_product_lines WHERE quote_id=?', [req.params.id], () => {
                db.run('DELETE FROM quotes WHERE id=?', [req.params.id], (err2) => {
                    if (err2) return res.status(500).json({ error: err2.message });
                    res.json({ message: 'Orçamento excluído.' });
                });
            });
        });
    });
});

router.post('/api/quotes/:id/convert', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_vendas', 'gerente_operacoes']), async (req, res) => {
    try {
        const result = await withFinanceWrite(appPaths.databasePath, async (tx, connection) => {
            const quote = await tx.get('SELECT * FROM quotes WHERE id=?', [req.params.id]);
            if (!quote) throw Object.assign(new Error('Orçamento não encontrado.'), { status: 404 });
            let order = await tx.get('SELECT * FROM orders WHERE quote_id=? ORDER BY id DESC LIMIT 1', [quote.id]);
            const newOrderCode = buildOrderCodeFromQuoteCode(quote.tracking_code) || generateTrackingCode();
            if (!order) {
                order = await tx.get('SELECT * FROM orders WHERE tracking_code=? OR legacy_tracking_code=?', [newOrderCode, newOrderCode]);
                if (order && !canAdoptOrderForQuote(order, quote)) {
                    throw Object.assign(new Error(`Já existe um pedido com o código ${newOrderCode}.`), { status: 409 });
                }
            }
            let orderId;
            if (order) {
                orderId = order.id;
                await promisify(syncQuoteDataToOrder)(connection, quote, orderId);
            } else {
                const inserted = await tx.run(`
                    INSERT INTO orders (
                        tracking_code, client_name, product_type, fabric_type, category, sizes_json, total_price,
                        amount_paid, cost_price, delivery_date, layout_path, status, quote_id, board_order, discount,
                        allowed_sizes, allowed_models, unit_price, unit_cost, cor, tipo_estampa, observacao, url_referencia,
                        portal_token
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Criação de Arte', ?, 999999, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    newOrderCode,
                    quote.client_name,
                    quote.product_type,
                    quote.fabric_type,
                    quote.category,
                    quote.sizes_json,
                    quote.total_price,
                    Number(quote.amount_paid || 0),
                    quote.cost_price,
                    quote.delivery_date,
                    quote.layout_path,
                    quote.id,
                    quote.discount || 0,
                    quote.allowed_sizes || null,
                    quote.allowed_models || null,
                    Number(quote.unit_price || 0),
                    Number(quote.unit_cost || 0),
                    quote.cor || null,
                    quote.tipo_estampa || null,
                    quote.observacao || null,
                    quote.url_referencia || null,
                    generatePortalToken()
                ]);
                orderId = inserted.lastID;
            }
            const copiedCount = await promisify(copyQuoteItemsToOrder)(connection, quote.id, orderId);
            await promisify(copyQuoteProductLinesToOrder)(connection, quote.id, orderId);
            await syncOrderFinance(tx, orderId, { depositChanged: !order, previousDelivery: order?.delivery_date });
            const history = order ? 'Pedido sincronizado com orçamento' : 'Pedido Gerado via Orçamento';
            await tx.run('INSERT INTO order_history (order_id,status_text,changed_by_user_id) VALUES (?,?,?)',
                [orderId, copiedCount ? `${history} (${copiedCount} item(ns))` : history, req.user.id]);
            await tx.run('UPDATE quotes SET status=? WHERE id=?', [QUOTE_CONVERTED_STATUS, quote.id]);
            await tx.run('INSERT INTO quote_history (quote_id,status_text,changed_by_user_id) VALUES (?,?,?)',
                [quote.id, order ? 'Pedido já existia; dados, produtos e lista sincronizados' : QUOTE_CONVERTED_STATUS, req.user.id]);
            if (!order) {
                await tx.run('INSERT INTO notifications (target_role,title,message) VALUES (?,?,?)',
                    ['designer', 'Novo Pedido para Arte', `O orçamento aprovado de ${quote.client_name} entrou na fila.`]);
            }
            return { orderId, message: order ? 'Pedido existente sincronizado!' : 'Orçamento convertido em pedido!',
                tracking_code: order?.tracking_code || newOrderCode, copied_items: copiedCount, ...(order && { already_exists: true }) };
        });
        const { orderId, ...payload } = result;
        enqueueCalendarUpsert(orderId).catch(error => console.error('Falha ao enfileirar Google Agenda:', error.message));
        res.json(payload);
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
});

router.get('/api/quotes/:code/history', authenticateToken, (req, res) => {
    db.get(`SELECT * FROM quotes WHERE tracking_code=?`, [req.params.code], (err, quote) => {
        if (err || !quote) return res.status(404).json({ message: 'Orçamento não encontrado.' });

        db.all(`SELECT qh.status_text, qh.change_timestamp, COALESCE(u.name, 'Cliente') AS changed_by_name FROM quote_history qh LEFT JOIN users u ON qh.changed_by_user_id = u.id WHERE qh.quote_id = ? ORDER BY qh.change_timestamp ASC`, [quote.id], (historyErr, history) => {
            if (historyErr) return res.status(500).json({ error: historyErr.message });

            getQuoteItems(db, quote.id, (itemsErr, items) => {
                if (itemsErr) return res.status(500).json({ error: itemsErr.message });

                fetchQuoteProductLines(db, quote.id, (linesErr, productLines) => {
                    if (linesErr) return res.status(500).json({ error: linesErr.message });

                    res.json({
                        ...quote,
                        sizes_json: safeParseJSON(quote.sizes_json),
                        allowed_sizes: quote.allowed_sizes ? safeParseJSON(quote.allowed_sizes) : null,
                        allowed_models: quote.allowed_models ? safeParseJSON(quote.allowed_models) : null,
                        history,
                        items: items || [],
                        product_lines: productLines || []
                    });
                });
            });
        });
    });
});

router.post('/api/quotes/:code/status', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_vendas', 'gerente_operacoes', 'designer']), (req, res) => {
    const { new_status } = req.body;
    if (!QUOTE_STATUS_VALUES.has(new_status)) {
        return res.status(400).json({ error: 'Status de orçamento inválido.' });
    }

    db.get(`SELECT id FROM quotes WHERE tracking_code=?`, [req.params.code], (err, quote) => {
        if (err || !quote) return res.status(404).json({ message: 'Não encontrado.' });
        db.run(`UPDATE quotes SET status=? WHERE id=?`, [new_status, quote.id], (updateErr) => {
            if (updateErr) return res.status(500).json({ error: updateErr.message });
            db.run(`INSERT INTO quote_history (quote_id, status_text, changed_by_user_id) VALUES (?, ?, ?)`, [quote.id, new_status, req.user.id]);
            res.json({ message: 'Status atualizado.' });
        });
    });
});

router.post('/api/quotes/:code/reset', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_vendas', 'gerente_operacoes']), (req, res) => {
    withFinanceWrite(appPaths.databasePath, async tx => {
        const quote = await tx.get('SELECT id FROM quotes WHERE tracking_code=?', [req.params.code]);
        if (!quote) throw Object.assign(new Error('Orçamento não encontrado.'), { status: 404 });
        const orders = await tx.all('SELECT id FROM orders WHERE quote_id=?', [quote.id]);
        for (const order of orders) await deleteUnpaidOrder(tx, order.id);
        await tx.run("UPDATE quotes SET status='Em Análise', is_locked_by_client=0 WHERE id=?", [quote.id]);
        await tx.run("INSERT INTO quote_history (quote_id, status_text, changed_by_user_id) VALUES (?, 'Orçamento Reiniciado e Liberado para Cliente', ?)", [quote.id, req.user.id]);
    }).then(() => res.json({ message: 'Orçamento reiniciado e liberado para nova edição.' }))
      .catch(error => res.status(error.status || 500).json({ error: error.message }));
});

router._test = { buildOrderCodeFromQuoteCode, shouldShowQuoteInList, canAdoptOrderForQuote };

module.exports = router;
