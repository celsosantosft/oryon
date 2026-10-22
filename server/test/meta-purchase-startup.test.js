const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtemp } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const sqlite3 = require('sqlite3');

test('server installs payment triggers before accepting requests on a fresh isolated database', { timeout: 20000 }, async t => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'oryon-purchase-startup-'));
    const port = await new Promise(resolve => {
        const socket = net.createServer();
        socket.listen(0, '127.0.0.1', () => {
            const selected = socket.address().port;
            socket.close(() => resolve(selected));
        });
    });
    const child = spawn(process.execPath, ['server.js'], {
        cwd: path.join(__dirname, '..'), windowsHide: true,
        env: { ...process.env, APP_DATA_DIR: dir, APP_DATABASE_PATH: path.join(dir, 'test.db'),
            APP_UPLOADS_DIR: path.join(dir, 'uploads'), PORT: String(port),
            JWT_SECRET: 'isolated-test-secret-not-production', ADMIN_PASSWORD: '', NODE_ENV: 'test' }
    });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    const exit = new Promise(resolve => child.once('exit', resolve));
    t.after(async () => {
        if (child.exitCode === null) child.kill();
        await exit;
    });
    let response;
    for (let attempt = 0; attempt < 120; attempt += 1) {
        if (child.exitCode !== null) assert.fail(`Server failed to start: ${output}`);
        try {
            response = await fetch(`http://127.0.0.1:${port}/api/whatsapp/meta/purchases`);
            break;
        } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    assert.equal(response?.status, 401, output);
    const db = new sqlite3.Database(path.join(dir, 'test.db'), sqlite3.OPEN_READONLY);
    const triggers = await new Promise((resolve, reject) => db.all(
        "SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'meta_purchase_%'",
        (error, rows) => error ? reject(error) : resolve(rows)
    ));
    await new Promise(resolve => db.close(resolve));
    assert.equal(triggers.length, 4);
    assert.doesNotMatch(output, /SQLITE_ERROR/);
});
