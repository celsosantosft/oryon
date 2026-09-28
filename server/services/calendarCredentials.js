const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { appPaths } = require('../config/paths');
const { appConfig } = require('../config/appConfig');
const { decryptCredential } = require('./googleCalendarClient');

const KEY_FILE_NAME = '.calendar-encryption-key';

function resolveCalendarEncryptionKey({ env = process.env, dataDir = appPaths.dataDir } = {}) {
    const configured = String(env.CALENDAR_TOKEN_ENCRYPTION_KEY || '').trim();
    if (configured) return configured;

    const keyPath = path.join(dataDir, KEY_FILE_NAME);
    if (fs.existsSync(keyPath)) {
        const saved = fs.readFileSync(keyPath, 'utf8').trim();
        if (saved) return saved;
    }

    fs.mkdirSync(dataDir, { recursive: true });
    const generated = crypto.randomBytes(32).toString('base64');
    fs.writeFileSync(keyPath, generated, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    return generated;
}

function defaultRedirectUri() {
    return `${appConfig.publicAppUrl.replace(/\/$/, '')}/api/calendar/oauth/callback`;
}

function buildStoredGoogleConfig(row, key = resolveCalendarEncryptionKey()) {
    if (!row?.google_client_id || !row?.encrypted_client_secret) return null;
    return {
        clientId: row.google_client_id,
        clientSecret: decryptCredential(row.encrypted_client_secret, key),
        redirectUri: row.oauth_redirect_uri || defaultRedirectUri()
    };
}

function buildGoogleConfig(row, key = resolveCalendarEncryptionKey()) {
    const stored = buildStoredGoogleConfig(row, key);
    if (stored) return stored;
    return {
        clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
        redirectUri: process.env.GOOGLE_CALENDAR_REDIRECT_URI || defaultRedirectUri()
    };
}

function hasGoogleConfiguration(row) {
    const storedReady = Boolean(row?.google_client_id && row?.encrypted_client_secret && (row?.oauth_redirect_uri || defaultRedirectUri()));
    const envReady = Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID && process.env.GOOGLE_CALENDAR_CLIENT_SECRET && (process.env.GOOGLE_CALENDAR_REDIRECT_URI || defaultRedirectUri()));
    return storedReady || envReady;
}

module.exports = {
    resolveCalendarEncryptionKey,
    defaultRedirectUri,
    buildStoredGoogleConfig,
    buildGoogleConfig,
    hasGoogleConfiguration
};
