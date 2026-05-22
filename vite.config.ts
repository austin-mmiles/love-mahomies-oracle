import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const LEAGUE_ID = 97124817;
const ESPN_HOST = 'https://lm-api-reads.fantasy.espn.com';
const VIEWS = ['mTeam', 'mSettings', 'mMatchup', 'mMatchupScore', 'mRoster', 'mStandings']
  .map((v) => `view=${v}`)
  .join('&');
const WEEK_VIEWS = ['mBoxscore', 'mMatchup', 'mTeam', 'mRoster']
  .map((v) => `view=${v}`)
  .join('&');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const swid = env.ESPN_SWID;
  const s2 = env.ESPN_S2;
  const cookie = swid && s2 ? `SWID=${swid}; espn_s2=${s2}` : null;

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
      port: 5173,
      proxy: {
        // Rewrite /api/espn/:year → ESPN's public read endpoint so dev doesn't
        // need `vercel dev` running. In prod, the same path is handled by
        // api/espn/[year].ts. If ESPN_SWID + ESPN_S2 are in .env.local we
        // also attach them as cookies so private/locked seasons work.
        '^/api/espn/[0-9]+/week/[0-9]+$': {
          target: ESPN_HOST,
          changeOrigin: true,
          secure: true,
          configure: (proxy) => {
            if (!cookie) return;
            proxy.on('proxyReq', (proxyReq) => proxyReq.setHeader('Cookie', cookie));
          },
          rewrite: (url) => {
            const m = url.match(/\/api\/espn\/(\d+)\/week\/(\d+)/);
            const [year, week] = m ? [m[1], m[2]] : ['0', '0'];
            return `/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${LEAGUE_ID}?${WEEK_VIEWS}&scoringPeriodId=${week}`;
          },
        },
        '^/api/espn/[0-9]+$': {
          target: ESPN_HOST,
          changeOrigin: true,
          secure: true,
          configure: (proxy) => {
            if (!cookie) return;
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Cookie', cookie);
            });
          },
          rewrite: (url) => {
            const year = url.split('/').pop();
            return `/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${LEAGUE_ID}?${VIEWS}`;
          },
        },
      },
    },
  };
});
