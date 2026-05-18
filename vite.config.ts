import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      // In dev, proxy /api to Vercel dev server (run `vercel dev` on :3000) if you use it,
      // or to a local ESPN passthrough. For now, dev hits ESPN directly via the public endpoint.
      '/api': 'http://localhost:3000',
    },
  },
});
