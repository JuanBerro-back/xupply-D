import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Inyecta canonical + og:url/og:image cuando se conoce la URL pública
 * (VITE_SITE_URL). Si no se define, no añade nada: así no "canonicalizamos"
 * un despliegue (Capacitor, preview local, dominio propio) hacia otro dominio.
 */
function seoPlugin(siteUrl?: string): Plugin {
  return {
    name: 'xupply-seo',
    transformIndexHtml(html) {
      if (!siteUrl) return html;
      const tags = [
        `<link rel="canonical" href="${siteUrl}" />`,
        `<meta property="og:url" content="${siteUrl}" />`,
        `<meta property="og:image" content="${siteUrl}icon-512.png" />`,
        `<meta name="twitter:image" content="${siteUrl}icon-512.png" />`,
      ].join('\n    ');
      return html.replace('</head>', `    ${tags}\n  </head>`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_BACKEND_TARGET || 'http://127.0.0.1:4000';
  const base = env.VITE_BASE || './';
  const siteUrl = env.VITE_SITE_URL ? env.VITE_SITE_URL.replace(/\/?$/, '/') : undefined;

  return {
    base,
    plugins: [react(), seoPlugin(siteUrl)],
    build: {
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          // Separa librerías pesadas para mejorar el cacheado y el arranque.
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            maps: ['leaflet', 'react-leaflet'],
            realtime: ['socket.io-client'],
          },
        },
      },
    },
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': { target, changeOrigin: true },
        '/download': { target, changeOrigin: true },
        '/socket.io': { target, ws: true },
      },
    },
  };
});
