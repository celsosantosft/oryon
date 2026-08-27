const fs = require('fs');
const path = require('path');

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

function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
        const parsed = parseEnvLine(line);
        if (!parsed) return;
        if (process.env[parsed.key] === undefined) {
            process.env[parsed.key] = parsed.value;
        }
    });
}

function loadEnv() {
    [
        path.join(PROJECT_ROOT, '.env'),
        path.join(SERVER_ROOT, '.env')
    ].forEach(loadEnvFile);
}

module.exports = { loadEnv, parseEnvLine, SERVER_ROOT, PROJECT_ROOT };
