import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// When deploying to GitHub Pages at https://USER.github.io/REPO/, set
// BASE_PATH=/REPO/ at build time. The default '/' works for local dev
// and custom-domain Pages.
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
  },
});
