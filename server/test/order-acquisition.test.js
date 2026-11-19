const test = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3');
const { normalizeSource, resolveOrderSource } = require('../services/orderAcquisition');

test('origin defaults to unknown and rejects unsupported API values', () => {
    assert.equal(normalizeSource(undefined), 'unknown');
    assert.equal(normalizeSource('referral'), 'referral');
    assert.throws(() => normalizeSource('anything'), /invalid_acquisition_source/);
    assert.throws(() => normalizeSource({ source: 'meta_ads' }), /invalid_acquisition_source/);
});

test('phone alone is not an ad origin; a recent real click can fill unknown without overriding a choice', async t => {
    const db = new sqlite3.Database(':memory:');
    t.after(() => new Promise(resolve => db.close(resolve)));
    const exec = sql => new Promise((resolve, reject) => db.exec(sql, error => error ? reject(error) : resolve()));
    await exec(`CREATE TABLE whatsapp_conversations(id INTEGER PRIMARY KEY,phone TEXT UNIQUE);
        CREATE TABLE whatsapp_messages(id INTEGER PRIMARY KEY,conversation_id INTEGER,direction TEXT,raw_payload TEXT,created_at TEXT);
        INSERT INTO whatsapp_conversations VALUES(1,'558199990000');`);
    const now = Math.floor(Date.now() / 1000);
    assert.equal(await resolveOrderSource(db, '81999990000', 'unknown', now), 'unknown');
    await exec(`INSERT INTO whatsapp_messages VALUES(1,1,'incoming',
        '{"from":"5581999990000","referral":{"ctwa_clid":"real-click-12345"}}',datetime('now','-1 day'));`);
    assert.equal(await resolveOrderSource(db, '81999990000', 'unknown', now), 'meta_ads');
    assert.equal(await resolveOrderSource(db, '81999990000', 'referral', now), 'referral');
    assert.equal(await resolveOrderSource(db, '81999990001', 'unknown', now), 'unknown');
    await exec("UPDATE whatsapp_messages SET created_at=datetime('now','-8 days')");
    assert.equal(await resolveOrderSource(db, '81999990000', 'unknown', now), 'unknown');
    await exec("UPDATE whatsapp_messages SET created_at=datetime('now','+1 day')");
    assert.equal(await resolveOrderSource(db, '81999990000', 'unknown', now), 'unknown');
    await exec("INSERT INTO whatsapp_conversations VALUES(2,'5581999990000')");
    assert.equal(await resolveOrderSource(db, '81999990000', 'unknown', now), 'unknown');
});
