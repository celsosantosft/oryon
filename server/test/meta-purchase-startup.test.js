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
    const db = new sqlite3.Database(path.join(dir, 'test.db'));
    t.after(() => new Promise(resolve => db.close(resolve)));
    const triggers = await new Promise((resolve, reject) => db.all(
        "SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'meta_purchase_%'",
        (error, rows) => error ? reject(error) : resolve(rows)
    ));
    assert.equal(triggers.length, 5);
    assert.doesNotMatch(output, /SQLITE_ERROR/);

    await new Promise((resolve, reject) => db.run(
        "INSERT INTO users(id,name,email,password,role) VALUES(9001,'Test','origin-test@example.com','not-a-login-password','admin')",
        error => error ? reject(error) : resolve()));
    const token = require('jsonwebtoken').sign({ id: 9001 }, 'isolated-test-secret-not-production');
    const form = source => {
        const body = new FormData();
        Object.entries({ client_name: 'Isolated customer', client_phone: '81999990000',
            product_type: 'Test product', fabric_type: 'Test fabric', sizes_json: '{"M":1}',
            unit_price: '10', amount_paid: '0', ...(source === undefined ? {} : { acquisition_source: source }) })
            .forEach(([key, value]) => body.append(key, value));
        return body;
    };
    const request = async (route, method, source) => fetch(`http://127.0.0.1:${port}${route}`, {
        method, headers: { Authorization: `Bearer ${token}` }, body: form(source)
    });
    const created = await request('/api/api/orders', 'POST', 'referral');
    const createdText = await created.text();
    assert.equal(created.status, 200, createdText + '\n' + output);
    const result = JSON.parse(createdText);
    const readOrder = () => new Promise((resolve, reject) => db.get(
        'SELECT id,acquisition_source FROM orders WHERE tracking_code=?', [result.tracking_code],
        (error, row) => error ? reject(error) : resolve(row)));
    const order = await readOrder();
    assert.equal(order.acquisition_source, 'referral');
    assert.equal((await request(`/api/api/orders/${order.id}`, 'PUT', 'meta_ads')).status, 200);
    assert.equal((await readOrder()).acquisition_source, 'meta_ads');
    assert.equal((await request(`/api/api/orders/${order.id}`, 'PUT', undefined)).status, 200);
    assert.equal((await readOrder()).acquisition_source, 'meta_ads');
    assert.equal((await request(`/api/api/orders/${order.id}`, 'PUT', 'invalid')).status, 400);
    assert.equal((await readOrder()).acquisition_source, 'meta_ads');
});
