const express = require('express');
const crypto = require('crypto');
const db = require('../database');
const { authenticateToken, authorizeRole } = require('../middlewares/auth');
const { appConfig } = require('../config/appConfig');
const { DEFAULT_REMINDER_DAYS, normalizeReminderDays } = require('../utils/calendarSettings');
const { createGoogleCalendarClient, encryptCredential, decryptCredential } = require('../services/googleCalendarClient');

const router = express.Router();
const adminOnly = [authenticateToken, authorizeRole(['admin'])];
const google = createGoogleCalendarClient();

function get(sql, params = []) {
    return new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
}
function all(sql, params = []) {
    return new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
}
function run(sql, params = []) {
    return new Promise((resolve, reject) => db.run(sql, params, function onRun(error) {
        if (error) reject(error); else resolve({ changes: this.changes, lastID: this.lastID });
    }));
}
function safeIntegration(row, counts = {}) {
    const reminderDays = (() => { try { return normalizeReminderDays(JSON.parse(row?.reminder_days || '[]')); } catch { return [...DEFAULT_REMINDER_DAYS]; } })();
    return {
        configured: Boolean(row?.enabled),
        server_ready: google.isConfigured(),
        account_email: row?.account_email || null,
        calendar_name: row?.calendar_name || 'Entregas Oryon',
        calendar_url: row?.calendar_url || null,
        reminder_days: reminderDays,
        health: row?.health || 'disconnected',
        last_error: row?.last_error || null,
        last_synced_at: row?.last_synced_at || null,
        pending_count: counts.pending_count || 0,
        failed_count: counts.failed_count || 0
    };
}

router.get('/calendar/integration', ...adminOnly, async (req, res) => {
    try {
        const [row, counts] = await Promise.all([
            get('SELECT * FROM calendar_integrations WHERE tenant_key = ?', [appConfig.tenantKey]),
            get(`SELECT
                SUM(CASE WHEN sync_state IN ('pending','processing') THEN 1 ELSE 0 END) AS pending_count,
                SUM(CASE WHEN sync_state = 'failed' THEN 1 ELSE 0 END) AS failed_count
                FROM order_calendar_events WHERE tenant_key = ?`, [appConfig.tenantKey])
        ]);
        res.json(safeIntegration(row, counts));
    } catch (error) {
        res.status(500).json({ message: 'Não foi possível consultar o Google Agenda.' });
    }
});

router.post('/calendar/oauth/start', ...adminOnly, async (req, res) => {
    try {
        if (!google.isConfigured()) return res.status(503).json({ message: 'Google Agenda ainda não foi configurado no servidor.' });
        const state = crypto.randomBytes(32).toString('base64url');
        const verifier = crypto.randomBytes(48).toString('base64url');
        const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
        await run('DELETE FROM calendar_oauth_sessions WHERE expires_at <= CURRENT_TIMESTAMP');
        await run(`INSERT INTO calendar_oauth_sessions (state_hash, tenant_key, user_id, code_verifier, expires_at)
            VALUES (?, ?, ?, ?, datetime('now', '+10 minutes'))`,
        [crypto.createHash('sha256').update(state).digest('hex'), appConfig.tenantKey, req.user.id, verifier]);
        res.json({ authorization_url: google.buildAuthorizationUrl({ state, codeChallenge: challenge }) });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message || 'Não foi possível iniciar a conexão.' });
    }
});

router.get('/calendar/oauth/callback', async (req, res) => {
    const redirect = (result) => res.redirect(`${appConfig.publicAppUrl}/deliveries?calendar=${result}`);
    try {
        if (!req.query.code || !req.query.state) return redirect('error');
        const stateHash = crypto.createHash('sha256').update(String(req.query.state)).digest('hex');
        const session = await get(`SELECT * FROM calendar_oauth_sessions
            WHERE state_hash = ? AND expires_at > CURRENT_TIMESTAMP`, [stateHash]);
        if (!session) return redirect('error');
        await run('DELETE FROM calendar_oauth_sessions WHERE state_hash = ?', [stateHash]);
        const tokens = await google.exchangeCode(String(req.query.code), session.code_verifier);
        if (!tokens.refresh_token) throw new Error('O Google não forneceu autorização permanente. Tente conectar novamente.');
        const [email, calendar] = await Promise.all([
            google.getAccountEmail(tokens.access_token),
            google.ensureDeliveryCalendar(tokens.access_token)
        ]);
        const encrypted = encryptCredential(tokens.refresh_token, process.env.CALENDAR_TOKEN_ENCRYPTION_KEY);
        await run(`INSERT INTO calendar_integrations
            (tenant_key, provider, account_email, calendar_id, calendar_name, calendar_url, encrypted_refresh_token, reminder_days, enabled, health, last_error, updated_at)
            VALUES (?, 'google', ?, ?, ?, ?, ?, ?, 1, 'connected', NULL, CURRENT_TIMESTAMP)
            ON CONFLICT(tenant_key) DO UPDATE SET account_email=excluded.account_email, calendar_id=excluded.calendar_id,
            calendar_name=excluded.calendar_name, calendar_url=excluded.calendar_url, encrypted_refresh_token=excluded.encrypted_refresh_token,
            enabled=1, health='connected', last_error=NULL, updated_at=CURRENT_TIMESTAMP`,
        [session.tenant_key, email, calendar.id, calendar.name, calendar.url, encrypted, JSON.stringify(DEFAULT_REMINDER_DAYS)]);
        return redirect('connected');
    } catch (error) {
        console.error('Falha no callback do Google Agenda:', error.category || error.message);
        return redirect('error');
    }
});

router.put('/calendar/integration', ...adminOnly, async (req, res) => {
    try {
        const reminders = normalizeReminderDays(req.body?.reminder_days);
        await run(`UPDATE calendar_integrations SET reminder_days = ?, updated_at = CURRENT_TIMESTAMP
            WHERE tenant_key = ? AND enabled = 1`, [JSON.stringify(reminders), appConfig.tenantKey]);
        await run(`UPDATE order_calendar_events SET desired_operation='upsert', sync_state='pending', retry_count=0,
            next_retry_at=NULL, updated_at=CURRENT_TIMESTAMP WHERE tenant_key=? AND event_id IS NOT NULL`, [appConfig.tenantKey]);
        res.json({ reminder_days: reminders });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.post('/calendar/integration/retry', ...adminOnly, async (req, res) => {
    try {
        const result = await run(`UPDATE order_calendar_events SET sync_state='pending', retry_count=0,
            next_retry_at=NULL, last_error=NULL, updated_at=CURRENT_TIMESTAMP
            WHERE tenant_key=? AND sync_state='failed'`, [appConfig.tenantKey]);
        res.json({ queued: result.changes });
    } catch { res.status(500).json({ message: 'Não foi possível reenfileirar as sincronizações.' }); }
});

router.post('/calendar/integration/sync-active', ...adminOnly, async (req, res) => {
    try {
        const orders = await all(`SELECT id FROM orders WHERE delivery_date >= date('now')
            AND COALESCE(status, '') NOT IN ('Entregue/Concluído','Concluído','Cancelado')`);
        for (const order of orders) {
            await run(`INSERT INTO order_calendar_events (tenant_key, order_id, desired_operation, sync_state)
                VALUES (?, ?, 'upsert', 'pending') ON CONFLICT(tenant_key, order_id) DO UPDATE SET
                desired_operation='upsert', sync_state='pending', retry_count=0, next_retry_at=NULL, updated_at=CURRENT_TIMESTAMP`,
            [appConfig.tenantKey, order.id]);
        }
        res.json({ queued: orders.length });
    } catch { res.status(500).json({ message: 'Não foi possível preparar os pedidos para sincronização.' }); }
});

router.delete('/calendar/integration', ...adminOnly, async (req, res) => {
    try {
        const integration = await get('SELECT encrypted_refresh_token FROM calendar_integrations WHERE tenant_key=?', [appConfig.tenantKey]);
        if (integration?.encrypted_refresh_token) {
            try {
                const token = decryptCredential(integration.encrypted_refresh_token, process.env.CALENDAR_TOKEN_ENCRYPTION_KEY);
                await google.revokeToken(token);
            } catch { /* A remoção local não depende da revogação remota. */ }
        }
        await run(`UPDATE calendar_integrations SET enabled=0, encrypted_refresh_token=NULL, health='disconnected',
            last_error=NULL, updated_at=CURRENT_TIMESTAMP WHERE tenant_key=?`, [appConfig.tenantKey]);
        res.status(204).end();
    } catch { res.status(500).json({ message: 'Não foi possível desconectar o Google Agenda.' }); }
});

module.exports = router;
