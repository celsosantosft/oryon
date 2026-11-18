const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { appConfig } = require('../config/appConfig');
const { appPaths } = require('../config/paths');

const PREVIEW_WIDTH = 1200;
const PREVIEW_HEIGHT = 630;
const RASTER_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildPortalDirectPath(record) {
    return `/portal/${encodeURIComponent(record.tracking_code)}?token=${encodeURIComponent(record.portal_token || '')}`;
}

function buildPortalSharePath(record) {
    const params = new URLSearchParams({ token: record.portal_token || '' });
    if (record.layout_path) params.set('v', path.basename(record.layout_path));
    return `/api/share/portal/${encodeURIComponent(record.tracking_code)}?${params.toString()}`;
}

function buildPortalPreviewImagePath(record) {
    const params = new URLSearchParams({ token: record.portal_token || '' });
    if (record.layout_path) params.set('v', path.basename(record.layout_path));
    return `/api/share/portal/${encodeURIComponent(record.tracking_code)}/image?${params.toString()}`;
}

function absoluteAppUrl(relativePath) {
    return new URL(relativePath, `${appConfig.publicAppUrl}/`).toString();
}

function buildPortalShareHtml(record) {
    const directUrl = absoluteAppUrl(buildPortalDirectPath(record));
    const shareUrl = absoluteAppUrl(buildPortalSharePath(record));
    const imageUrl = absoluteAppUrl(buildPortalPreviewImagePath(record));
    const title = `${appConfig.brandName} • ${record.tracking_code}`;
    const description = 'Acompanhe seu pedido e confira o layout pelo Portal do Cliente.';
    const accentColor = appConfig.tenantKey === 'pd' ? '#111827' : '#2563eb';
    const directUrlJson = JSON.stringify(directUrl).replace(/</g, '\\u003c');

    return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${escapeHtml(appConfig.brandName)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(shareUrl)}">
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="${PREVIEW_WIDTH}">
  <meta property="og:image:height" content="${PREVIEW_HEIGHT}">
  <meta property="og:image:alt" content="Layout do pedido com a marca ${escapeHtml(appConfig.brandName)}">
  <meta http-equiv="refresh" content="0;url=${escapeHtml(directUrl)}">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; min-height: 100dvh; display: grid; place-items: center; padding: 20px; background: #f8fafc; color: #0f172a; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .portal-loader { display: flex; flex-direction: column; align-items: center; text-align: center; }
    .portal-spinner { width: 36px; height: 36px; margin-bottom: 16px; border: 3px solid ${accentColor}26; border-top-color: ${accentColor}; border-radius: 50%; animation: portal-spin .8s linear infinite; }
    h1 { margin: 0 0 6px; font-size: 1.1rem; line-height: 1.35; font-weight: 800; letter-spacing: .02em; }
    p { margin: 0; color: #64748b; font-size: .85rem; font-weight: 500; }
    a { margin-top: 18px; color: ${accentColor}; font-size: .8rem; font-weight: 700; }
    @keyframes portal-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .portal-spinner { animation: none; } }
  </style>
</head>
<body>
  <main class="portal-loader" role="status" aria-live="polite">
    <div class="portal-spinner" aria-hidden="true"></div>
    <h1>Preparando seu portal...</h1>
    <p>Buscando as informações do pedido</p>
    <a href="${escapeHtml(directUrl)}">Continuar agora</a>
  </main>
  <script>window.location.replace(${directUrlJson});</script>
</body>
</html>`;
}

function firstExistingFile(candidates) {
    return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || null;
}

function resolveBrandLogoPath() {
    const configuredUrl = String(process.env.VITE_APP_LOGO_URL || '/logo.png').split('?')[0];
    const relativeUrl = configuredUrl.replace(/^\/+/, '');
    const candidates = [];

    if (relativeUrl.startsWith('branding/')) {
        candidates.push(path.join(appPaths.dataDir, relativeUrl));
    }

    candidates.push(
        path.resolve(appPaths.serverRoot, '..', 'client', 'dist', relativeUrl),
        path.resolve(appPaths.serverRoot, '..', 'client', 'public', path.basename(relativeUrl))
    );

    return firstExistingFile(candidates);
}

function resolveLayoutPath(layoutPath) {
    const filename = path.basename(String(layoutPath || ''));
    if (!filename || filename !== String(layoutPath || '')) return null;
    if (!RASTER_EXTENSIONS.has(path.extname(filename).toLowerCase())) return null;
    return firstExistingFile([path.join(appPaths.uploadsDir, filename)]);
}

async function createPortalPreviewImage(layoutPath, options = {}) {
    const layoutFile = options.layoutFilePath || resolveLayoutPath(layoutPath);
    const logoFile = options.logoFilePath || resolveBrandLogoPath();
    let hasLayout = Boolean(layoutFile);
    let baseImage;

    if (layoutFile) {
        try {
            baseImage = await sharp(layoutFile)
                .rotate()
                .resize(PREVIEW_WIDTH, PREVIEW_HEIGHT, { fit: 'contain', background: '#f8fafc' })
                .flatten({ background: '#f8fafc' })
                .png()
                .toBuffer();
        } catch {
            hasLayout = false;
        }
    }

    if (!hasLayout) {
        baseImage = await sharp({
            create: { width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, channels: 3, background: '#0f172a' }
        }).png().toBuffer();
    }

    if (!logoFile) {
        return sharp(baseImage).jpeg({ quality: 86, progressive: true }).toBuffer();
    }

    const logoBounds = hasLayout ? { width: 112, height: 60 } : { width: 320, height: 220 };
    const logo = await sharp(logoFile)
        .resize({ ...logoBounds, fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();
    const logoMetadata = await sharp(logo).metadata();

    if (!hasLayout) {
        return sharp(baseImage)
            .composite([{
                input: logo,
                left: Math.round((PREVIEW_WIDTH - logoMetadata.width) / 2),
                top: Math.round((PREVIEW_HEIGHT - logoMetadata.height) / 2)
            }])
            .jpeg({ quality: 86, progressive: true })
            .toBuffer();
    }

    const badgeWidth = 152;
    const badgeHeight = 88;
    const badgeLeft = PREVIEW_WIDTH - badgeWidth - 22;
    const badgeTop = PREVIEW_HEIGHT - badgeHeight - 22;
    const badge = Buffer.from(`<svg width="${badgeWidth}" height="${badgeHeight}" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="${badgeWidth - 2}" height="${badgeHeight - 2}" rx="14" fill="white" fill-opacity="0.94" stroke="#cbd5e1" stroke-width="2"/></svg>`);

    return sharp(baseImage)
        .composite([
            { input: badge, left: badgeLeft, top: badgeTop },
            {
                input: logo,
                left: badgeLeft + Math.round((badgeWidth - logoMetadata.width) / 2),
                top: badgeTop + Math.round((badgeHeight - logoMetadata.height) / 2)
            }
        ])
        .jpeg({ quality: 86, progressive: true })
        .toBuffer();
}

module.exports = {
    PREVIEW_HEIGHT,
    PREVIEW_WIDTH,
    buildPortalDirectPath,
    buildPortalPreviewImagePath,
    buildPortalShareHtml,
    buildPortalSharePath,
    createPortalPreviewImage,
    resolveBrandLogoPath,
    resolveLayoutPath
};
