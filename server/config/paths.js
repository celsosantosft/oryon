const fs = require('fs');
const path = require('path');
const { loadEnv, SERVER_ROOT } = require('./env');

loadEnv();

function resolveConfiguredPath(value, fallback) {
    const configured = String(value || '').trim();
    if (!configured) return fallback;
    return path.isAbsolute(configured)
        ? path.normalize(configured)
        : path.resolve(SERVER_ROOT, configured);
}

const dataDir = resolveConfiguredPath(process.env.APP_DATA_DIR, SERVER_ROOT);
const databasePath = resolveConfiguredPath(
    process.env.APP_DATABASE_PATH,
    path.join(dataDir, 'atos.db')
);
const uploadsDir = resolveConfiguredPath(
    process.env.APP_UPLOADS_DIR,
    path.join(dataDir, 'uploads')
);

fs.mkdirSync(path.dirname(databasePath), { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

const appPaths = Object.freeze({
    serverRoot: SERVER_ROOT,
    dataDir,
    databasePath,
    uploadsDir
});

module.exports = { appPaths, resolveConfiguredPath };
