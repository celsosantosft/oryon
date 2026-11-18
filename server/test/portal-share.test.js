const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const sharp = require('sharp');

const {
    buildPortalDirectPath,
    buildPortalShareHtml,
    buildPortalSharePath,
    createPortalPreviewImage
} = require('../utils/portalShare');

const record = {
    tracking_code: '#ATOS-1892',
    portal_token: 'token-seguro',
    client_name: 'Colégio Central',
    layout_path: 'layout-cliente.png'
};

test('builds a private share link that redirects to the authenticated portal', () => {
    assert.equal(
        buildPortalSharePath(record),
        '/api/share/portal/%23ATOS-1892?token=token-seguro&v=layout-cliente.png&pv=2'
    );
    assert.equal(
        buildPortalDirectPath(record),
        '/portal/%23ATOS-1892?token=token-seguro'
    );

    const html = buildPortalShareHtml(record);
    assert.match(html, /property="og:image"/);
    assert.match(html, /property="og:title" content="Colégio Central • #ATOS-1892"/);
    assert.match(html, /property="og:description" content="Atos Fardamentos • Acompanhe seu pedido/);
    assert.match(html, /og:image:width" content="1200"/);
    assert.match(html, /http-equiv="refresh"/);
    assert.match(html, /class="portal-loader" role="status"/);
    assert.match(html, /Preparando seu portal/);
    assert.match(html, /window\.location\.replace/);
});

test('registers the protected share page and image routes', () => {
    const ordersRouter = require('../routes/orders');
    const routePaths = ordersRouter.stack.map((layer) => layer.route?.path).filter(Boolean);

    assert.ok(routePaths.includes('/share/portal/:code'));
    assert.ok(routePaths.includes('/share/portal/:code/image'));
});

test('creates a WhatsApp preview image with the expected dimensions', async () => {
    const logoPath = path.resolve(__dirname, '..', '..', 'client', 'public', 'logo.png');
    const image = await createPortalPreviewImage('layout.png', {
        layoutFilePath: logoPath,
        logoFilePath: logoPath
    });
    const metadata = await sharp(image).metadata();

    assert.equal(metadata.format, 'jpeg');
    assert.equal(metadata.width, 1200);
    assert.equal(metadata.height, 630);
});
