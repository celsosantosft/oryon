import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./ProductionDashboard.jsx', import.meta.url), 'utf8');

test('production order mapping preserves the attached layout', () => {
    assert.match(source, /layout_path:\s*order\.layout_path\s*\|\|\s*null/);
});

test('production order details render the attached layout', () => {
    assert.match(source, /LAYOUT DO PEDIDO/);
    assert.match(source, /uploads\/\$\{order\.layout_path\}/);
    assert.match(source, /Ver imagem original/);
});
