import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('uses the approved mobile portal officially and keeps preview routes', () => {
    const source = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');

    assert.match(source, /path="\/portal" element={<PortalHome modern \/>}/);
    assert.match(source, /path="\/portal\/:code" element={<ClientPortal modern \/>}/);
    assert.match(source, /path="\/portal-preview" element={<PortalHome preview \/>}/);
    assert.match(source, /path="\/portal-preview\/:code" element={<ClientPortal preview \/>}/);
});

test('uses a mobile-safe viewport without disabling zoom', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

    assert.match(html, /viewport-fit=cover/);
    assert.match(html, /interactive-widget=resizes-content/);
    assert.doesNotMatch(html, /maximum-scale|user-scalable/);
});
