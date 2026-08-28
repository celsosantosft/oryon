import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const escapeHtmlAttribute = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const brandHtmlPlugin = (env) => {
  const brandName = env.VITE_APP_BRAND_NAME || 'Atos Fardamentos';
  const logoUrl = env.VITE_APP_LOGO_URL || '/logo.png';
  const logoSmallUrl = env.VITE_APP_LOGO_SMALL_URL || '/logo-120.png';
  const logoMediumUrl = env.VITE_APP_LOGO_MEDIUM_URL || '/logo-240.png';
  const replacements = {
    '__APP_BRAND_NAME__': escapeHtmlAttribute(brandName),
    '__APP_DESCRIPTION__': escapeHtmlAttribute(`${brandName}: sistema para gestao de pedidos, producao, financas e portal de acompanhamento do cliente.`),
    '__APP_LOGO_URL__': escapeHtmlAttribute(logoUrl),
    '__APP_LOGO_SMALL_URL__': escapeHtmlAttribute(logoSmallUrl),
    '__APP_LOGO_MEDIUM_URL__': escapeHtmlAttribute(logoMediumUrl),
  };

  return {
    name: 'brand-html-config',
    transformIndexHtml(html) {
      return Object.entries(replacements).reduce(
        (result, [token, value]) => result.replaceAll(token, value),
        html,
      );
    },
  };
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', '');

  return {
    plugins: [react(), brandHtmlPlugin(env)],
    envDir: '..',
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
      },
    },
    base: '/',
  };
});
