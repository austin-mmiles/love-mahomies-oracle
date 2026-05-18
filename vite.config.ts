import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const LEAGUE_ID = 97124817;
const ESPN_HOST = 'https://lm-api-reads.fantasy.espn.com';
const VIEWS = ['mTeam', 'mSettings', 'mMatchup', 'mMatchupScore', 'mRoster', 'mStandings']
  .map((v) => `view=${v}`)
  .join('&');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      // Rewrite /api/espn/:year → ESPN's public read endpoint so dev doesn't
      // need `vercel dev` running. In prod, the same path is handled by
      // api/espn/[year].ts.
      '^/api/espn/[0-9]+$': {
        target: ESPN_HOST,
        changeOrigin: true,
        secure: true,
        rewrite: (url) => {
          const year = url.split('/').pop();
          return `/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${LEAGUE_ID}?${VIEWS}`;
        },
      },
    },
  },
});
