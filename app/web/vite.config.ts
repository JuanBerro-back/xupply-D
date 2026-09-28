import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const target = process.env.VITE_BACKEND_TARGET || 'http://127.0.0.1:4000';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': { target, changeOrigin: true },
      '/download': { target, changeOrigin: true },
      '/socket.io': { target, ws: true },
    },
  },
});