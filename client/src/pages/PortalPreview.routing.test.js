import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('keeps the official portal routes and adds isolated preview routes', () => {
    const source = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');

    assert.match(source, /path="\/portal" element={<PortalHome \/>}/);
    assert.match(source, /path="\/portal\/:code" element={<ClientPortal \/>}/);
    assert.match(source, /path="\/portal-preview" element={<PortalHome preview \/>}/);
    assert.match(source, /path="\/portal-preview\/:code" element={<ClientPortal preview \/>}/);
});
