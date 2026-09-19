import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getPortalErrorContent } from './portalRequestState.js';

test('maps portal failures to clear customer-facing messages', () => {
    assert.equal(getPortalErrorContent({ response: { status: 404 } }).title, 'Pedido não encontrado');
    assert.equal(getPortalErrorContent({ response: { status: 401 } }).title, 'Link inválido');
    assert.equal(getPortalErrorContent({ response: { status: 403 } }).title, 'Link inválido');
    assert.equal(getPortalErrorContent({ response: { status: 500 } }).title, 'Portal temporariamente indisponível');
});

test('exposes request errors and prevents repeated portal actions', () => {
    const hookSource = readFileSync(new URL('../hooks/usePortalOrder.js', import.meta.url), 'utf8');
    const portalSource = readFileSync(new URL('../pages/ClientPortal.jsx', import.meta.url), 'utf8');
    const actionSources = [
        '../components/tabs/HomeTab.jsx',
        '../components/tabs/BulkTab.jsx',
        '../components/tabs/ListTab.jsx'
    ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');

    assert.match(hookSource, /const \[error, setError\] = useState\(null\)/);
    assert.match(hookSource, /return \{ order, loading, error, updateOrderStatus \}/);
    assert.match(portalSource, /pendingActionRef\.current/);
    assert.match(actionSources, /disabled=\{pendingAction === 'approve-art'\}/);
    assert.match(actionSources, /disabled=\{pendingAction === 'submit-list'\}/);
    assert.match(actionSources, /disabled=\{pendingAction === 'submit-bulk'\}/);
});
