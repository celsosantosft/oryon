import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getLoginErrorMessage,
    handleSessionActivity,
    isInactiveSessionExpired,
    normalizeAuthNotice
} from './authSession.js';

test('login error message falls back instead of rendering objects', () => {
    assert.equal(
        getLoginErrorMessage({ error: 'Token invalido' }),
        'E-mail ou senha incorretos.'
    );

    assert.equal(
        getLoginErrorMessage('[object Object]'),
        'E-mail ou senha incorretos.'
    );
});

test('auth notice falls back instead of rendering objects', () => {
    assert.equal(
        normalizeAuthNotice({ message: 'Sessao encerrada' }),
        'Sua sessão foi encerrada. Entre novamente.'
    );

    assert.equal(
        normalizeAuthNotice('[object Object]'),
        'Sua sessão foi encerrada. Entre novamente.'
    );
});

test('inactive session expires after one hour', () => {
    assert.equal(isInactiveSessionExpired(1_000, 3_601_000), true);
});

test('inactive session stays active before one hour', () => {
    assert.equal(isInactiveSessionExpired(1_000, 3_600_999), false);
});

test('expired activity is stopped before protected handlers run', () => {
    const calls = [];
    const event = {
        cancelable: true,
        preventDefault: () => calls.push('preventDefault'),
        stopImmediatePropagation: () => calls.push('stopImmediatePropagation')
    };

    const expired = handleSessionActivity({
        event,
        lastActivityTime: 1_000,
        currentTime: 3_601_000,
        onExpired: () => calls.push('onExpired'),
        onActive: () => calls.push('onActive')
    });

    assert.equal(expired, true);
    assert.deepEqual(calls, ['preventDefault', 'stopImmediatePropagation', 'onExpired']);
});

test('active activity only refreshes the activity timestamp', () => {
    const calls = [];

    const expired = handleSessionActivity({
        lastActivityTime: 1_000,
        currentTime: 3_600_999,
        onExpired: () => calls.push('onExpired'),
        onActive: () => calls.push('onActive')
    });

    assert.equal(expired, false);
    assert.deepEqual(calls, ['onActive']);
});
