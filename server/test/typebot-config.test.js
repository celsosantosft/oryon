const test = require('node:test');
const assert = require('node:assert/strict');
const { saveTypebotConfig } = require('../services/typebotConfig');

test('saving once per contact preserves bot identity and ignores, with no session expiry', async () => {
    const calls = [];
    const api = {
        get: async () => ({ data: [{ id: 'existing', typebot: 'my-bot', ignoreJids: ['ignored'] }] }),
        put: async (url, body) => { calls.push({ url, body }); return { data: body }; },
        post: async () => assert.fail('must not recreate an existing bot'),
        delete: async () => assert.fail('must not delete contact sessions')
    };
    const body = { enabled: true, url: 'https://typebot.co', typebot: 'my-bot', oncePerContact: true };
    await saveTypebotConfig(api, 'AtosVendas', body);
    await saveTypebotConfig(api, 'AtosVendas', body);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, '/typebot/update/existing/AtosVendas');
    assert.equal(calls[0].body.keepOpen, true);
    assert.equal(calls[0].body.expire, 0);
    assert.deepEqual(calls[0].body.ignoreJids, ['ignored']);
});

test('lookup failure never triggers bot creation or deletion', async () => {
    await assert.rejects(saveTypebotConfig({
        get: async () => { throw new Error('offline'); },
        post: async () => assert.fail('must not create on failed lookup')
    }, 'AtosVendas', { typebot: 'my-bot' }), /offline/);
});

test('new integration can retain repeated attendance when explicitly selected', async () => {
    const result = await saveTypebotConfig({
        get: async () => ({ data: [] }),
        post: async (url, body) => { assert.equal(url, '/typebot/create/AtosVendas'); return { data: body }; }
    }, 'AtosVendas', { typebot: 'new-bot', oncePerContact: false });
    assert.equal(result.data.keepOpen, false);
});
