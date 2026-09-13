import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

test('keeps the portal page below SweetAlert dialogs', async () => {
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });

    try {
        const { default: PortalHome } = await vite.ssrLoadModule('/src/pages/PortalHome.jsx');
        const html = renderToStaticMarkup(
            React.createElement(MemoryRouter, null, React.createElement(PortalHome))
        );
        const zIndex = Number(html.match(/z-index:(\d+)/)?.[1]);

        assert.ok(zIndex < 1060, `expected portal z-index below SweetAlert, received ${zIndex}`);
    } finally {
        await vite.close();
    }
});
