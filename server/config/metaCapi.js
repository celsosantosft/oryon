const fs = require('fs');
const path = require('path');

const DEFAULT_GRAPH_VERSION = 'v26.0';
const DEFAULT_EVENT_NAME = 'Lead Qualificado';
const DEFAULT_DEFAULT_COUNTRY_CODE = '55';
const DEFAULT_QUALIFIED_LABELS = [
    'Lead Qualificado',
    'Lead Qualificada',
    'Em Produção',
    'Em Producao'
];
const DEFAULT_QUALIFIED_LABEL_IDS = [];

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

function normalizeGraphVersion(value) {
    const normalized = String(value || DEFAULT_GRAPH_VERSION).trim().toLowerCase();
    if (!normalized) return DEFAULT_GRAPH_VERSION;
    if (/^\d+(\.\d+)?$/.test(normalized)) return `v${normalized}`;
    if (/^v\d+(\.\d+)?$/.test(normalized)) return normalized;
    return DEFAULT_GRAPH_VERSION;
}

function splitConfigList(value, fallback = []) {
    const items = String(value || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);

    return items.length ? items : fallback;
}

function resolveMetaCapiConfig() {
    const pixelId = readConfigValue(['META_PIXEL_ID', 'FACEBOOK_PIXEL_ID', 'FB_PIXEL_ID']);
    const accessToken = readConfigValue(['META_ACCESS_TOKEN', 'META_CAPI_ACCESS_TOKEN', 'FACEBOOK_ACCESS_TOKEN', 'FB_ACCESS_TOKEN']);
    const graphVersion = readConfigValue(['META_GRAPH_VERSION', 'FACEBOOK_GRAPH_VERSION']);
    const eventName = readConfigValue(['META_QUALIFIED_LEAD_EVENT_NAME']);
    const qualifiedLabels = readConfigValue(['META_QUALIFIED_LEAD_LABELS']);
    const qualifiedLabelIds = readConfigValue(['META_QUALIFIED_LEAD_LABEL_IDS']);
    const defaultCountryCode = readConfigValue(['META_DEFAULT_COUNTRY_CODE']);
    const testEventCode = readConfigValue(['META_TEST_EVENT_CODE']);

    return {
        pixelId: pixelId.value,
        pixelIdSource: pixelId.source,
        accessToken: accessToken.value,
        accessTokenSource: accessToken.source,
        graphVersion: normalizeGraphVersion(graphVersion.value),
        graphVersionSource: graphVersion.source || 'default',
        qualifiedLeadEventName: eventName.value || DEFAULT_EVENT_NAME,
        qualifiedLeadEventNameSource: eventName.source || 'default',
        qualifiedLeadLabels: splitConfigList(qualifiedLabels.value, DEFAULT_QUALIFIED_LABELS),
        qualifiedLeadLabelsSource: qualifiedLabels.source || 'default',
        qualifiedLeadLabelIds: splitConfigList(qualifiedLabelIds.value, DEFAULT_QUALIFIED_LABEL_IDS),
        qualifiedLeadLabelIdsSource: qualifiedLabelIds.source || 'default',
        defaultCountryCode: String(defaultCountryCode.value || DEFAULT_DEFAULT_COUNTRY_CODE).replace(/\D/g, '') || DEFAULT_DEFAULT_COUNTRY_CODE,
        defaultCountryCodeSource: defaultCountryCode.source || 'default',
        testEventCode: testEventCode.value,
        testEventCodeSource: testEventCode.source
    };
}

const metaCapiConfig = Object.freeze(resolveMetaCapiConfig());

function getMetaCapiDiagnostics() {
    return {
        graphVersion: metaCapiConfig.graphVersion,
        graphVersionSource: metaCapiConfig.graphVersionSource,
        hasPixelId: Boolean(metaCapiConfig.pixelId),
        pixelIdSource: metaCapiConfig.pixelId ? metaCapiConfig.pixelIdSource : '',
        hasAccessToken: Boolean(metaCapiConfig.accessToken),
        accessTokenSource: metaCapiConfig.accessToken ? metaCapiConfig.accessTokenSource : '',
        qualifiedLeadEventName: metaCapiConfig.qualifiedLeadEventName,
        qualifiedLeadEventNameSource: metaCapiConfig.qualifiedLeadEventNameSource,
        qualifiedLeadLabels: metaCapiConfig.qualifiedLeadLabels,
        qualifiedLeadLabelsSource: metaCapiConfig.qualifiedLeadLabelsSource,
        qualifiedLeadLabelIds: metaCapiConfig.qualifiedLeadLabelIds,
        qualifiedLeadLabelIdsSource: metaCapiConfig.qualifiedLeadLabelIdsSource,
        defaultCountryCode: metaCapiConfig.defaultCountryCode,
        defaultCountryCodeSource: metaCapiConfig.defaultCountryCodeSource,
        hasTestEventCode: Boolean(metaCapiConfig.testEventCode),
        testEventCodeSource: metaCapiConfig.testEventCode ? metaCapiConfig.testEventCodeSource : ''
    };
}

module.exports = {
    metaCapiConfig,
    getMetaCapiDiagnostics
};
