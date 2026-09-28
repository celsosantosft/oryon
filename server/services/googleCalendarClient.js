const crypto = require('crypto');
const axios = require('axios');

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

function encryptionKey(value) {
    if (!String(value || '').trim()) throw new Error('CALENDAR_TOKEN_ENCRYPTION_KEY não configurada.');
    return crypto.createHash('sha256').update(String(value)).digest();
}

function encryptCredential(value, key) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(key), iv);
    const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

function decryptCredential(payload, key) {
    const [version, iv, tag, encrypted] = String(payload || '').split('.');
    if (version !== 'v1' || !iv || !tag || !encrypted) throw new Error('Credencial inválida.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(key), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
}

function bearer(token) {
    return { headers: { Authorization: `Bearer ${token}` } };
}

function sanitizeGoogleError(error) {
    const status = Number(error?.response?.status || 0);
    const code = error?.response?.data?.error;
    const message = typeof code === 'string' ? code : code?.message;
    const reconnectRequired = status === 401 || String(code?.status || '').includes('UNAUTHENTICATED') || message === 'invalid_grant';
    const safe = new Error(reconnectRequired ? 'Reconecte a conta Google.' : (message || 'Falha ao comunicar com o Google Agenda.'));
    safe.category = reconnectRequired ? 'reconnect_required' : 'google_api_error';
    safe.status = status || 502;
    return safe;
}

function createGoogleCalendarClient({ http = axios, config = {} } = {}) {
    const resolved = {
        clientId: config.clientId || process.env.GOOGLE_CALENDAR_CLIENT_ID,
        clientSecret: config.clientSecret || process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
        redirectUri: config.redirectUri || process.env.GOOGLE_CALENDAR_REDIRECT_URI
    };

    function requireConfig() {
        if (!resolved.clientId || !resolved.clientSecret || !resolved.redirectUri) {
            const error = new Error('Google Agenda ainda não foi configurado no servidor.');
            error.status = 503;
            throw error;
        }
    }

    return {
        isConfigured: () => Boolean(resolved.clientId && resolved.clientSecret && resolved.redirectUri && process.env.CALENDAR_TOKEN_ENCRYPTION_KEY),
        buildAuthorizationUrl({ state, codeChallenge }) {
            requireConfig();
            const params = new URLSearchParams({
                client_id: resolved.clientId,
                redirect_uri: resolved.redirectUri,
                response_type: 'code',
                scope: 'openid email https://www.googleapis.com/auth/calendar',
                access_type: 'offline',
                prompt: 'consent',
                state,
                code_challenge: codeChallenge,
                code_challenge_method: 'S256'
            });
            return `${AUTH_URL}?${params}`;
        },
        async exchangeCode(code, verifier) {
            requireConfig();
            try {
                const body = new URLSearchParams({ code, code_verifier: verifier, client_id: resolved.clientId, client_secret: resolved.clientSecret, redirect_uri: resolved.redirectUri, grant_type: 'authorization_code' });
                return (await http.post(TOKEN_URL, body, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })).data;
            } catch (error) { throw sanitizeGoogleError(error); }
        },
        async refreshAccessToken(refreshToken) {
            requireConfig();
            try {
                const body = new URLSearchParams({ refresh_token: refreshToken, client_id: resolved.clientId, client_secret: resolved.clientSecret, grant_type: 'refresh_token' });
                return (await http.post(TOKEN_URL, body, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })).data.access_token;
            } catch (error) { throw sanitizeGoogleError(error); }
        },
        async getAccountEmail(accessToken) {
            try { return (await http.get('https://www.googleapis.com/oauth2/v2/userinfo', bearer(accessToken))).data.email; }
            catch (error) { throw sanitizeGoogleError(error); }
        },
        async ensureDeliveryCalendar(accessToken) {
            try {
                const calendars = (await http.get(`${CALENDAR_API}/users/me/calendarList`, bearer(accessToken))).data.items || [];
                const found = calendars.find(item => item.summary === 'Entregas Oryon');
                if (found) return { id: found.id, name: found.summary, url: `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(found.id)}` };
                const created = (await http.post(`${CALENDAR_API}/calendars`, { summary: 'Entregas Oryon', timeZone: 'America/Sao_Paulo' }, bearer(accessToken))).data;
                return { id: created.id, name: created.summary, url: `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(created.id)}` };
            } catch (error) { throw sanitizeGoogleError(error); }
        },
        async findOrderEvent(accessToken, calendarId, tenantKey, orderId) {
            try {
                const response = await http.get(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`, {
                    ...bearer(accessToken),
                    params: { privateExtendedProperty: [`oryonTenant=${tenantKey}`, `oryonOrderId=${orderId}`], maxResults: 1 },
                    paramsSerializer: { indexes: null }
                });
                return response.data.items?.[0] || null;
            } catch (error) { throw sanitizeGoogleError(error); }
        },
        async insertEvent(accessToken, calendarId, event) {
            try { return (await http.post(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`, event, bearer(accessToken))).data; }
            catch (error) { throw sanitizeGoogleError(error); }
        },
        async updateEvent(accessToken, calendarId, eventId, event) {
            try { return (await http.put(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, event, bearer(accessToken))).data; }
            catch (error) { throw sanitizeGoogleError(error); }
        },
        async deleteEvent(accessToken, calendarId, eventId) {
            try { await http.delete(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, bearer(accessToken)); }
            catch (error) { if (error?.response?.status !== 404) throw sanitizeGoogleError(error); }
        },
        async revokeToken(token) {
            try { await http.post('https://oauth2.googleapis.com/revoke', new URLSearchParams({ token }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }); }
            catch { /* Revogação remota é melhor esforço; a credencial local sempre é removida. */ }
        }
    };
}

module.exports = { encryptCredential, decryptCredential, sanitizeGoogleError, createGoogleCalendarClient };
