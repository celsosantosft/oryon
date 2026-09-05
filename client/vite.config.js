import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import themePalette from './themePalette.cjs';

const { applyThemePalette } = themePalette;

const escapeHtmlAttribute = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const brandHtmlPlugin = (env) => {
  const brandName = env.VITE_APP_BRAND_NAME || 'Atos Fardamentos';
  const theme = String(env.VITE_APP_THEME || 'default').trim().toLowerCase();
  const logoUrl = env.VITE_APP_LOGO_URL || '/logo.png';
  const logoSmallUrl = env.VITE_APP_LOGO_SMALL_URL || '/logo-120.png';
  const logoMediumUrl = env.VITE_APP_LOGO_MEDIUM_URL || '/logo-240.png';
  const replacements = {
    '__APP_BRAND_NAME__': escapeHtmlAttribute(brandName),
    '__APP_DESCRIPTION__': escapeHtmlAttribute(`${brandName}: sistema para gestao de pedidos, producao, financas e portal de acompanhamento do cliente.`),
    '__APP_LOGO_URL__': escapeHtmlAttribute(logoUrl),
    '__APP_LOGO_SMALL_URL__': escapeHtmlAttribute(logoSmallUrl),
    '__APP_LOGO_MEDIUM_URL__': escapeHtmlAttribute(logoMediumUrl),
    '__APP_THEME_DARK__': theme === 'monochrome' ? '#000000' : '#0f172a',
    '__APP_THEME_DARK_ALT__': theme === 'monochrome' ? '#0A0A0A' : '#0D1F33',
  };

  return {
    name: 'brand-html-config',
    transformIndexHtml(html) {
      const brandedHtml = Object.entries(replacements).reduce(
        (result, [token, value]) => result.replaceAll(token, value),
        html,
      );

      return applyThemePalette(brandedHtml, theme);
    },
  };
};

const brandThemePlugin = (env) => {
  const theme = String(env.VITE_APP_THEME || 'default').trim().toLowerCase();

  return {
    name: 'brand-theme-palette',
    enforce: 'post',
    transform(code, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0];
      if (!normalizedId.includes('/client/src/')) return null;

      const themedCode = applyThemePalette(code, theme);
      return themedCode === code ? null : { code: themedCode, map: null };
    },
  };
};

const brandThemePostcssPlugin = (theme) => ({
  postcssPlugin: 'brand-theme-css-palette',
  Declaration(declaration) {
    declaration.value = applyThemePalette(declaration.value, theme);
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', '');
  const theme = String(env.VITE_APP_THEME || 'default').trim().toLowerCase();

  return {
    plugins: [react(), brandThemePlugin(env), brandHtmlPlugin(env)],
    envDir: '..',
    css: {
      postcss: {
        plugins: [tailwindcss(), autoprefixer(), brandThemePostcssPlugin(theme)],
      },
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('react') || id.includes('react-router-dom')) return 'react-vendor';
            if (id.includes('recharts') || id.includes('d3-')) return 'charts-vendor';
            if (id.includes('sweetalert2')) return 'alerts-vendor';
            if (id.includes('axios') || id.includes('browser-image-compression')) return 'utils-vendor';
            return undefined;
          },
        },
      },
    },
    base: '/',
  };
});
