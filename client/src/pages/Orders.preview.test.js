import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
const ordersSource = readFileSync(new URL('./Orders.jsx', import.meta.url), 'utf8');
const modalSource = readFileSync(new URL('../components/Modal.jsx', import.meta.url), 'utf8');
const previewStyles = readFileSync(new URL('../styles/OrdersPreview.css', import.meta.url), 'utf8');

test('lets the official orders route adapt to the viewport and keeps the preview available', () => {
    assert.match(appSource, /path="\/orders" element={<Orders \/>}/);
    assert.match(appSource, /path="\/orders-preview" element={<Orders key="preview" preview \/>}/);
});

test('applies the tenant theme to the approved orders experience', () => {
    assert.match(ordersSource, /appConfig\.theme === 'monochrome'/);
    assert.match(ordersSource, /orders-preview--monochrome/);
    assert.match(ordersSource, /orders-preview--default/);
    assert.match(previewStyles, /\.orders-preview--default\s*\{[\s\S]*--orders-accent:\s*#2563EB/);
    assert.match(previewStyles, /\.orders-preview--monochrome\s*\{[\s\S]*--orders-accent:\s*#111827/);
});

test('uses native mobile controls and accessible preview dialogs', () => {
    assert.match(previewStyles, /font-size:\s*16px !important/);
    assert.match(previewStyles, /min-height:\s*44px/);
    assert.match(previewStyles, /env\(safe-area-inset-bottom\)/);
    assert.match(previewStyles, /@media \(hover: none\), \(pointer: coarse\)/);
    assert.match(previewStyles, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(modalSource, /manageFocus = false/);
    assert.match(modalSource, /role=\{manageFocus \? "dialog" : undefined\}/);
    assert.match(modalSource, /aria-modal=\{manageFocus \|\| undefined\}/);
});

test('groups order detail sizes from smallest infant to adult sizes', () => {
    assert.match(ordersSource, /normalizeGradeSize/);
    assert.match(ordersSource, /sortGradeItems/);
    assert.match(ordersSource, /label: 'Infantil'/);
    assert.match(ordersSource, /label: 'Adulto'/);
    assert.match(ordersSource, /<OrderSizeGroups sizes=\{line\.sizes_json\}/);
});
