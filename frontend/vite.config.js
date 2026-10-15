import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // The live API. In dev it is proxied, so the browser sees one origin and CORS never comes up.
  const api = env.AEROFUSION_API || 'https://aerofusion-api.onrender.com';
  const proxy = { target: api, changeOrigin: true, secure: true };

  return {
    // Relative base so the build works from any sub-path (GitHub Pages, Netlify, a USB stick).
    base: './',
    // Artwork lives in /assets and is pulled in through import.meta.glob (src/core/assets.js),
    // so Vite fingerprints it and only ships files a scene can actually find.
    publicDir: false,
    plugins: [react(), tailwindcss()],
    // MapLibre 6 starts its worker from a file next to its own module; pre-bundling moves the
    // module and the worker can't be found, so serve it as published.
    optimizeDeps: { exclude: ['maplibre-gl'] },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src/app', import.meta.url)) },
    },
    build: {
      // Keep Vite's own output out of the way of the artwork folder name.
      assetsDir: '_app',
      // Never inline artwork as base64; let the browser lazy-load and cache it.
      assetsInlineLimit: 0,
      target: 'es2020',
      // Two pages: the story (index.html) and the live dashboard (app.html).
      rollupOptions: {
        input: {
          story: fileURLToPath(new URL('./index.html', import.meta.url)),
          app: fileURLToPath(new URL('./app.html', import.meta.url)),
        },
      },
    },
    server: {
      host: true,
      proxy: { '/api': proxy, '/health': proxy },
    },
    preview: { proxy: { '/api': proxy, '/health': proxy } },
  };
});
