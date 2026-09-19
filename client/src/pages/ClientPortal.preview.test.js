import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./ClientPortal.jsx', import.meta.url), 'utf8');

test('keeps the mobile preview styling isolated from the official portal', () => {
    assert.match(source, /const ClientPortal = \(\{ preview = false \}\)/);
    assert.match(source, /preview \? 'portal-preview portal-shell' : undefined/);
    assert.match(source, /preview && \([\s\S]*Ambiente de teste/);
    assert.match(source, /<HomeTab[\s\S]*preview=\{preview\}/);
});

test('uses accessible bottom navigation controls in preview mode', () => {
    assert.match(source, /<button[\s\S]*className="portal-nav-item"/);
    assert.match(source, /aria-current=\{isActive \? 'page' : undefined\}/);
    assert.match(source, /disabled=\{item\.disabled\}/);
});
