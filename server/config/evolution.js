const fs = require('fs');
const path = require('path');
const axios = require('axios');

const DEFAULT_BASE_URL = 'http://127.0.0.1:8080';
const DEFAULT_INSTANCE = 'AtosVendas';
const DEFAULT_PUBLIC_APP_URL = 'https://atosfardamentos.com.br';

const SERVER_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..');

function parseEnvLine(line) {
    const trimmed = String(line || '').trim();
    if (!trimmed || trimmed.startsWith('#')) return null;

    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) return null;

    const key = match[1];
    let value = match[2].trim();
    const quote = value[0];

    if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
        value = value.slice(1, -1);
    } else {
        value = value.replace(/\s+#.*$/, '').trim();
    }

    return { key, value };
}

function readEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return null;

    const values = {};
    const content = fs.readFileSync(filePath, 'utf8');

    content.split(/\r?\n/).forEach((line) => {
        const parsed = parseEnvLine(line);
        if (parsed) values[parsed.key] = parsed.value;
    });

    return { filePath, values };
}

function loadEnvFiles() {
    return [
        path.join(SERVER_ROOT, '.env'),
        path.join(PROJECT_ROOT, '.env')
    ].map(readEnvFile).filter(Boolean);
}

const envFiles = loadEnvFiles();

function readConfigValue(keys) {
    for (const key of keys) {
        const value = process.env[key];
        if (String(value || '').trim()) {
            return { value: String(value).trim(), source: `process.env.${key}` };
        }
    }

    for (const envFile of envFiles) {
        for (const key of keys) {
            const value = envFile.values[key];
            if (String(value || '').trim()) {
                return { value: String(value).trim(), source: `${path.basename(envFile.filePath)}:${key}` };
            }
        }
    }

    return { value: '', source: '' };
}

function normalizeUrl(value, fallback = '') {
    const trimmed = String(value || '').trim().replace(/\/+$/, '');
    if (!trimmed) return fallback;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `http://${trimmed}`;
}

function readBooleanConfig(keys) {
    const resolved = readConfigValue(keys);
    const normalized = String(resolved.value || '').trim().toLowerCase();

    if (!resolved.source) {
        return {
            value: null,
            source: '',
            configured: false
        };
    }

    return {
        value: ['true', '1', 'yes', 'on'].includes(normalized),
        source: resolved.source,
        configured: true
    };
}

function resolveEvolutionConfig() {
    const baseUrl = readConfigValue(['EVOLUTION_BASE_URL', 'SERVER_URL']);
    const apiKey = readConfigValue(['EVOLUTION_API_KEY', 'AUTHENTICATION_API_KEY']);
    const instance = readConfigValue(['EVOLUTION_INSTANCE', 'WHATSAPP_INSTANCE']);
    const publicAppUrl = readConfigValue(['PUBLIC_APP_URL', 'APP_PUBLIC_URL']);
    const webhookUrl = readConfigValue(['EVOLUTION_WEBHOOK_URL', 'WHATSAPP_WEBHOOK_URL']);
    const saveDataLabels = readBooleanConfig(['DATABASE_SAVE_DATA_LABELS']);
    const saveDataChats = readBooleanConfig(['DATABASE_SAVE_DATA_CHATS']);
    const saveDataContacts = readBooleanConfig(['DATABASE_SAVE_DATA_CONTACTS']);
    const saveDataMessages = readBooleanConfig(['DATABASE_SAVE_DATA_NEW_MESSAGE']);
    const saveMessageUpdates = readBooleanConfig(['DATABASE_SAVE_MESSAGE_UPDATE']);
    const saveDataHistoric = readBooleanConfig(['DATABASE_SAVE_DATA_HISTORIC']);

    const resolvedPublicAppUrl = normalizeUrl(publicAppUrl.value, DEFAULT_PUBLIC_APP_URL);

    return {
        baseUrl: normalizeUrl(baseUrl.value, DEFAULT_BASE_URL),
        baseUrlSource: baseUrl.source || 'default',
        apiKey: apiKey.value,
        apiKeySource: apiKey.source,
        instance: instance.value || DEFAULT_INSTANCE,
        instanceSource: instance.source || 'default',
        publicAppUrl: resolvedPublicAppUrl,
        publicAppUrlSource: publicAppUrl.source || 'default',
        webhookUrl: normalizeUrl(webhookUrl.value, `${resolvedPublicAppUrl}/api/whatsapp/webhook`),
        webhookUrlSource: webhookUrl.source || 'default',
        dataStorage: {
            labels: saveDataLabels,
            chats: saveDataChats,
            contacts: saveDataContacts,
            messages: saveDataMessages,
            messageUpdates: saveMessageUpdates,
            historic: saveDataHistoric
        }
    };
}

const evolutionConfig = Object.freeze(resolveEvolutionConfig());

function createEvolutionClient(overrides = {}) {
    return axios.create({
        baseURL: evolutionConfig.baseUrl,
        timeout: overrides.timeout || 15000,
        headers: {
            ...(evolutionConfig.apiKey ? { apikey: evolutionConfig.apiKey } : {}),
            'Content-Type': 'application/json',
            ...(overrides.headers || {})
        }
    });
}

function buildEvolutionTextPayload(number, text, options = {}) {
    const payload = {
        number,
        text
    };

    if (options.delay !== undefined) payload.delay = Number(options.delay) || 0;
    if (options.linkPreview !== undefined) payload.linkPreview = Boolean(options.linkPreview);
    if (options.quoted) payload.quoted = options.quoted;
    if (Array.isArray(options.mentioned)) payload.mentioned = options.mentioned;

    return payload;
}

function getEvolutionDiagnostics() {
    return {
        baseUrl: evolutionConfig.baseUrl,
        baseUrlSource: evolutionConfig.baseUrlSource,
        instance: evolutionConfig.instance,
        instanceSource: evolutionConfig.instanceSource,
        webhookUrl: evolutionConfig.webhookUrl,
        webhookUrlSource: evolutionConfig.webhookUrlSource,
        hasApiKey: Boolean(evolutionConfig.apiKey),
        apiKeySource: evolutionConfig.apiKey ? evolutionConfig.apiKeySource : '',
        dataStorage: evolutionConfig.dataStorage
    };
}

module.exports = {
    evolutionConfig,
    EVOLUTION_BASE_URL: evolutionConfig.baseUrl,
    EVOLUTION_API_KEY: evolutionConfig.apiKey,
    EVOLUTION_INSTANCE: evolutionConfig.instance,
    PUBLIC_APP_URL: evolutionConfig.publicAppUrl,
    EVOLUTION_WEBHOOK_URL: evolutionConfig.webhookUrl,
    createEvolutionClient,
    buildEvolutionTextPayload,
    getEvolutionDiagnostics
};
