import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// PWA (vite-plugin-pwa) is added in the F-9 task; this config stays minimal for now.
export default defineConfig({
  plugins: [react()],
  // Deployed under /ink-art/ on the portfolio site. Override with --base for a root deploy.
  base: './',
  server: {
    host: true,
  },
});
