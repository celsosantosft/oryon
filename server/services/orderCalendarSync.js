const crypto = require('crypto');
const db = require('../database');
const { appConfig } = require('../config/appConfig');
const { normalizeReminderDays, DEFAULT_REMINDER_DAYS } = require('../utils/calendarSettings');
const { createGoogleCalendarClient, decryptCredential } = require('./googleCalendarClient');
const { resolveCalendarEncryptionKey, buildGoogleConfig } = require('./calendarCredentials');

const FINAL_STATUSES = new Set(['entregue/concluido', 'concluido', 'cancelado', 'pedido revertido para orcamento']);

function normalizedStatus(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function shouldDeleteCalendarEvent(status) {
    return FINAL_STATUSES.has(normalizedStatus(status));
}

function nextDate(date) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
    if (!match) return null;
    const parsed = new Date(`${date}T12:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null;
    parsed.setUTCDate(parsed.getUTCDate() + 1);
    return parsed.toISOString().slice(0, 10);
}

function totalPieces(sizesJson) {
    try {
        const sizes = typeof sizesJson === 'string' ? JSON.parse(sizesJson) : (sizesJson || {});
        return Object.values(sizes).reduce((sum, value) => sum + (Number(value) || 0), 0);
    } catch { return 0; }
}

function buildOrderCalendarEvent(order, reminderDays, context = {}) {
    const end = nextDate(order?.delivery_date);
    if (!end) return null;
    const tenantKey = String(context.tenantKey || appConfig.tenantKey);
    const appUrl = String(context.publicAppUrl || appConfig.publicAppUrl).replace(/\/$/, '');
    return {
        summary: `${order.tracking_code || `Pedido ${order.id}`} - ${order.client_name || 'Cliente'}`,
        description: [
            `Pedido: ${order.tracking_code || order.id}`,
            `Cliente: ${order.client_name || 'Não informado'}`,
            `Peças: ${totalPieces(order.sizes_json)}`,
            `Status: ${order.status || 'Não informado'}`,
            `Abrir no Oryon: ${appUrl}/orders`
        ].join('\n'),
        start: { date: order.delivery_date },
        end: { date: end },
        reminders: {
            useDefault: false,
            overrides: normalizeReminderDays(reminderDays).map(day => ({ method: 'popup', minutes: day * 1440 }))
        },
        extendedProperties: { private: { oryonTenant: tenantKey, oryonOrderId: String(order.id) } }
    };
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
}
function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
}
function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => db.run(sql, params, function onRun(error) {
        if (error) reject(error); else resolve({ changes: this.changes, lastID: this.lastID });
    }));
}

function safeSnapshot(order) {
    if (!order) return null;
    return JSON.stringify({ id: order.id, tracking_code: order.tracking_code, client_name: order.client_name, delivery_date: order.delivery_date, status: order.status });
}

async function integrationEnabled(tenantKey) {
    return dbGet('SELECT enabled FROM calendar_integrations WHERE tenant_key=? AND enabled=1', [tenantKey]);
}

async function enqueueUpsert(orderId, tenantKey = appConfig.tenantKey) {
    if (!await integrationEnabled(tenantKey)) return false;
    await dbRun(`INSERT INTO order_calendar_events (tenant_key, order_id, desired_operation, sync_state)
        VALUES (?, ?, 'upsert', 'pending') ON CONFLICT(tenant_key, order_id) DO UPDATE SET
        desired_operation='upsert', sync_state='pending', retry_count=0, next_retry_at=NULL, last_error=NULL, updated_at=CURRENT_TIMESTAMP`, [tenantKey, orderId]);
    scheduleSoon();
    return true;
}

async function enqueueDelete(orderId, tenantKey = appConfig.tenantKey) {
    if (!await integrationEnabled(tenantKey)) return false;
    const order = await dbGet('SELECT id, tracking_code, client_name, delivery_date, status FROM orders WHERE id=?', [orderId]);
    await dbRun(`INSERT INTO order_calendar_events (tenant_key, order_id, desired_operation, sync_state, order_snapshot_json)
        VALUES (?, ?, 'delete', 'pending', ?) ON CONFLICT(tenant_key, order_id) DO UPDATE SET
        desired_operation='delete', sync_state='pending', retry_count=0, next_retry_at=NULL, last_error=NULL,
        order_snapshot_json=COALESCE(excluded.order_snapshot_json, order_calendar_events.order_snapshot_json), updated_at=CURRENT_TIMESTAMP`,
    [tenantKey, orderId, safeSnapshot(order)]);
    scheduleSoon();
    return true;
}

async function enqueueForCurrentState(orderId, tenantKey = appConfig.tenantKey) {
    const order = await dbGet('SELECT status FROM orders WHERE id=?', [orderId]);
    if (!order || shouldDeleteCalendarEvent(order.status)) return enqueueDelete(orderId, tenantKey);
    return enqueueUpsert(orderId, tenantKey);
}

let processing = false;
let wakeTimer = null;
let interval = null;

async function processDue(limit = 20, tenantKey = appConfig.tenantKey) {
    if (processing) return 0;
    processing = true;
    try {
        const integration = await dbGet('SELECT * FROM calendar_integrations WHERE tenant_key=? AND enabled=1', [tenantKey]);
        if (!integration?.encrypted_refresh_token) return 0;
        const encryptionKey = resolveCalendarEncryptionKey();
        const calendarClient = createGoogleCalendarClient({ config: buildGoogleConfig(integration, encryptionKey) });
        const refreshToken = decryptCredential(integration.encrypted_refresh_token, encryptionKey);
        const accessToken = await calendarClient.refreshAccessToken(refreshToken);
        const reminderDays = (() => { try { return normalizeReminderDays(JSON.parse(integration.reminder_days)); } catch { return [...DEFAULT_REMINDER_DAYS]; } })();
        const jobs = await dbAll(`SELECT * FROM order_calendar_events WHERE tenant_key=? AND
            (sync_state='pending' OR (sync_state='failed' AND (next_retry_at IS NULL OR next_retry_at <= CURRENT_TIMESTAMP)))
            ORDER BY updated_at ASC LIMIT ?`, [tenantKey, limit]);

        for (const job of jobs) {
            const claimed = await dbRun(`UPDATE order_calendar_events SET sync_state='processing', updated_at=CURRENT_TIMESTAMP
                WHERE id=? AND sync_state IN ('pending','failed')`, [job.id]);
            if (!claimed.changes) continue;
            try {
                const order = await dbGet('SELECT * FROM orders WHERE id=?', [job.order_id]);
                const deleting = job.desired_operation === 'delete' || !order || shouldDeleteCalendarEvent(order.status);
                if (deleting) {
                    let eventId = job.event_id;
                    if (!eventId) {
                        eventId = (await calendarClient.findOrderEvent(accessToken, integration.calendar_id, tenantKey, job.order_id))?.id;
                    }
                    if (eventId) await calendarClient.deleteEvent(accessToken, integration.calendar_id, eventId);
                    await dbRun(`UPDATE order_calendar_events SET event_id=NULL, sync_state='synced', last_error=NULL,
                        last_synced_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [job.id]);
                    continue;
                }

                const event = buildOrderCalendarEvent(order, reminderDays, { tenantKey, publicAppUrl: appConfig.publicAppUrl });
                if (!event) {
                    await dbRun(`UPDATE order_calendar_events SET sync_state='skipped', last_error='Pedido sem data de entrega válida',
                        updated_at=CURRENT_TIMESTAMP WHERE id=?`, [job.id]);
                    continue;
                }
                const fingerprint = crypto.createHash('sha256').update(JSON.stringify(event)).digest('hex');
                if (job.event_id && job.content_fingerprint === fingerprint) {
                    await dbRun(`UPDATE order_calendar_events SET sync_state='synced', last_error=NULL, last_synced_at=CURRENT_TIMESTAMP WHERE id=?`, [job.id]);
                    continue;
                }
                let eventId = job.event_id;
                if (!eventId) eventId = (await calendarClient.findOrderEvent(accessToken, integration.calendar_id, tenantKey, order.id))?.id;
                const saved = eventId
                    ? await calendarClient.updateEvent(accessToken, integration.calendar_id, eventId, event)
                    : await calendarClient.insertEvent(accessToken, integration.calendar_id, event);
                await dbRun(`UPDATE order_calendar_events SET event_id=?, content_fingerprint=?, sync_state='synced', retry_count=0,
                    next_retry_at=NULL, last_error=NULL, last_synced_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
                [saved.id || eventId, fingerprint, job.id]);
            } catch (error) {
                const retryCount = Number(job.retry_count || 0) + 1;
                const minutes = Math.min(60, 2 ** Math.min(retryCount, 6));
                await dbRun(`UPDATE order_calendar_events SET sync_state='failed', retry_count=?,
                    next_retry_at=datetime('now', ?), last_error=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
                [retryCount, `+${minutes} minutes`, String(error.message || 'Falha de sincronização').slice(0, 240), job.id]);
                if (error.category === 'reconnect_required') {
                    await dbRun(`UPDATE calendar_integrations SET health='reconnect_required', last_error=?, updated_at=CURRENT_TIMESTAMP WHERE tenant_key=?`,
                    ['Reconecte a conta Google.', tenantKey]);
                }
            }
        }
        await dbRun(`UPDATE calendar_integrations SET last_synced_at=CURRENT_TIMESTAMP,
            health=CASE WHEN health='reconnect_required' THEN health ELSE 'connected' END WHERE tenant_key=?`, [tenantKey]);
        return jobs.length;
    } catch (error) {
        if (error.category === 'reconnect_required') {
            await dbRun(`UPDATE calendar_integrations SET health='reconnect_required', last_error='Reconecte a conta Google.' WHERE tenant_key=?`, [tenantKey]).catch(() => {});
        }
        return 0;
    } finally { processing = false; }
}

function scheduleSoon() {
    if (wakeTimer) return;
    wakeTimer = setTimeout(() => { wakeTimer = null; processDue().catch(() => {}); }, 250);
    wakeTimer.unref?.();
}

function start() {
    if (interval) return;
    interval = setInterval(() => processDue().catch(() => {}), 60_000);
    interval.unref?.();
    scheduleSoon();
}

function stop() {
    if (interval) clearInterval(interval);
    if (wakeTimer) clearTimeout(wakeTimer);
    interval = null;
    wakeTimer = null;
}

module.exports = { buildOrderCalendarEvent, shouldDeleteCalendarEvent, enqueueUpsert, enqueueDelete, enqueueForCurrentState, processDue, start, stop };
