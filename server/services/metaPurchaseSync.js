const crypto = require('crypto');

// Durable outbox: payment and queue entry commit (or roll back) together.
// One purchase per order, never one purchase per installment or per phone.
function createMetaPurchaseSync({ db, config, tenantKey, post, now = () => Math.floor(Date.now() / 1000) }) {
    const run = (sql, params = []) => new Promise((resolve, reject) => {
        db.run(sql, params, function(error) {
            if (error) reject(error);
            else resolve({ changes: this.changes });
        });
    });
    const all = (sql, params = []) => new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
    });
    const exec = sql => new Promise((resolve, reject) => db.exec(sql, error => error ? reject(error) : resolve()));
    let initialized = false;
    let busy = false;

    async function initialize() {
        if (initialized) return;
        // The marker prevents a restart from suppressing purchases already queued.
        await exec(`BEGIN IMMEDIATE;
            CREATE TABLE IF NOT EXISTS meta_purchase_settings (key TEXT PRIMARY KEY);
            CREATE TABLE IF NOT EXISTS meta_purchase_events (
                order_id INTEGER PRIMARY KEY,
                event_time INTEGER NOT NULL,
                purchase_value REAL NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                attempts INTEGER NOT NULL DEFAULT 0,
                next_attempt INTEGER NOT NULL DEFAULT 0,
                payload TEXT,
                response_payload TEXT,
                last_error TEXT,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            INSERT OR IGNORE INTO meta_purchase_events(order_id, event_time, purchase_value, status)
                SELECT o.id, CAST(strftime('%s','now') AS INTEGER), o.total_price, 'historical'
                FROM orders o
                WHERE NOT EXISTS (SELECT 1 FROM meta_purchase_settings WHERE key = 'deposit_v1')
                  AND (COALESCE(o.amount_paid,0) > 0 OR EXISTS (
                    SELECT 1 FROM transactions t WHERE t.order_id = o.id
                        AND t.type = 'Receita' AND t.status = 'Pago' AND t.amount > 0));
            INSERT OR IGNORE INTO meta_purchase_settings(key) VALUES ('deposit_v1');
            CREATE TRIGGER IF NOT EXISTS meta_purchase_order_insert AFTER INSERT ON orders
                WHEN NEW.amount_paid > 0 AND NEW.status NOT IN ('Cancelado','Arte Arquivada')
                BEGIN
                    INSERT OR IGNORE INTO meta_purchase_events(order_id,event_time,purchase_value)
                    VALUES(NEW.id,CAST(strftime('%s','now') AS INTEGER),NEW.total_price);
                END;
            CREATE TRIGGER IF NOT EXISTS meta_purchase_order_deposit AFTER UPDATE OF amount_paid ON orders
                WHEN COALESCE(OLD.amount_paid,0) <= 0 AND NEW.amount_paid > 0
                    AND NEW.status NOT IN ('Cancelado','Arte Arquivada')
                BEGIN
                    INSERT OR IGNORE INTO meta_purchase_events(order_id,event_time,purchase_value)
                    VALUES(NEW.id,CAST(strftime('%s','now') AS INTEGER),NEW.total_price);
                END;
            CREATE TRIGGER IF NOT EXISTS meta_purchase_payment_insert AFTER INSERT ON transactions
                WHEN NEW.type = 'Receita' AND NEW.status = 'Pago' AND NEW.amount > 0
                BEGIN
                    INSERT OR IGNORE INTO meta_purchase_events(order_id,event_time,purchase_value)
                    SELECT id,CAST(strftime('%s','now') AS INTEGER),total_price FROM orders
                    WHERE id = NEW.order_id AND status NOT IN ('Cancelado','Arte Arquivada');
                END;
            CREATE TRIGGER IF NOT EXISTS meta_purchase_payment_update AFTER UPDATE OF status,amount,type,order_id ON transactions
                WHEN NEW.type = 'Receita' AND NEW.status = 'Pago' AND NEW.amount > 0
                    AND (OLD.status <> 'Pago' OR OLD.type <> 'Receita' OR OLD.amount <= 0
                        OR OLD.order_id IS NOT NEW.order_id)
                BEGIN
                    INSERT OR IGNORE INTO meta_purchase_events(order_id,event_time,purchase_value)
                    SELECT id,CAST(strftime('%s','now') AS INTEGER),total_price FROM orders
                    WHERE id = NEW.order_id AND status NOT IN ('Cancelado','Arte Arquivada');
                END;
            COMMIT;`).catch(async error => {
                await exec('ROLLBACK').catch(() => {});
                throw error;
            });
        initialized = true;
    }

    function buildPayload(job, order) {
        const hash = text => crypto.createHash('sha256').update(text).digest('hex');
        const country = config.defaultCountryCode || '55';
        const phone = [order.client_phone, order.customer_phone].map(value => {
            let digits = String(value || '').replace(/\D/g, '').replace(/^0+/, '');
            if (digits && [10, 11].includes(digits.length)) digits = country + digits;
            return digits;
        }).find(value => /^\d{10,15}$/.test(value)) || '';
        const email = String(order.customer_email || '').trim().toLowerCase();
        const userData = {};
        if (/^\d{10,15}$/.test(phone)) userData.ph = [hash(phone)];
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) userData.em = [hash(email)];
        if (!Object.keys(userData).length) throw new Error('missing_customer_phone_or_email');
        const value = Number(job.purchase_value);
        if (!Number.isFinite(value) || value <= 0) throw new Error('invalid_purchase_value');
        const payload = { data: [{
            event_name: 'Purchase',
            event_time: job.event_time,
            event_id: `${tenantKey}:order:${job.order_id}:purchase`,
            action_source: 'chat',
            user_data: userData,
            custom_data: {
                currency: 'BRL',
                value: Math.round(value * 100) / 100,
                order_id: String(job.order_id)
            }
        }] };
        if (config.testEventCode) payload.test_event_code = config.testEventCode;
        return payload;
    }

    async function processDue() {
        if (busy) return;
        busy = true;
        try {
            await initialize();
            if (!config.pixelId || !config.accessToken) return;
            const jobs = await all(`SELECT * FROM meta_purchase_events
                WHERE status IN ('pending','retry','sending') AND next_attempt <= ?
                ORDER BY event_time LIMIT 20`, [now()]);
            for (const job of jobs) {
                const claim = await run(`UPDATE meta_purchase_events
                    SET status='sending', attempts=attempts+1, next_attempt=?, updated_at=CURRENT_TIMESTAMP
                    WHERE order_id=? AND status IN ('pending','retry','sending') AND next_attempt<=?`,
                [now() + 120, job.order_id, now()]);
                if (!claim.changes) continue;
                try {
                    // Keep original time and ID on retries, including ambiguous HTTP timeouts.
                    if (now() - job.event_time >= 7 * 86400) throw new Error('expired_event_requires_review');
                    const [order] = await all(`SELECT o.*, c.phone customer_phone, c.email customer_email,
                        (SELECT COALESCE(SUM(t.amount),0) FROM transactions t
                            WHERE t.order_id=o.id AND t.type='Receita' AND t.status='Pago') paid_total
                        FROM orders o LEFT JOIN clients c ON c.id=o.client_id WHERE o.id=?`, [job.order_id]);
                    if (!order || ['Cancelado', 'Arte Arquivada'].includes(order.status)
                        || Math.max(Number(order.amount_paid || 0), Number(order.paid_total || 0)) <= 0) {
                        await run(`UPDATE meta_purchase_events SET status='cancelled',last_error='order_not_paid_or_cancelled',
                            updated_at=CURRENT_TIMESTAMP WHERE order_id=?`, [job.order_id]);
                        continue;
                    }
                    if (!job.payload && (!Number.isFinite(Number(job.purchase_value)) || Number(job.purchase_value) <= 0)
                        && Number(order.total_price) > 0) {
                        job.purchase_value = Number(order.total_price);
                        await run('UPDATE meta_purchase_events SET purchase_value=? WHERE order_id=?', [job.purchase_value, job.order_id]);
                    }
                    const payload = job.payload ? JSON.parse(job.payload) : buildPayload(job, order);
                    // Freeze payload before HTTP: retry cannot become a different conversion.
                    await run('UPDATE meta_purchase_events SET payload=? WHERE order_id=?', [JSON.stringify(payload), job.order_id]);
                    const response = await post(
                        `https://graph.facebook.com/${config.graphVersion}/${config.pixelId}/events`, payload,
                        { timeout: 12000, params: { access_token: config.accessToken } }
                    );
                    if (Number(response.data?.events_received) !== 1) throw new Error('meta_did_not_confirm_receipt');
                    await run(`UPDATE meta_purchase_events SET status='sent',last_error=NULL,response_payload=?,
                        updated_at=CURRENT_TIMESTAMP WHERE order_id=?`,
                    [JSON.stringify({ events_received: response.data.events_received, messages: response.data.messages || [] }), job.order_id]);
                } catch (error) {
                    // Do not persist axios errors: they contain the access token and user data.
                    const code = error.response?.data?.error?.code;
                    const reason = code ? `meta_error_${code}` :
                        ['missing_customer_phone_or_email','invalid_purchase_value','expired_event_requires_review','meta_did_not_confirm_receipt']
                            .includes(error.message) ? error.message : 'meta_request_failed';
                    const expired = now() - job.event_time >= 7 * 86400;
                    await run(`UPDATE meta_purchase_events SET status=?,last_error=?,next_attempt=?,
                        updated_at=CURRENT_TIMESTAMP WHERE order_id=?`,
                    [expired ? 'expired' : 'retry', reason, now() + Math.min(3600, 30 * 2 ** Math.min(job.attempts, 7)), job.order_id]);
                }
            }
        } finally { busy = false; }
    }

    async function diagnostics() {
        await initialize();
        return {
            configured: Boolean(config.pixelId && config.accessToken),
            test_mode: Boolean(config.testEventCode),
            event: 'Purchase', trigger: 'first_deposit', currency: 'BRL',
            counts: await all('SELECT status,COUNT(*) total FROM meta_purchase_events GROUP BY status'),
            recent: await all(`SELECT order_id,status,purchase_value,event_time,attempts,last_error,updated_at
                FROM meta_purchase_events WHERE status <> 'historical' ORDER BY event_time DESC LIMIT 20`)
        };
    }
    return { initialize, processDue, diagnostics };
}

let worker;
let timer;
function getWorker() {
    if (!worker) {
        const { metaCapiConfig } = require('../config/metaCapi');
        const { appConfig } = require('../config/appConfig');
        worker = createMetaPurchaseSync({ db: require('../database'), config: metaCapiConfig,
            tenantKey: appConfig.tenantKey, post: (...args) => require('axios').post(...args) });
    }
    return worker;
}
async function start() {
    if (timer) return;
    await require('../database').ready;
    // database.js schedules schema creation in its connection callback. Do not
    // accept payments until the outbox and triggers have been installed.
    await getWorker().initialize();
    const tick = () => getWorker().processDue().catch(() => console.error('Meta Purchase: falha ao processar fila.'));
    timer = setInterval(tick, 15000);
    timer.unref();
    tick();
}
module.exports = { createMetaPurchaseSync, start, diagnostics: () => getWorker().diagnostics() };
