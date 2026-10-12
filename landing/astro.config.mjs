import { defineConfig } from 'astro/config';
export default defineConfig({ server: { host: true }, preview: { allowedHosts: true } });
