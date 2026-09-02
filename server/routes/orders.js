const express = require('express');
const router = express.Router();
const db = require('../database');
const archiver = require('archiver');
const crypto = require('crypto');
const { authenticateToken, authorizeRole } = require('../middlewares/auth');
const { createLayoutUpload } = require('../utils/layoutUpload');
const {
    EVOLUTION_API_KEY,
    EVOLUTION_INSTANCE,
    createEvolutionClient,
    buildEvolutionTextPayload
} = require('../config/evolution');
const { appConfig, buildTrackingCode, normalizeTrackingCode } = require('../config/appConfig');
const { appPaths } = require('../config/paths');

db.run("ALTER TABLE orders ADD COLUMN amount_paid REAL DEFAULT 0", (err) => { /* Ignora se já existir */ });
db.run("ALTER TABLE orders ADD COLUMN client_id INTEGER", () => {});
db.run("ALTER TABLE orders ADD COLUMN client_phone TEXT", () => {});
db.run("ALTER TABLE orders ADD COLUMN portal_token TEXT", () => {});
db.run("ALTER TABLE quotes ADD COLUMN portal_token TEXT", () => {});
db.run(`
    CREATE TABLE IF NOT EXISTS whatsapp_order_status_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        tracking_code TEXT NOT NULL,
        phone TEXT NOT NULL,
        old_status TEXT,
        new_status TEXT NOT NULL,
        message TEXT NOT NULL,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        error TEXT,
        UNIQUE(order_id, new_status, phone)
    )
`);

if (!EVOLUTION_API_KEY) {
    console.warn('EVOLUTION_API_KEY não definida. Envios WhatsApp pela Evolution API podem falhar.');
}

const evolution = createEvolutionClient();

const upload = createLayoutUpload();

function safeParseJSON(jsonString) { try { if (!jsonString || jsonString === '[object Object]') return {}; return JSON.parse(jsonString); } catch (e) { return {}; } }
function generateTrackingCode() { return buildTrackingCode(appConfig.orderPrefix); }
function generateQuoteTrackingCode() { return buildTrackingCode(appConfig.quotePrefix); }
function generatePortalToken() { return crypto.randomBytes(24).toString('base64url'); }

const ORDER_STATUS_VALUES = new Set([
    'Criação de Arte',
    'Em Criação',
    'Ajustes',
    'Aguardando Aprovação',
    'Arte Aprovada/Liberada',
    'Corte Iniciado',
    'Impressão/Estampa Iniciada',
    'Costura Iniciada',
    'Controle de Qualidade',
    'Pronto para Envio',
    'Entregue/Concluído',
    'Arte Arquivada',
    'Cancelado'
]);

const QUOTE_STATUS_VALUES = new Set([
    'Em Análise',
    'Enviado ao Cliente',
    'Aprovado',
    'Recusado',
    'Cancelado'
]);

const CLIENT_LIST_SUBMITTED_STATUS = 'Lista Enviada pelo Cliente (Termo Assinado)';
const ORDER_LIST_UNLOCKED_STATUS = 'Lista Desbloqueada';
const QUOTE_LIST_UNLOCKED_STATUS = 'Lista Desbloqueada para Cliente';

function buildPortalPath(record) {
    return `/portal/${encodeURIComponent(record.tracking_code)}?token=${encodeURIComponent(record.portal_token || '')}`;
}

function normalizePortalTrackingCode(value) {
    let safeCode = String(value || '').trim().toUpperCase();

    try {
        safeCode = decodeURIComponent(safeCode).trim().toUpperCase();
    } catch {
        // Mantem o valor original se vier com encoding invalido.
    }

    return normalizeTrackingCode(safeCode, appConfig.orderPrefix);
}

function getPortalToken(req) {
    return String(req.query.token || req.headers['x-portal-token'] || req.body?.portal_token || '').trim();
}

function tokenMatches(storedToken, providedToken) {
    if (!storedToken || !providedToken) return false;

    const storedBuffer = Buffer.from(String(storedToken));
    const providedBuffer = Buffer.from(String(providedToken));

    return storedBuffer.length === providedBuffer.length
        && crypto.timingSafeEqual(storedBuffer, providedBuffer);
}

function requirePortalToken(record, req, res) {
    const suppliedToken = getPortalToken(req);

    if (tokenMatches(record?.portal_token, suppliedToken)) return true;

    res.status(403).json({ error: 'Link do portal inválido ou incompleto.' });
    return false;
}

function ensurePortalToken(tableName, record, callback) {
    if (!record) return callback(null, record);
    if (record.portal_token) return callback(null, record);

    const token = generatePortalToken();
    db.run(`UPDATE ${tableName} SET portal_token = ? WHERE id = ?`, [token, record.id], (err) => {
        if (err) return callback(err);
        callback(null, { ...record, portal_token: token });
    });
}

function findPortalRecordByCode(code, callback) {
    const safeCode = normalizePortalTrackingCode(code);

    db.get(`SELECT id, tracking_code, portal_token FROM orders WHERE tracking_code = ?`, [safeCode], (orderErr, order) => {
        if (orderErr) return callback(orderErr);
        if (order) {
            return ensurePortalToken('orders', order, (ensureErr, ensuredOrder) => {
                callback(ensureErr, ensuredOrder ? { ...ensuredOrder, type: 'order' } : null);
            });
        }

        db.get(`SELECT id, tracking_code, portal_token FROM quotes WHERE tracking_code = ?`, [safeCode], (quoteErr, quote) => {
            if (quoteErr) return callback(quoteErr);
            ensurePortalToken('quotes', quote, (ensureErr, ensuredQuote) => {
                callback(ensureErr, ensuredQuote ? { ...ensuredQuote, type: 'quote' } : null);
            });
        });
    });
}

function safeStringifyJSON(value) {
    try {
        return JSON.stringify(value || {});
    } catch (error) {
        return '{}';
    }
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

function normalizeOrderProductLines(body, files = []) {
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
        product_type: uniqueProducts.length <= 1 ? (uniqueProducts[0] || 'Produto') : `Pedido com ${uniqueProducts.length} produtos`,
        fabric_type: uniqueFabrics.length <= 1 ? (uniqueFabrics[0] || '') : 'Variados',
        sizes_json: safeStringifyJSON(aggregateSizes),
        total_price: Math.max(0, grossTotal - (Number(discount) || 0)),
        cost_price: totalCost,
        unit_price: lines.length === 1 ? Number(lines[0].unit_price || 0) : 0,
        unit_cost: lines.length === 1 ? Number(lines[0].unit_cost || 0) : 0,
        layout_path: firstLayout
    };
}

function saveOrderProductLines(orderId, lines, callback) {
    db.run(`DELETE FROM order_product_lines WHERE order_id = ?`, [orderId], (deleteErr) => {
        if (deleteErr) return callback(deleteErr);
        if (!lines.length) return callback(null);

        const stmt = db.prepare(`
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

function sumSizes(sizes) {
    return Object.values(sizes || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function summarizeItemsBySize(items = []) {
    return (items || []).reduce((sizes, item) => {
        const size = String(item?.size || '').trim();
        if (size) sizes[size] = (sizes[size] || 0) + 1;
        return sizes;
    }, {});
}

function fetchSubmittedOrderSizes(orderId, callback) {
    db.all(`
        SELECT size, COUNT(*) AS qty
        FROM order_items
        WHERE order_id = ?
          AND (reference_type = 'order' OR reference_type IS NULL)
          AND COALESCE(size, '') <> ''
        GROUP BY size
    `, [orderId], (err, rows = []) => {
        if (err) return callback(err);

        const sizes = {};
        rows.forEach((row) => {
            const size = String(row.size || '').trim();
            if (size) sizes[size] = Number(row.qty || 0);
        });

        callback(null, sizes);
    });
}

function attachEffectiveSubmittedSizes(rows = [], callback) {
    const rowsWithStoredSizes = (rows || []).map((row) => ({
        ...row,
        effective_sizes_json: parseSizesValue(row.sizes_json)
    }));
    const orderIds = rowsWithStoredSizes
        .filter((row) => row.id && sumSizes(row.effective_sizes_json) === 0)
        .map((row) => row.id);

    if (orderIds.length === 0) return callback(null, rowsWithStoredSizes);

    const placeholders = orderIds.map(() => '?').join(',');
    db.all(`
        SELECT order_id, size, COUNT(*) AS qty
        FROM order_items
        WHERE order_id IN (${placeholders})
          AND (reference_type = 'order' OR reference_type IS NULL)
          AND COALESCE(size, '') <> ''
        GROUP BY order_id, size
    `, orderIds, (err, submittedRows = []) => {
        if (err) return callback(err);

        const sizesByOrder = submittedRows.reduce((accumulator, row) => {
            const orderId = row.order_id;
            const size = String(row.size || '').trim();
            if (!accumulator[orderId]) accumulator[orderId] = {};
            if (size) accumulator[orderId][size] = Number(row.qty || 0);
            return accumulator;
        }, {});

        callback(null, rowsWithStoredSizes.map((row) => ({
            ...row,
            effective_sizes_json: sumSizes(row.effective_sizes_json) > 0
                ? row.effective_sizes_json
                : (sizesByOrder[row.id] || row.effective_sizes_json)
        })));
    });
}

function normalizeProductLinesForResponse(rows = [], record = {}) {
    const recordSizes = parseSizesValue(record.sizes_json);
    const recordHasSizes = sumSizes(recordSizes) > 0;
    const submittedSizes = parseSizesValue(record.submitted_sizes_json);
    const submittedHasSizes = sumSizes(submittedSizes) > 0;
    const fallbackSizes = recordHasSizes ? recordSizes : submittedSizes;
    const fallbackHasSizes = recordHasSizes || submittedHasSizes;
    const paidFallback = Math.max(Number(record.amount_paid || 0), Number(record.synced_amount_paid || 0));
    const recordTotal = Math.max(Number(record.total_price || 0), paidFallback);

    return (rows || []).map((row) => {
        const lineSizes = parseSizesValue(row.sizes_json);
        const shouldUseRecordSizes = rows.length === 1 && sumSizes(lineSizes) === 0 && fallbackHasSizes;
        const sizes = shouldUseRecordSizes ? fallbackSizes : lineSizes;
        const quantity = sumSizes(sizes);
        const unitPrice = Number(row.unit_price || record.unit_price || row.product_sale_price || 0);
        const unitCost = Number(row.unit_cost || record.unit_cost || row.product_production_cost || 0);
        const currentTotal = Number(row.total_price || 0);
        const currentCost = Number(row.cost_price || 0);
        const effectiveUnitPrice = unitPrice > 0 ? unitPrice : (quantity > 0 && recordTotal > 0 ? recordTotal / quantity : 0);

        return {
            ...row,
            printing_types_json: parseStringArray(row.printing_types_json),
            sizes_json: sizes,
            unit_price: effectiveUnitPrice,
            unit_cost: unitCost,
            total_price: currentTotal > 0 ? currentTotal : (quantity > 0 && effectiveUnitPrice > 0 ? quantity * effectiveUnitPrice : recordTotal),
            cost_price: currentCost > 0 ? currentCost : (quantity > 0 && unitCost > 0 ? quantity * unitCost : Number(record.cost_price || 0))
        };
    });
}

function fetchOrderProductLines(orderId, callback) {
    db.all(`
        SELECT opl.*, p.sale_price AS product_sale_price, p.production_cost AS product_production_cost
        FROM order_product_lines opl
        LEFT JOIN products p ON p.name = opl.product_type
        WHERE opl.order_id = ?
        ORDER BY opl.sort_order ASC, opl.id ASC
    `, [orderId], (err, rows) => {
        if (err) return callback(err);

        if (rows && rows.length > 0) {
            return db.get(`SELECT sizes_json, total_price, cost_price, unit_price, unit_cost, amount_paid FROM orders WHERE id = ?`, [orderId], (orderErr, order) => {
                if (orderErr) return callback(orderErr);
                fetchSubmittedOrderSizes(orderId, (sizesErr, submittedSizes) => {
                    if (sizesErr) return callback(sizesErr);
                    callback(null, normalizeProductLinesForResponse(rows, { ...(order || {}), submitted_sizes_json: submittedSizes }));
                });
            });
        }

        db.get(`SELECT * FROM orders WHERE id = ?`, [orderId], (orderErr, order) => {
            if (orderErr) return callback(orderErr);
            if (!order) return callback(null, []);

            fetchSubmittedOrderSizes(orderId, (sizesErr, submittedSizes) => {
                if (sizesErr) return callback(sizesErr);

                const orderSizes = safeParseJSON(order.sizes_json);
                const sizes = sumSizes(orderSizes) > 0 ? orderSizes : submittedSizes;
                const quantity = sumSizes(sizes);
                const unitPrice = Number(order.unit_price || 0);
                const unitCost = Number(order.unit_cost || 0);
                const totalPrice = Number(order.total_price || 0);
                const costPrice = Number(order.cost_price || 0);

                callback(null, [{
                    id: `legacy-${order.id}`,
                    order_id: order.id,
                    sort_order: 0,
                    product_type: order.product_type || 'Produto',
                    production_label: order.product_type || 'Produto',
                    printing_types_json: [],
                    production_notes: '',
                    fabric_type: order.fabric_type || '',
                    sizes_json: sizes,
                    unit_price: unitPrice,
                    unit_cost: unitCost,
                    total_price: totalPrice > 0 ? totalPrice : (quantity > 0 && unitPrice > 0 ? quantity * unitPrice : Number(order.amount_paid || 0)),
                    cost_price: costPrice > 0 ? costPrice : (quantity > 0 && unitCost > 0 ? quantity * unitCost : 0),
                    layout_path: order.layout_path || null
                }]);
            });
        });
    });
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
                typeof line.printing_types_json === 'string'
                    ? line.printing_types_json
                    : JSON.stringify(parseStringArray(line.printing_types_json)),
                line.production_notes || null,
                line.fabric_type || '',
                typeof line.sizes_json === 'string'
                    ? line.sizes_json
                    : safeStringifyJSON(line.sizes_json),
                Number(line.unit_price || 0),
                Number(line.unit_cost || 0),
                Number(line.total_price || 0),
                Number(line.cost_price || 0),
                line.layout_path || null
            ], finish);
        });
    });
}

function copyOrderItemsToQuote(orderId, quoteId, callback) {
    db.all(`SELECT player_name, player_number, size, model FROM order_items WHERE order_id = ? AND (reference_type = 'order' OR reference_type IS NULL) ORDER BY id ASC`, [orderId], (err, items) => {
        if (err) return callback(err);

        db.run(`DELETE FROM quote_items WHERE quote_id = ?`, [quoteId], (deleteErr) => {
            if (deleteErr) return callback(deleteErr);
            if (!items || items.length === 0) return callback(null, 0);

            const stmt = db.prepare(`INSERT INTO quote_items (quote_id, player_name, player_number, size, model) VALUES (?, ?, ?, ?, ?)`);
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
                stmt.run([quoteId, safeName, item.player_number, item.size, item.model || ''], (runErr) => {
                    if (!runErr) inserted += 1;
                    finish(runErr);
                });
            });
        });
    });
}

function syncFinanceWithOrder(orderId, callback = () => {}) {
    const safeOrderId = Number(orderId);
    if (!Number.isInteger(safeOrderId) || safeOrderId <= 0) {
        callback(null);
        return;
    }

    db.get(`SELECT * FROM orders WHERE id = ?`, [safeOrderId], (err, order) => {
        if (err) {
            callback(err);
            return;
        }

        if (!order) {
            callback(null);
            return;
        }

        db.get(`
            SELECT COALESCE(SUM(amount), 0) AS manual_paid
            FROM transactions
            WHERE order_id = ?
              AND type = 'Receita'
              AND status = 'Pago'
              AND description NOT LIKE 'Sinal/Pago - Pedido %'
        `, [safeOrderId], (manualPaidErr, paidRow) => {
            if (manualPaidErr) {
                callback(manualPaidErr);
                return;
            }

            db.run(`
                DELETE FROM transactions
                WHERE order_id = ?
                  AND type = 'Receita'
                  AND (
                      (status = 'Pago' AND description LIKE 'Sinal/Pago - Pedido %')
                      OR (status = 'Pendente' AND description LIKE 'Falta Pagar - Pedido %')
                  )
            `, [safeOrderId], (deleteErr) => {
                if (deleteErr) {
                    callback(deleteErr);
                    return;
                }

                if (order.status === 'Cancelado' || order.status === 'Arte Arquivada') {
                    callback(null);
                    return;
                }

                const dateEntrega = order.delivery_date || new Date().toISOString().split('T')[0];
                const dateHoje = new Date().toISOString().split('T')[0];
                const total = parseFloat(order.total_price) || 0;
                const manualPaid = Number(paidRow?.manual_paid || 0);
                const storedPaid = parseFloat(order.amount_paid) || 0;
                const autoPaid = Math.max(0, Math.min(storedPaid, total));
                const remaining = Math.max(0, total - manualPaid - autoPaid);
                const clientName = order.client_name ? ` - ${order.client_name}` : '';
                const operations = [];

                if (autoPaid > 0) {
                    operations.push({
                        sql: `INSERT INTO transactions (description, type, status, amount, due_date, payment_date, order_id) VALUES (?, 'Receita', 'Pago', ?, ?, ?, ?)`,
                        params: [`Sinal/Pago - Pedido ${order.tracking_code}${clientName}`, autoPaid, dateHoje, dateHoje, safeOrderId]
                    });
                }

                if (remaining > 0) {
                    operations.push({
                        sql: `INSERT INTO transactions (description, type, status, amount, due_date, order_id) VALUES (?, 'Receita', 'Pendente', ?, ?, ?)`,
                        params: [`Falta Pagar - Pedido ${order.tracking_code}${clientName}`, remaining, dateEntrega, safeOrderId]
                    });
                }

                if (operations.length === 0) {
                    callback(null);
                    return;
                }

                let pending = operations.length;
                let finished = false;

                operations.forEach(({ sql, params }) => {
                    db.run(sql, params, (runErr) => {
                        if (finished) return;

                        if (runErr) {
                            finished = true;
                            callback(runErr);
                            return;
                        }

                        pending -= 1;
                        if (pending === 0) {
                            finished = true;
                            callback(null);
                        }
                    });
                });
            });
        });
    });
}

function buildSyncedAmountPaidExpression(orderAlias = 'orders') {
    return `COALESCE((
        SELECT SUM(tx.amount)
        FROM transactions tx
        WHERE tx.order_id = ${orderAlias}.id
          AND tx.type = 'Receita'
          AND tx.status = 'Pago'
          AND tx.description LIKE 'Sinal/Pago - Pedido %'
    ), 0)`;
}

function buildLatestClientListStatusExpression(recordAlias, historyTable, ownerColumn, unlockedStatus) {
    return `(
        SELECT history.status_text
        FROM ${historyTable} history
        WHERE history.${ownerColumn} = ${recordAlias}.id
          AND history.status_text IN ('${CLIENT_LIST_SUBMITTED_STATUS}', '${unlockedStatus}')
        ORDER BY history.change_timestamp DESC, history.id DESC
        LIMIT 1
    )`;
}

function buildEffectiveClientLockExpression(recordAlias, historyTable, ownerColumn, unlockedStatus) {
    const latestStatus = buildLatestClientListStatusExpression(recordAlias, historyTable, ownerColumn, unlockedStatus);

    return `CASE
        WHEN ${latestStatus} = '${unlockedStatus}' THEN 0
        WHEN ${latestStatus} = '${CLIENT_LIST_SUBMITTED_STATUS}' THEN 1
        WHEN ${recordAlias}.is_locked_by_client IN (1, '1', 'true', 'TRUE') THEN 1
        ELSE 0
    END`;
}

function buildEffectiveOrderClientLockExpression(orderAlias = 'orders') {
    return buildEffectiveClientLockExpression(orderAlias, 'order_history', 'order_id', ORDER_LIST_UNLOCKED_STATUS);
}

function buildEffectiveQuoteClientLockExpression(quoteAlias = 'quotes') {
    return buildEffectiveClientLockExpression(quoteAlias, 'quote_history', 'quote_id', QUOTE_LIST_UNLOCKED_STATUS);
}

function normalizeClientLockRow(row) {
    if (!row) return row;

    const effectiveValue = row.effective_is_locked_by_client !== undefined
        ? row.effective_is_locked_by_client
        : row.is_locked_by_client;

    return {
        ...row,
        is_locked_by_client: effectiveValue === 1 || effectiveValue === true || effectiveValue === '1' || effectiveValue === 'true' || effectiveValue === 'TRUE' ? 1 : 0
    };
}

function buildSubmittedOrderItemCountExpression(orderAlias = 'orders') {
    return `COALESCE((
        SELECT COUNT(*)
        FROM order_items oi
        WHERE oi.order_id = ${orderAlias}.id
          AND (oi.reference_type = 'order' OR oi.reference_type IS NULL)
          AND COALESCE(oi.size, '') <> ''
    ), 0)`;
}

function buildEffectiveOrderTotalExpression(orderAlias = 'orders') {
    const submittedItemCount = buildSubmittedOrderItemCountExpression(orderAlias);
    const primaryUnitPrice = `COALESCE(
        NULLIF((
            SELECT opl.unit_price
            FROM order_product_lines opl
            WHERE opl.order_id = ${orderAlias}.id
            ORDER BY opl.sort_order ASC, opl.id ASC
            LIMIT 1
        ), 0),
        NULLIF(${orderAlias}.unit_price, 0),
        NULLIF((
            SELECT p.sale_price
            FROM products p
            WHERE p.name = ${orderAlias}.product_type
            LIMIT 1
        ), 0),
        0
    )`;
    const submittedItemsTotal = `CASE
        WHEN ${submittedItemCount} > 0 AND ${primaryUnitPrice} > 0
            THEN MAX(0, (${submittedItemCount} * ${primaryUnitPrice}) - COALESCE(${orderAlias}.discount, 0))
        ELSE 0
    END`;

    return `MAX(
        COALESCE(${orderAlias}.total_price, 0),
        ${submittedItemsTotal},
        COALESCE(${orderAlias}.amount_paid, 0),
        ${buildSyncedAmountPaidExpression(orderAlias)}
    )`;
}

function normalizeOrderFinancialRow(row) {
    if (!row) return row;

    const normalizedRow = normalizeClientLockRow(row);
    const storedAmountPaid = Number(row.amount_paid || 0);
    const syncedAmountPaid = Number(row.synced_amount_paid || 0);
    const effectiveTotalPrice = Math.max(
        Number(row.total_price || 0),
        Number(row.effective_total_price || 0),
        storedAmountPaid,
        syncedAmountPaid
    );

    return {
        ...normalizedRow,
        total_price: effectiveTotalPrice,
        synced_amount_paid: syncedAmountPaid,
        amount_paid: storedAmountPaid
    };
}

function serializeOrderRowForResponse(row) {
    return {
        ...normalizeOrderFinancialRow(row),
        sizes_json: row?.effective_sizes_json || safeParseJSON(row?.sizes_json)
    };
}

function dbGetAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
    });
}

function dbRunAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) return reject(err);
            resolve({ changes: this.changes, lastID: this.lastID });
        });
    });
}

function normalizeWhatsAppNumber(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('55')) return digits;
    if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
    return digits;
}

function resolveOrderClientInput(body, callback) {
    const clientName = String(body.client_name || '').trim();
    const parsedClientId = Number.parseInt(body.client_id, 10);
    const clientId = Number.isInteger(parsedClientId) && parsedClientId > 0 ? parsedClientId : null;
    const typedPhone = normalizeWhatsAppNumber(body.client_phone || body.phone || '');

    const finish = (client = null) => {
        const clientPhone = typedPhone || normalizeWhatsAppNumber(client?.phone || '');
        const resolvedClientId = client?.id || clientId || null;

        if (client?.id && typedPhone && !normalizeWhatsAppNumber(client.phone || '')) {
            db.run(`UPDATE clients SET phone = ? WHERE id = ?`, [typedPhone, client.id], () => {});
        }

        callback(null, {
            client_id: resolvedClientId,
            client_name: clientName || client?.name || '',
            client_phone: clientPhone
        });
    };

    if (clientId) {
        db.get(`SELECT id, name, phone FROM clients WHERE id = ?`, [clientId], (err, client) => {
            if (err) return callback(err);
            finish(client);
        });
        return;
    }

    if (clientName) {
        db.get(`SELECT id, name, phone FROM clients WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1`, [clientName], (err, client) => {
            if (err) return callback(err);
            finish(client);
        });
        return;
    }

    finish(null);
}

function firstName(name) {
    return String(name || '').trim().split(/\s+/)[0] || 'tudo bem';
}

function buildOrderStatusMessage(order, newStatus) {
    const greetingName = firstName(order.client_name);
    const trackingCode = order.tracking_code || '';

    return [
        `Olá, ${greetingName}!`,
        `Seu pedido ${trackingCode} na ${appConfig.brandName} mudou de status para: ${newStatus}.`,
        'Qualquer dúvida, pode responder por aqui.'
    ].join('\n');
}

async function persistWhatsAppConversationMessage(order, contact, message, providerPayload = null, userId = null) {
    if (!contact?.phone || !message) return null;

    await dbRunAsync(
        `INSERT INTO whatsapp_conversations
            (phone, client_id, client_name, last_message_text, last_message_at, updated_at)
         VALUES
            (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT(phone) DO UPDATE SET
            client_id = COALESCE(client_id, excluded.client_id),
            client_name = COALESCE(NULLIF(client_name, ''), excluded.client_name),
            last_message_text = excluded.last_message_text,
            last_message_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP`,
        [
            contact.phone,
            contact.clientId || order.client_id || null,
            contact.clientName || order.client_name || '',
            message
        ]
    );

    const conversation = await dbGetAsync(
        `SELECT id FROM whatsapp_conversations WHERE phone = ?`,
        [contact.phone]
    );

    if (!conversation) return null;

    await dbRunAsync(
        `INSERT OR IGNORE INTO whatsapp_conversation_orders
            (conversation_id, order_id, created_by_user_id)
         VALUES
            (?, ?, ?)`,
        [conversation.id, order.id, userId || null]
    );

    const providerMessageId = providerPayload?.key?.id
        || providerPayload?.message?.key?.id
        || providerPayload?.messageId
        || providerPayload?.id
        || null;

    await dbRunAsync(
        `INSERT OR IGNORE INTO whatsapp_messages
            (conversation_id, provider_message_id, phone, direction, message_type, body, raw_payload, sent_by_user_id)
         VALUES
            (?, ?, ?, 'outgoing', 'text', ?, ?, ?)`,
        [
            conversation.id,
            providerMessageId,
            contact.phone,
            message,
            providerPayload ? safeStringifyJSON(providerPayload) : null,
            userId || null
        ]
    );

    return conversation;
}

async function resolveOrderNotificationContact(order) {
    let phone = normalizeWhatsAppNumber(order.client_phone);
    let clientName = order.client_name || '';
    let clientId = order.client_id || null;

    if ((!phone || !clientName) && clientId) {
        const client = await dbGetAsync(`SELECT id, name, phone FROM clients WHERE id = ?`, [clientId]);
        if (client) {
            phone = phone || normalizeWhatsAppNumber(client.phone);
            clientName = clientName || client.name || '';
        }
    }

    if (!phone && clientName) {
        const client = await dbGetAsync(
            `SELECT id, name, phone FROM clients WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND phone IS NOT NULL AND phone <> '' LIMIT 1`,
            [clientName]
        );
        if (client) {
            phone = normalizeWhatsAppNumber(client.phone);
            clientId = clientId || client.id;
        }
    }

    return { phone, clientName, clientId };
}

async function notifyOrderStatusChange(order, oldStatus, newStatus, userId = null) {
    if (!order || !newStatus || oldStatus === newStatus) {
        return { sent: false, skipped: true, reason: 'status_unchanged' };
    }

    const contact = await resolveOrderNotificationContact(order);
    if (!contact.phone) {
        return { sent: false, skipped: true, reason: 'missing_phone' };
    }

    const previousSent = await dbGetAsync(
        `SELECT id FROM whatsapp_order_status_messages
         WHERE order_id = ? AND new_status = ? AND phone = ? AND error IS NULL
         LIMIT 1`,
        [order.id, newStatus, contact.phone]
    );

    if (previousSent) {
        return { sent: false, skipped: true, reason: 'already_sent', phone: contact.phone };
    }

    const message = buildOrderStatusMessage({
        ...order,
        client_name: order.client_name || contact.clientName
    }, newStatus);

    try {
        const response = await evolution.post(
            `/message/sendText/${EVOLUTION_INSTANCE}`,
            buildEvolutionTextPayload(contact.phone, message, {
                delay: 1000,
                linkPreview: true
            })
        );

        await dbRunAsync(
            `INSERT INTO whatsapp_order_status_messages
                (order_id, tracking_code, phone, old_status, new_status, message, error)
             VALUES (?, ?, ?, ?, ?, ?, NULL)
             ON CONFLICT(order_id, new_status, phone) DO UPDATE SET
                old_status = excluded.old_status,
                message = excluded.message,
                sent_at = CURRENT_TIMESTAMP,
                error = NULL`,
            [order.id, order.tracking_code, contact.phone, oldStatus || '', newStatus, message]
        );

        await persistWhatsAppConversationMessage(order, contact, message, response.data, userId);

        return { sent: true, phone: contact.phone };
    } catch (error) {
        const errorMessage = error.response?.data ? JSON.stringify(error.response.data) : error.message;

        await dbRunAsync(
            `INSERT INTO whatsapp_order_status_messages
                (order_id, tracking_code, phone, old_status, new_status, message, error)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(order_id, new_status, phone) DO UPDATE SET
                old_status = excluded.old_status,
                message = excluded.message,
                sent_at = CURRENT_TIMESTAMP,
                error = excluded.error`,
            [order.id, order.tracking_code, contact.phone, oldStatus || '', newStatus, message, errorMessage]
        );

        return { sent: false, skipped: false, reason: 'send_failed', phone: contact.phone, error: errorMessage };
    }
}

router.post('/api/design-requests', authenticateToken, upload.single('layout_file'), (req, res) => {
    const { client_name, product_type, cor, tipo_estampa, data_entrega_arte, observacao, url_referencia } = req.body;
    const trackingCode = generateTrackingCode();
    const portalToken = generatePortalToken();
    db.run(`INSERT INTO orders (tracking_code, portal_token, client_name, product_type, category, sizes_json, total_price, status, cor, tipo_estampa, data_entrega_arte, observacao, url_referencia, created_by_user_id, layout_path, board_order) VALUES (?, ?, ?, ?, 'Design/Arte', '{}', 0, 'Criação de Arte', ?, ?, ?, ?, ?, ?, ?, 999999)`, 
    [trackingCode, portalToken, client_name, product_type || 'A Definir', cor, tipo_estampa, data_entrega_arte, observacao, url_referencia, req.user.id, req.file ? req.file.filename : null], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        db.run(`INSERT INTO order_history (order_id, status_text, changed_by_user_id) VALUES (?, 'Criação de Arte', ?)`, [this.lastID, req.user.id]);
        db.run(`INSERT INTO notifications (target_role, title, message) VALUES (?, ?, ?)`, ['designer', 'Nova Arte Solicitada', `Uma nova arte para ${client_name} foi adicionada.`]);
        res.json({ message: "Solicitação enviada ao Design!", tracking_code: trackingCode, portal_path: buildPortalPath({ tracking_code: trackingCode, portal_token: portalToken }) });
    });
});

router.put('/api/design-requests/:id', authenticateToken, upload.single('layout_file'), (req, res) => {
    const { client_name, product_type, cor, tipo_estampa, data_entrega_arte, observacao, url_referencia } = req.body;
    let sql = `UPDATE orders SET client_name=?, product_type=?, cor=?, tipo_estampa=?, data_entrega_arte=?, observacao=?, url_referencia=?`;
    const params = [client_name, product_type, cor, tipo_estampa, data_entrega_arte, observacao, url_referencia];
    if (req.file) { sql += `, layout_path=?`; params.push(req.file.filename); }
    sql += ` WHERE id=?`; params.push(req.params.id);
    db.run(sql, params, err => { res.json({ message: "Atualizado com sucesso!" }); });
});

router.post('/api/orders/:code/convert-to-quote', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_vendas', 'gerente_operacoes', 'designer']), (req, res) => {
    db.get(`SELECT * FROM orders WHERE tracking_code=?`, [req.params.code], (err, order) => {
        if (!order) return res.status(404).json({ message: "Arte não encontrada." });
        const newQuoteCode = generateQuoteTrackingCode();

        fetchOrderProductLines(order.id, (linesErr, productLines) => {
            if (linesErr) return res.status(500).json({ error: linesErr.message });

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                db.run(`
                    INSERT INTO quotes (
                        tracking_code, client_name, product_type, fabric_type, category, sizes_json, total_price, cost_price,
                        delivery_date, layout_path, status, discount, cor, tipo_estampa, observacao, url_referencia,
                        created_by_user_id, board_order, unit_price, unit_cost, allowed_sizes, allowed_models, amount_paid, portal_token
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Em Análise', ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
                `,
                [
                    newQuoteCode,
                    order.client_name,
                    order.product_type,
                    order.fabric_type,
                    order.category,
                    order.sizes_json,
                    order.total_price,
                    order.cost_price,
                    order.delivery_date,
                    order.layout_path,
                    order.discount || 0,
                    order.cor || null,
                    order.tipo_estampa || null,
                    order.observacao || null,
                    order.url_referencia || null,
                    req.user.id,
                    Number(order.unit_price || 0),
                    Number(order.unit_cost || 0),
                    order.allowed_sizes || null,
                    order.allowed_models || null,
                    Number(order.amount_paid || 0),
                    generatePortalToken()
                ], function(err2) {
                    if (err2) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: err2.message });
                    }

                    const quoteId = this.lastID;

                    saveQuoteProductLines(quoteId, productLines || [], (saveLinesErr) => {
                        if (saveLinesErr) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: saveLinesErr.message });
                        }

                        copyOrderItemsToQuote(order.id, quoteId, (copyItemsErr) => {
                            if (copyItemsErr) {
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: copyItemsErr.message });
                            }

                            db.run(`UPDATE orders SET status='Arte Arquivada' WHERE id=?`, [order.id]);
                            db.run(`INSERT INTO order_history (order_id, status_text, changed_by_user_id) VALUES (?, 'Arte Convertida em Orçamento', ?)`, [order.id, req.user.id]);
                            db.run(`INSERT INTO quote_history (quote_id, status_text, changed_by_user_id) VALUES (?, 'Em Análise', ?)`, [quoteId, req.user.id]);
                            db.run('COMMIT', (commitErr) => {
                                if (commitErr) return res.status(500).json({ error: commitErr.message });
                                res.json({ message: "Orçamento gerado com arte aprovada!", tracking_code: newQuoteCode });
                            });
                        });
                    });
                });
            });
        });
    });
});

router.post('/api/orders', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_vendas', 'gerente_operacoes', 'designer']), upload.any(), (req, res) => {
    const { client_name, category, amount_paid, delivery_date, status, discount, allowed_sizes, allowed_models } = req.body;
    const trackingCode = generateTrackingCode();
    const portalToken = generatePortalToken();
    
    const sizesStr = typeof allowed_sizes === 'object' ? JSON.stringify(allowed_sizes) : allowed_sizes;
    const modelsStr = typeof allowed_models === 'object' ? JSON.stringify(allowed_models) : allowed_models;
    const productLines = normalizeOrderProductLines(req.body, req.files || []);

    if (!productLines.length) {
        return res.status(400).json({ error: 'Adicione pelo menos um produto ao pedido.' });
    }

    const summary = summarizeLines(productLines, discount);

    resolveOrderClientInput(req.body, (clientErr, clientInfo) => {
        if (clientErr) return res.status(500).json({ error: clientErr.message });

        db.run(`INSERT INTO orders (tracking_code, portal_token, client_id, client_name, client_phone, product_type, fabric_type, category, sizes_json, total_price, amount_paid, cost_price, delivery_date, layout_path, status, board_order, discount, allowed_sizes, allowed_models, unit_price, unit_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 999999, ?, ?, ?, ?, ?)`,
            [
                trackingCode,
                portalToken,
                clientInfo.client_id,
                clientInfo.client_name || client_name,
                clientInfo.client_phone,
                summary.product_type,
                summary.fabric_type,
                category || 'Geral',
                summary.sizes_json,
                summary.total_price,
                amount_paid || 0,
                summary.cost_price,
                delivery_date,
                summary.layout_path,
                status || 'Criação de Arte',
                discount || 0,
                sizesStr,
                modelsStr,
                summary.unit_price,
                summary.unit_cost
            ],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                const orderId = this.lastID;
                saveOrderProductLines(orderId, productLines, (linesErr) => {
                    if (linesErr) return res.status(500).json({ error: linesErr.message });
                    db.run(`INSERT INTO order_history (order_id, status_text, changed_by_user_id) VALUES (?, ?, ?)`, [orderId, status || 'Criação de Arte', req.user.id]);
                    syncFinanceWithOrder(orderId, (syncErr) => {
                        if (syncErr) return res.status(500).json({ error: syncErr.message });
                        res.json({ message: "Pedido criado!", tracking_code: trackingCode, portal_path: buildPortalPath({ tracking_code: trackingCode, portal_token: portalToken }) });
                    });
                });
            });
    });
});

router.put('/api/orders/reorder', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_vendas', 'gerente_operacoes', 'designer']), (req, res) => {
    const { orderedIds } = req.body;

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        return res.status(400).json({ error: 'Lista de pedidos inválida.' });
    }

    const safeIds = orderedIds
        .map(id => parseInt(id, 10))
        .filter(id => Number.isInteger(id) && id > 0);

    if (safeIds.length !== orderedIds.length) {
        return res.status(400).json({ error: 'IDs de pedidos inválidos.' });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const stmt = db.prepare(`UPDATE orders SET board_order = ? WHERE id = ?`);
        let failed = false;
        let failureMessage = null;

        safeIds.forEach((id, index) => {
            stmt.run([index + 1, id], (err) => {
                if (err && !failed) {
                    failed = true;
                    failureMessage = err.message;
                }
            });
        });

        stmt.finalize((err) => {
            if (err && !failed) {
                failed = true;
                failureMessage = err.message;
            }

            if (failed) {
                return db.run('ROLLBACK', () => {
                    res.status(500).json({ error: failureMessage || 'Erro ao salvar ordem.' });
                });
            }

            db.run('COMMIT', (commitErr) => {
                if (commitErr) return res.status(500).json({ error: commitErr.message });
                res.json({ message: 'Ordem atualizada.' });
            });
        });
    });
});

router.put('/api/orders/:id', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_vendas', 'gerente_operacoes', 'designer']), upload.any(), (req, res) => {
    const { client_name, category, amount_paid, delivery_date, discount, allowed_sizes, allowed_models } = req.body;
    
    const sizesStr = typeof allowed_sizes === 'object' ? JSON.stringify(allowed_sizes) : allowed_sizes;
    const modelsStr = typeof allowed_models === 'object' ? JSON.stringify(allowed_models) : allowed_models;
    const productLines = normalizeOrderProductLines(req.body, req.files || []);

    if (!productLines.length) {
        return res.status(400).json({ error: 'Adicione pelo menos um produto ao pedido.' });
    }

    const summary = summarizeLines(productLines, discount);

    resolveOrderClientInput(req.body, (clientErr, clientInfo) => {
        if (clientErr) return res.status(500).json({ error: clientErr.message });

        let sql = `UPDATE orders SET client_id=?, client_name=?, client_phone=?, product_type=?, fabric_type=?, category=?, sizes_json=?, total_price=?, amount_paid=?, cost_price=?, delivery_date=?, discount=?, allowed_sizes=?, allowed_models=?, unit_price=?, unit_cost=?, layout_path=?`;
        const params = [
            clientInfo.client_id,
            clientInfo.client_name || client_name,
            clientInfo.client_phone,
            summary.product_type,
            summary.fabric_type,
            category || 'Geral',
            summary.sizes_json,
            summary.total_price,
            amount_paid || 0,
            summary.cost_price,
            delivery_date,
            discount || 0,
            sizesStr,
            modelsStr,
            summary.unit_price,
            summary.unit_cost,
            summary.layout_path
        ];
        
        sql += ` WHERE id=?`; params.push(req.params.id);
        
        db.run(sql, params, function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Pedido não encontrado.' });
            saveOrderProductLines(req.params.id, productLines, (linesErr) => {
                if (linesErr) return res.status(500).json({ error: linesErr.message });
                syncFinanceWithOrder(req.params.id, (syncErr) => {
                    if (syncErr) return res.status(500).json({ error: syncErr.message });
                    res.json({ message: "Pedido atualizado." });
                });
            });
        });
    });
});

router.get('/api/orders', authenticateToken, (req, res) => {
    db.all(`
        SELECT
            orders.*,
            ${buildSyncedAmountPaidExpression('orders')} AS synced_amount_paid,
            ${buildEffectiveOrderTotalExpression('orders')} AS effective_total_price,
            ${buildEffectiveOrderClientLockExpression('orders')} AS effective_is_locked_by_client
        FROM orders
        ORDER BY board_order ASC, id ASC
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message, orders: [] });
        attachEffectiveSubmittedSizes(rows || [], (sizesErr, hydratedRows) => {
            if (sizesErr) return res.status(500).json({ error: sizesErr.message, orders: [] });
            res.json({ orders: hydratedRows.map(serializeOrderRowForResponse) });
        });
    });
});

router.delete('/api/orders/:id', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_vendas', 'gerente_operacoes']), (req, res) => {
    db.run('DELETE FROM order_history WHERE order_id=?', [req.params.id], () => {
        db.run('DELETE FROM transactions WHERE order_id=?', [req.params.id], () => { 
            db.run('DELETE FROM order_items WHERE order_id=?', [req.params.id], () => { 
                db.run('DELETE FROM orders WHERE id=?', [req.params.id], () => res.json({ message: 'Pedido excluído.' }));
            });
        });
    });
});

router.get('/api/orders/upcoming', authenticateToken, (req, res) => {
    const nextWeekDate = new Date(); nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    db.all(`
        SELECT
            orders.*,
            ${buildSyncedAmountPaidExpression('orders')} AS synced_amount_paid,
            ${buildEffectiveOrderTotalExpression('orders')} AS effective_total_price,
            ${buildEffectiveOrderClientLockExpression('orders')} AS effective_is_locked_by_client
        FROM orders
        WHERE status NOT IN ('Entregue/Concluído', 'Cancelado', 'Arte Arquivada')
          AND delivery_date <= ?
        ORDER BY delivery_date ASC
    `, [nextWeekDate.toISOString().split('T')[0]], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message, orders: [] });
        attachEffectiveSubmittedSizes(rows || [], (sizesErr, hydratedRows) => {
            if (sizesErr) return res.status(500).json({ error: sizesErr.message, orders: [] });
            res.json({ orders: hydratedRows.map(serializeOrderRowForResponse) });
        });
    });
});

router.get('/api/portal-link/:code', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_vendas', 'gerente_operacoes', 'designer']), (req, res) => {
    findPortalRecordByCode(req.params.code, (err, record) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!record) return res.status(404).json({ error: 'Pedido ou orçamento não encontrado.' });

        res.json({
            tracking_code: record.tracking_code,
            type: record.type,
            portal_path: buildPortalPath(record)
        });
    });
});

router.get('/api/orders/:code/history', authenticateToken, (req, res) => {
    db.get(`
        SELECT
            orders.*,
            ${buildSyncedAmountPaidExpression('orders')} AS synced_amount_paid,
            ${buildEffectiveOrderTotalExpression('orders')} AS effective_total_price,
            ${buildEffectiveOrderClientLockExpression('orders')} AS effective_is_locked_by_client
        FROM orders
        WHERE tracking_code=?
    `, [req.params.code], (err, order) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!order) return res.status(404).json({ message: "Não encontrado." });
        db.all(`SELECT oh.status_text, oh.change_timestamp, COALESCE(u.name, 'Cliente') AS changed_by_name FROM order_history oh LEFT JOIN users u ON oh.changed_by_user_id = u.id WHERE oh.order_id = ? ORDER BY oh.change_timestamp ASC`, [order.id], (err2, history) => {
            if (err2) return res.status(500).json({ message: err2.message });
            db.all(`SELECT * FROM order_items WHERE order_id = ? AND (reference_type = 'order' OR reference_type IS NULL) ORDER BY id ASC`, [order.id], (err3, items) => {
                if (err3) return res.status(500).json({ message: err3.message });
                fetchOrderProductLines(order.id, (linesErr, productLines) => {
                    if (linesErr) return res.status(500).json({ message: linesErr.message });
                    const submittedSizes = summarizeItemsBySize(items || []);
                    const storedSizes = safeParseJSON(order.sizes_json);
                    const effectiveSizes = sumSizes(storedSizes) > 0 ? storedSizes : submittedSizes;

                    res.json({ ...normalizeOrderFinancialRow(order), sizes_json: effectiveSizes, history, items: items || [], product_lines: productLines || [] });
                });
            });
        });
    });
});

router.post('/api/orders/:code/status', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_vendas', 'gerente_operacoes', 'designer', 'corte']), (req, res) => {
    const { new_status } = req.body;
    if (!ORDER_STATUS_VALUES.has(new_status)) {
        return res.status(400).json({ error: 'Status de pedido inválido.' });
    }

    db.get(`SELECT id, tracking_code, status, client_id, client_name, client_phone FROM orders WHERE tracking_code=?`, [req.params.code], (err, order) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!order) return res.status(404).json({ message: "Não encontrado." });
        db.run(`UPDATE orders SET status=?, board_order=999999 WHERE id=?`, [new_status, order.id], err2 => {
            if (err2) return res.status(500).json({ error: err2.message });
            db.run(`INSERT INTO order_history (order_id, status_text, changed_by_user_id) VALUES (?, ?, ?)`, [order.id, new_status, req.user.id]);
            syncFinanceWithOrder(order.id, (syncErr) => {
                if (syncErr) return res.status(500).json({ error: syncErr.message });
                notifyOrderStatusChange(order, order.status, new_status, req.user.id)
                    .then((whatsapp) => res.json({ message: "Status atualizado.", whatsapp }))
                    .catch((notifyErr) => res.json({
                        message: "Status atualizado.",
                        whatsapp: {
                            sent: false,
                            skipped: false,
                            reason: 'send_failed',
                            error: notifyErr.message
                        }
                    }));
            });
        });
    });
});

router.post('/api/orders/:code/reset', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_vendas', 'gerente_operacoes']), (req, res) => {
    db.get(`SELECT id FROM orders WHERE tracking_code=?`, [req.params.code], (err, order) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!order) return res.status(404).json({ message: "Pedido não encontrado." });

        db.run(`DELETE FROM order_history WHERE order_id=?`, [order.id], () => {
            db.run(`UPDATE orders SET status='Criação de Arte', board_order=999999 WHERE id=?`, [order.id], () => {
                db.run(`INSERT INTO order_history (order_id, status_text, changed_by_user_id) VALUES (?, 'Produção Reiniciada', ?)`, [order.id, req.user.id]);
                syncFinanceWithOrder(order.id, (syncErr) => {
                    if (syncErr) return res.status(500).json({ error: syncErr.message });
                    res.json({ message: "Pedido reiniciado." });
                });
            });
        });
    });
});

router.get('/api/dashboard/summary', authenticateToken, (req, res) => {
    const now = new Date();
    const monthStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStartDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const toDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const monthStart = toDateKey(monthStartDate);
    const nextMonthStart = toDateKey(nextMonthStartDate);

    db.get(`
        WITH active_orders AS (
            SELECT
                id,
                ${buildEffectiveOrderTotalExpression('orders')} AS total_price,
                cost_price,
                amount_paid
            FROM orders
            WHERE status NOT IN ('Entregue/Concluído', 'Cancelado', 'Arte Arquivada')
        ),
        paid_by_order AS (
            SELECT order_id, SUM(amount) AS paid_total
            FROM transactions
            WHERE type = 'Receita'
              AND status = 'Pago'
            GROUP BY order_id
        ),
        active_payment_base AS (
            SELECT
                ao.id,
                COALESCE(ao.total_price, 0) AS total_price,
                CASE
                    WHEN COALESCE(pbo.paid_total, 0) > COALESCE(ao.amount_paid, 0)
                        THEN COALESCE(pbo.paid_total, 0)
                    ELSE COALESCE(ao.amount_paid, 0)
                END AS received_total
            FROM active_orders ao
            LEFT JOIN paid_by_order pbo ON pbo.order_id = ao.id
        )
        SELECT
            (SELECT COUNT(*) FROM active_orders) AS active_count,
            (
                SELECT COUNT(*)
                FROM orders o
                WHERE o.status = 'Entregue/Concluído'
                  AND (
                      EXISTS (
                          SELECT 1
                          FROM order_history oh
                          WHERE oh.order_id = o.id
                            AND oh.status_text = 'Entregue/Concluído'
                            AND date(oh.change_timestamp) >= ?
                            AND date(oh.change_timestamp) < ?
                      )
                      OR (
                          NOT EXISTS (
                              SELECT 1
                              FROM order_history oh
                              WHERE oh.order_id = o.id
                                AND oh.status_text = 'Entregue/Concluído'
                          )
                          AND date(COALESCE(o.delivery_date, o.created_at)) >= ?
                          AND date(COALESCE(o.delivery_date, o.created_at)) < ?
                      )
                  )
            ) AS completed_count,
            (SELECT COALESCE(SUM(total_price), 0) FROM active_orders) AS active_value,
            (SELECT COALESCE(SUM(cost_price), 0) FROM active_orders) AS active_cost,
            (
                SELECT COALESCE(SUM(
                    CASE
                        WHEN received_total > total_price THEN total_price
                        ELSE received_total
                    END
                ), 0)
                FROM active_payment_base
            ) AS active_paid
    `, [monthStart, nextMonthStart, monthStart, nextMonthStart], (err, totals) => {
        if (err) return res.status(500).json({ error: err.message });
        db.all(`SELECT status, COUNT(*) AS count FROM orders WHERE status NOT IN ('Entregue/Concluído', 'Cancelado', 'Arte Arquivada') GROUP BY status`, [], (err2, statusCounts) => {
            if (err2) return res.status(500).json({ error: err2.message });
            db.all(`SELECT id, product_type, sizes_json FROM orders WHERE status NOT IN ('Entregue/Concluído', 'Cancelado', 'Arte Arquivada')`, [], (err3, rows) => {
                if (err3) return res.status(500).json({ error: err3.message });
                attachEffectiveSubmittedSizes(rows || [], (sizesErr, productRows) => {
                    if (sizesErr) return res.status(500).json({ error: sizesErr.message });
                    const productMap = {};
                    productRows.forEach(row => {
                        const sizes = row.effective_sizes_json || safeParseJSON(row.sizes_json);
                        const totalPieces = Object.values(sizes).reduce((acc, val) => acc + (Number(val) || 0), 0);
                        productMap[row.product_type] = (productMap[row.product_type] || 0) + totalPieces;
                    });
                    const productCounts = Object.keys(productMap).map(key => ({ product_type: key, count: productMap[key] }));
                    const today = new Date().toISOString().split('T')[0];
                    db.all(`
                    SELECT
                        orders.*,
                        ${buildSyncedAmountPaidExpression('orders')} AS synced_amount_paid,
                        ${buildEffectiveOrderTotalExpression('orders')} AS effective_total_price,
                        ${buildEffectiveOrderClientLockExpression('orders')} AS effective_is_locked_by_client
                    FROM orders
                        WHERE status NOT IN ('Entregue/Concluído', 'Cancelado', 'Arte Arquivada')
                          AND delivery_date < ?
                        ORDER BY delivery_date ASC
                    `, [today], (err4, overdueList) => {
                        if (err4) return res.status(500).json({ error: err4.message });
                        const nextWeek = new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0];
                        db.all(`
                            SELECT
                                orders.*,
                                ${buildSyncedAmountPaidExpression('orders')} AS synced_amount_paid,
                                ${buildEffectiveOrderTotalExpression('orders')} AS effective_total_price,
                                ${buildEffectiveOrderClientLockExpression('orders')} AS effective_is_locked_by_client
                            FROM orders
                            WHERE status NOT IN ('Entregue/Concluído', 'Cancelado', 'Arte Arquivada')
                              AND delivery_date >= ?
                              AND delivery_date <= ?
                            ORDER BY delivery_date ASC
                            LIMIT 5
                        `, [today, nextWeek], (err5, upcomingList) => {
                            if (err5) return res.status(500).json({ error: err5.message });
                            attachEffectiveSubmittedSizes(overdueList || [], (overdueSizesErr, hydratedOverdueList) => {
                                if (overdueSizesErr) return res.status(500).json({ error: overdueSizesErr.message });
                                attachEffectiveSubmittedSizes(upcomingList || [], (upcomingSizesErr, hydratedUpcomingList) => {
                                    if (upcomingSizesErr) return res.status(500).json({ error: upcomingSizesErr.message });
                                    res.json({
                                        totals: totals || {active_count:0, completed_count:0, active_value:0, active_cost:0, active_paid:0},
                                        statusCounts,
                                        productCounts,
                                        overdueList: hydratedOverdueList.map(serializeOrderRowForResponse),
                                        upcomingList: hydratedUpcomingList.map(serializeOrderRowForResponse)
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});

router.get('/api/reports/profit', authenticateToken, (req, res) => {
    db.get(`SELECT SUM(total_price) AS revenue, SUM(cost_price) AS cost FROM orders WHERE status='Entregue/Concluído'`, [], (err, result) => res.json(result));
});

// ⭐ CORREÇÃO DE OURO: Tiramos o [] e colocamos o null para o portal não apagar os tamanhos!
router.get('/api/tracking/portal/:code', (req, res) => {
    const code = normalizePortalTrackingCode(req.params.code);

    if (code.startsWith('#ORC-')) {
        db.get(`
            SELECT
                quotes.id,
                quotes.tracking_code,
                quotes.portal_token,
                quotes.client_name,
                quotes.status,
                quotes.layout_path,
                quotes.total_price,
                quotes.sizes_json,
                quotes.delivery_date,
                quotes.is_locked_by_client,
                quotes.observacao,
                quotes.allowed_sizes,
                quotes.allowed_models,
                quotes.amount_paid,
                ${buildEffectiveQuoteClientLockExpression('quotes')} AS effective_is_locked_by_client
            FROM quotes
            WHERE quotes.tracking_code = ?
        `, [code], (err, quote) => {
            if (err || !quote) return res.status(404).json({ error: 'Orçamento não encontrado.' });

            ensurePortalToken('quotes', quote, (tokenErr, securedQuote) => {
                if (tokenErr) return res.status(500).json({ error: tokenErr.message });
                if (!requirePortalToken(securedQuote, req, res)) return;

            db.all(`SELECT id, quote_id AS order_id, player_name, player_number, size, model, created_at, 'quote' AS reference_type FROM quote_items WHERE quote_id = ? ORDER BY id ASC`, [quote.id], (err2, quoteItems) => {
                const sendQuote = (items) => {
                    db.all(`
                        SELECT qpl.*, p.sale_price AS product_sale_price, p.production_cost AS product_production_cost
                        FROM quote_product_lines qpl
                        LEFT JOIN products p ON p.name = qpl.product_type
                        WHERE qpl.quote_id = ?
                        ORDER BY qpl.sort_order ASC, qpl.id ASC
                    `, [quote.id], (linesErr, productLines) => {
                        if (linesErr) return res.status(500).json({ error: linesErr.message });
                        const submittedSizes = summarizeItemsBySize(items || []);
                        const normalizedQuote = normalizeClientLockRow(securedQuote);
                        const storedSizes = safeParseJSON(normalizedQuote.sizes_json);
                        const effectiveSizes = sumSizes(storedSizes) > 0 ? storedSizes : submittedSizes;

                        res.json({
                            ...normalizedQuote,
                            portal_token: undefined,
                            allowed_sizes: normalizedQuote.allowed_sizes ? safeParseJSON(normalizedQuote.allowed_sizes) : null,
                            allowed_models: normalizedQuote.allowed_models ? safeParseJSON(normalizedQuote.allowed_models) : null,
                            amount_paid: Number(normalizedQuote.amount_paid || 0),
                            sizes: effectiveSizes,
                            items: items || [],
                            product_lines: normalizeProductLinesForResponse(productLines || [], { ...normalizedQuote, submitted_sizes_json: submittedSizes })
                        });
                    });
                };

                if (quoteItems && quoteItems.length > 0) return sendQuote(quoteItems);

                db.all(`SELECT * FROM order_items WHERE order_id = ? AND reference_type = 'quote' ORDER BY id ASC`, [quote.id], (err3, legacyItems) => {
                    sendQuote(legacyItems || []);
                });
            });
            });
        });
        return;
    }

    db.get(`
        SELECT
            orders.id,
            orders.tracking_code,
            orders.portal_token,
            orders.client_name,
            orders.status,
            orders.layout_path,
            orders.allowed_sizes,
            orders.allowed_models,
            orders.is_locked_by_client,
            orders.total_price,
            orders.amount_paid,
            orders.sizes_json,
            orders.delivery_date,
            ${buildSyncedAmountPaidExpression('orders')} AS synced_amount_paid,
            ${buildEffectiveOrderTotalExpression('orders')} AS effective_total_price,
            ${buildEffectiveOrderClientLockExpression('orders')} AS effective_is_locked_by_client
        FROM orders
        WHERE tracking_code = ?
    `, [code], (err, order) => {
        if (err || !order) return res.status(404).json({ error: 'Pedido não encontrado.' });

        ensurePortalToken('orders', order, (tokenErr, securedOrder) => {
            if (tokenErr) return res.status(500).json({ error: tokenErr.message });
            if (!requirePortalToken(securedOrder, req, res)) return;

        db.all(`SELECT * FROM order_items WHERE order_id = ? AND (reference_type = 'order' OR reference_type IS NULL) ORDER BY id ASC`, [securedOrder.id], (err2, items) => {
            if (err2) return res.status(500).json({ error: err2.message });

            db.all(`
                SELECT opl.*, p.sale_price AS product_sale_price, p.production_cost AS product_production_cost
                FROM order_product_lines opl
                LEFT JOIN products p ON p.name = opl.product_type
                WHERE opl.order_id = ?
                ORDER BY opl.sort_order ASC, opl.id ASC
            `, [securedOrder.id], (err3, productLines) => {
                if (err3) return res.status(500).json({ error: err3.message });
                const submittedSizes = summarizeItemsBySize(items || []);
                const storedSizes = safeParseJSON(securedOrder.sizes_json);
                const effectiveSizes = sumSizes(storedSizes) > 0 ? storedSizes : submittedSizes;

                res.json({
                    ...normalizeOrderFinancialRow({ ...securedOrder, portal_token: undefined }),
                    allowed_sizes: safeParseJSON(securedOrder.allowed_sizes),
                    allowed_models: safeParseJSON(securedOrder.allowed_models),
                    sizes: effectiveSizes,
                    items: items || [],
                    product_lines: normalizeProductLinesForResponse(productLines || [], { ...securedOrder, submitted_sizes_json: submittedSizes })
                });
            });
        });
        });
    });
});

router.post('/api/tracking/portal/:code/save-draft', (req, res) => {
    const { items } = req.body; 
    const code = normalizePortalTrackingCode(req.params.code);
    const isQuote = code.startsWith('#ORC-');
    const table = isQuote ? 'quotes' : 'orders';
    const refType = isQuote ? 'quote' : 'order';

    if (!Array.isArray(items)) return res.status(400).json({ error: 'Lista inválida.' });

    const lockExpression = isQuote
        ? buildEffectiveQuoteClientLockExpression(table)
        : buildEffectiveOrderClientLockExpression(table);

    db.get(`
        SELECT
            ${table}.id,
            ${table}.portal_token,
            ${table}.is_locked_by_client,
            ${lockExpression} AS effective_is_locked_by_client
        FROM ${table}
        WHERE ${table}.tracking_code = ?
    `, [code], (err, record) => {
        if (err || !record) return res.status(404).json({ error: 'Inválido.' });
        if (!requirePortalToken(record, req, res)) return;
        if (normalizeClientLockRow(record).is_locked_by_client) return res.status(403).json({ error: 'Lista bloqueada.' });

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            if (isQuote) {
                db.run(`DELETE FROM quote_items WHERE quote_id = ?`, [record.id]);
            } else {
                db.run(`DELETE FROM order_items WHERE order_id = ? AND (reference_type = 'order' OR reference_type IS NULL)`, [record.id]);
            }

            const stmt = isQuote
                ? db.prepare(`INSERT INTO quote_items (quote_id, player_name, player_number, size, model) VALUES (?, ?, ?, ?, ?)`)
                : db.prepare(`INSERT INTO order_items (order_id, player_name, player_number, size, model, reference_type) VALUES (?, ?, ?, ?, ?, ?)`);

            items.forEach(item => {
                const safeName = (item.player_name || '').replace(/,/g, '');
                if (isQuote) {
                    stmt.run([record.id, safeName, item.player_number, item.size, item.model || '']);
                } else {
                    stmt.run([record.id, safeName, item.player_number, item.size, item.model || '', refType]);
                }
            });
            stmt.finalize();

            db.run('COMMIT', () => res.json({ message: 'Rascunho salvo.' }));
        });
    });
});

router.post('/api/tracking/portal/:code/submit', (req, res) => {
    const { items } = req.body; 
    const code = normalizePortalTrackingCode(req.params.code);
    const isQuote = code.startsWith('#ORC-');
    const table = isQuote ? 'quotes' : 'orders';
    const refType = isQuote ? 'quote' : 'order';

    if (!Array.isArray(items)) return res.status(400).json({ error: 'Lista inválida.' });

    const lockExpression = isQuote
        ? buildEffectiveQuoteClientLockExpression(table)
        : buildEffectiveOrderClientLockExpression(table);

    db.get(`
        SELECT
            ${table}.*,
            ${lockExpression} AS effective_is_locked_by_client
        FROM ${table}
        WHERE ${table}.tracking_code = ?
    `, [code], (err, record) => {
        if (err || !record) return res.status(404).json({ error: 'Inválido.' });
        if (!requirePortalToken(record, req, res)) return;
        if (normalizeClientLockRow(record).is_locked_by_client) return res.status(403).json({ error: 'Lista já confirmada.' });

        const newSizes = {};
        let totalQty = 0;
        
        items.forEach(item => {
            if (item.size) { newSizes[item.size] = (newSizes[item.size] || 0) + 1; totalQty++; }
        });
        const sizesJsonStr = JSON.stringify(newSizes);

        const productLineTable = isQuote ? 'quote_product_lines' : 'order_product_lines';
        const productLineOwnerColumn = isQuote ? 'quote_id' : 'order_id';

        db.all(`SELECT * FROM ${productLineTable} WHERE ${productLineOwnerColumn} = ? ORDER BY sort_order ASC, id ASC`, [record.id], (lineErr, productLines = []) => {
            if (lineErr) return res.status(500).json({ error: lineErr.message });

            const primaryLine = productLines[0] || null;
            const otherLinesTotal = productLines.slice(1).reduce((sum, line) => sum + (Number(line.total_price) || 0), 0);
            const otherLinesCost = productLines.slice(1).reduce((sum, line) => sum + (Number(line.cost_price) || 0), 0);
            const effectiveProductType = primaryLine?.product_type || record.product_type;

            db.get(`SELECT sale_price, production_cost FROM products WHERE name = ?`, [effectiveProductType], (err, product) => {
                const lineUnitPrice = parseFloat(primaryLine?.unit_price) || 0;
                const lineUnitCost = parseFloat(primaryLine?.unit_cost) || 0;
                const storedUnitPrice = parseFloat(record.unit_price) || 0;
                const storedUnitCost = parseFloat(record.unit_cost) || 0;
                const productUnitPrice = product ? parseFloat(product.sale_price) || 0 : 0;
                const amountPaidFallback = parseFloat(record.amount_paid) || 0;
                const paidFallbackUnitPrice = totalQty > 0 && amountPaidFallback > 0 ? amountPaidFallback / totalQty : 0;
                const uPrice = lineUnitPrice > 0 ? lineUnitPrice : (storedUnitPrice > 0 ? storedUnitPrice : (productUnitPrice > 0 ? productUnitPrice : paidFallbackUnitPrice));
                const uCost = lineUnitCost > 0 ? lineUnitCost : (storedUnitCost > 0 ? storedUnitCost : (product ? parseFloat(product.production_cost) || 0 : 0));
                const safeDiscount = parseFloat(record.discount) || 0;
                const savedTotalFallback = Math.max(Number(primaryLine?.total_price || 0), Number(record.total_price || 0), amountPaidFallback);
                const primaryLineTotal = uPrice > 0 && totalQty > 0 ? totalQty * uPrice : savedTotalFallback;
                const primaryLineCost = uCost > 0 ? totalQty * uCost : Number(primaryLine?.cost_price || record.cost_price || 0);

                const finalTotalPrice = Math.max(0, otherLinesTotal + primaryLineTotal - safeDiscount, amountPaidFallback);
                const finalCostPrice = otherLinesCost + primaryLineCost;

                const syncPrimaryProductLine = (done) => {
                    if (!primaryLine) return done(null);

                    db.run(
                        `UPDATE ${productLineTable}
                         SET sizes_json = ?,
                             unit_price = ?,
                             unit_cost = ?,
                             total_price = ?,
                             cost_price = ?
                         WHERE id = ?`,
                        [sizesJsonStr, uPrice, uCost, primaryLineTotal, primaryLineCost, primaryLine.id],
                        (lineUpdateErr) => done(lineUpdateErr || null)
                    );
                };

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                
                if (isQuote) {
                    db.run(`DELETE FROM quote_items WHERE quote_id = ?`, [record.id]);
                } else {
                    db.run(`DELETE FROM order_items WHERE order_id = ? AND (reference_type = 'order' OR reference_type IS NULL)`, [record.id]);
                }

                const stmt = isQuote
                    ? db.prepare(`INSERT INTO quote_items (quote_id, player_name, player_number, size, model) VALUES (?, ?, ?, ?, ?)`)
                    : db.prepare(`INSERT INTO order_items (order_id, player_name, player_number, size, model, reference_type) VALUES (?, ?, ?, ?, ?, ?)`);

                items.forEach(item => {
                    const safeName = (item.player_name || '').replace(/,/g, '');
                    if (isQuote) {
                        stmt.run([record.id, safeName, item.player_number, item.size, item.model || '']);
                    } else {
                        stmt.run([record.id, safeName, item.player_number, item.size, item.model || '', refType]);
                    }
                });
                stmt.finalize();

                if (isQuote) {
                    db.run(`UPDATE quotes SET is_locked_by_client = 1, sizes_json = ?, total_price = ?, cost_price = ? WHERE id = ?`, 
                    [sizesJsonStr, finalTotalPrice, finalCostPrice, record.id], (err) => {
                        if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: 'Erro ao salvar.' }); }
                        syncPrimaryProductLine((lineUpdateErr) => {
                            if (lineUpdateErr) { db.run('ROLLBACK'); return res.status(500).json({ error: lineUpdateErr.message }); }
                            db.run(`INSERT INTO quote_history (quote_id, status_text, changed_by_user_id) VALUES (?, 'Lista Enviada pelo Cliente (Termo Assinado)', NULL)`, [record.id]);
                            db.run('COMMIT', () => res.json({ message: 'Orçamento atualizado!' }));
                        });
                    });
                } else {
                    const STATUS_STEPS = ['Criação de Arte', 'Aguardando Aprovação', 'Arte Aprovada/Liberada', 'Corte Iniciado', 'Impressão/Estampa Iniciada', 'Costura Iniciada', 'Controle de Qualidade', 'Pronto para Envio', 'Entregue/Concluído'];
                    let currentStepIndex = STATUS_STEPS.indexOf(record.status);
                    let finalStatus = record.status;
                    
                    if (currentStepIndex < STATUS_STEPS.indexOf('Aguardando Aprovação') || currentStepIndex === -1) {
                        finalStatus = 'Aguardando Aprovação';
                    }

                    db.run(`UPDATE orders SET is_locked_by_client = 1, status = ?, board_order = 999999, sizes_json = ?, total_price = ?, cost_price = ?, unit_price = ?, unit_cost = ? WHERE id = ?`, 
                    [finalStatus, sizesJsonStr, finalTotalPrice, finalCostPrice, uPrice, uCost, record.id], (err) => {
                        if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: 'Erro.' }); }
                        syncPrimaryProductLine((lineUpdateErr) => {
                            if (lineUpdateErr) { db.run('ROLLBACK'); return res.status(500).json({ error: lineUpdateErr.message }); }
                            db.run(`INSERT INTO order_history (order_id, status_text, changed_by_user_id) VALUES (?, 'Lista Enviada pelo Cliente (Termo Assinado)', NULL)`, [record.id]);
                            db.run('COMMIT', () => {
                                syncFinanceWithOrder(record.id);
                                res.json({ message: 'Lista enviada com sucesso!' });
                            });
                        });
                    });
                }
            });
        });
    });
});
});

router.post('/api/tracking/portal/:code/approve-art', (req, res) => {
    const code = normalizePortalTrackingCode(req.params.code);
    const isQuote = code.startsWith('#ORC-');
    const table = isQuote ? 'quotes' : 'orders';

    db.get(`SELECT id, portal_token, status FROM ${table} WHERE tracking_code = ?`, [code], (err, record) => {
        if (err || !record) return res.status(404).json({ error: 'Inválido.' });
        if (!requirePortalToken(record, req, res)) return;
        
        const STATUS_STEPS = ['Criação de Arte', 'Aguardando Aprovação', 'Arte Aprovada/Liberada', 'Corte Iniciado', 'Impressão/Estampa Iniciada', 'Costura Iniciada', 'Controle de Qualidade', 'Pronto para Envio', 'Entregue/Concluído'];
        let currentStepIndex = STATUS_STEPS.indexOf(record.status);
        let finalStatus = record.status;
        
        if (currentStepIndex < STATUS_STEPS.indexOf('Arte Aprovada/Liberada') || currentStepIndex === -1) {
            finalStatus = 'Arte Aprovada/Liberada';
        }
        
        if (isQuote) {
            db.run(`UPDATE quotes SET status = ? WHERE id = ?`, ['Aprovado', record.id], (err) => {
                res.json({ message: 'Arte aprovada!' });
            });
        } else {
            db.run(`UPDATE orders SET status = ?, board_order = 999999 WHERE id = ?`, [finalStatus, record.id], (err) => {
                db.run(`INSERT INTO order_history (order_id, status_text, changed_by_user_id) VALUES (?, 'Arte Aprovada pelo Cliente (Termo Aceito)', NULL)`, [record.id]);
                res.json({ message: 'Arte aprovada!' });
            });
        }
    });
});

router.post('/api/orders/:id/unlock', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_vendas', 'gerente_operacoes']), (req, res) => {
    db.run(`UPDATE orders SET is_locked_by_client = 0 WHERE id = ?`, [req.params.id], function(updateErr) {
        if (updateErr) return res.status(500).json({ error: updateErr.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Pedido não encontrado.' });

        db.run(`INSERT INTO order_history (order_id, status_text, changed_by_user_id) VALUES (?, 'Lista Desbloqueada', ?)`, [req.params.id, req.user.id], (historyErr) => {
            if (historyErr) return res.status(500).json({ error: historyErr.message });
            res.json({ message: 'Pedido desbloqueado!' });
        });
    });
});

router.post('/api/quotes/:id/unlock', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_vendas', 'gerente_operacoes']), (req, res) => {
    db.run(`UPDATE quotes SET is_locked_by_client = 0 WHERE id = ?`, [req.params.id], function(updateErr) {
        if (updateErr) return res.status(500).json({ error: updateErr.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Orçamento não encontrado.' });

        db.run(`INSERT INTO quote_history (quote_id, status_text, changed_by_user_id) VALUES (?, 'Lista Desbloqueada para Cliente', ?)`, [req.params.id, req.user.id], (historyErr) => {
            if (historyErr) return res.status(500).json({ error: historyErr.message });
            res.json({ message: 'Orçamento desbloqueado!' });
        });
    });
});

router.get('/api/orders/:id/export-txt', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_producao']), (req, res) => {
    db.all(`SELECT * FROM order_items WHERE order_id = ? AND (reference_type = 'order' OR reference_type IS NULL)`, [req.params.id], (err, items) => {
        if (err || !items || items.length === 0) return res.status(404).json({ error: 'Vazio.' });

        const grouped = {};
        items.forEach(item => {
            const size = item.size || 'Unico';
            if (!grouped[size]) grouped[size] = [];
            grouped[size].push(item);
        });

        res.attachment(`Producao_atos_${req.params.id}.zip`);
        const archive = archiver('zip', { zlib: { level: 9 } });
        
        archive.on('error', (err) => { res.status(500).send({error: err.message}); });
        archive.pipe(res);

        for (const size in grouped) {
            let txtContent = 'nome, nu\r\n';
            grouped[size].forEach(item => {
                const num = item.player_number ? item.player_number : '';
                txtContent += `${item.player_name || 'Sem Nome'}, ${num}\r\n`;
            });
            archive.append(txtContent, { name: `Tamanho_${size}.txt` });
        }

        archive.finalize();
    });
});

router._security = { requirePortalToken, tokenMatches };

module.exports = router;
