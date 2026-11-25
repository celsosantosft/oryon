const sqlite3 = require('sqlite3');

function financeQueries(db) {
    const run = (sql, params = []) => new Promise((resolve, reject) => {
        db.run(sql, params, function(error) {
            if (error) reject(error);
            else resolve({ changes: this.changes, lastID: this.lastID });
        });
    });
    const get = (sql, params = []) => new Promise((resolve, reject) =>
        db.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
    const all = (sql, params = []) => new Promise((resolve, reject) =>
        db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
    return { run, get, all };
}

// SQLite admits one writer per database. Waiting in JS leaves sqlite3 workers free for the active writer.
const pendingWrites = new Map();

async function withFinanceWrite(databasePath, operation) {
    const previous = pendingWrites.get(databasePath) || Promise.resolve();
    const current = previous.catch(() => {}).then(() => runFinanceWrite(databasePath, operation));
    pendingWrites.set(databasePath, current);
    try {
        return await current;
    } finally {
        if (pendingWrites.get(databasePath) === current) pendingWrites.delete(databasePath);
    }
}

async function runFinanceWrite(databasePath, operation) {
    // SQLite transactions belong to a connection; other requests must not share this one.
    const db = await new Promise((resolve, reject) => {
        const connection = new sqlite3.Database(databasePath, sqlite3.OPEN_READWRITE, error =>
            error ? reject(error) : resolve(connection));
    });
    db.configure('busyTimeout', 5000);
    const queries = financeQueries(db);
    const { run } = queries;
    try {
        await run('PRAGMA foreign_keys = ON');
        await run('BEGIN IMMEDIATE');
        try {
            const result = await operation(queries);
            await run('COMMIT');
            return result;
        } catch (error) {
            await run('ROLLBACK');
            throw error;
        }
    } finally {
        await new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
    }
}

module.exports = { withFinanceWrite, financeQueries };
