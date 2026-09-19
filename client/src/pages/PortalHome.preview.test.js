import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

test('marks only the preview entry as a test environment', async () => {
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });

    try {
        const { default: PortalHome } = await vite.ssrLoadModule('/src/pages/PortalHome.jsx');
        const official = renderToStaticMarkup(
            React.createElement(MemoryRouter, null, React.createElement(PortalHome))
        );
        const preview = renderToStaticMarkup(
            React.createElement(MemoryRouter, null, React.createElement(PortalHome, { preview: true }))
        );

        assert.equal(official.includes('Ambiente de teste'), false);
        assert.equal(official.includes('portal-preview-entry'), false);
        assert.equal(preview.includes('Ambiente de teste'), true);
        assert.match(preview, /portal-preview-entry/);
    } finally {
        await vite.close();
    }
});

test('builds preview links without losing the real portal token', async () => {
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });

    try {
        const { buildPortalTarget } = await vite.ssrLoadModule('/src/utils/portalRequestState.js');
        const response = {
            tracking_code: '#ATOS-7376',
            portal_path: '/portal/%23ATOS-7376?token=token-real'
        };

        assert.equal(
            buildPortalTarget({ preview: true, response, safeCode: '7376', portalToken: '' }),
            '/portal-preview/%23ATOS-7376?token=token-real'
        );
        assert.equal(
            buildPortalTarget({ preview: false, response, safeCode: '7376', portalToken: '' }),
            '/portal/%23ATOS-7376?token=token-real'
        );
    } finally {
        await vite.close();
    }
});
