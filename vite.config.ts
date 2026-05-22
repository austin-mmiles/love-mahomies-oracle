import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Dev-only middleware that mirrors api/chat.ts so /api/chat works in
// `npm run dev` without needing `vercel dev` running on :3000.
function chatDevPlugin(geminiKey: string | undefined): Plugin {
  return {
    name: 'gridiron-oracle-chat-dev',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end(JSON.stringify({ error: 'Method not allowed' }));
        }
        if (!geminiKey) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: 'GEMINI_API_KEY is not configured' }));
        }
        let raw = '';
        for await (const chunk of req) raw += chunk;
        let body: { system?: string; messages?: { role: string; content: string }[]; max_tokens?: number } = {};
        try { body = JSON.parse(raw); } catch { /* keep defaults */ }
        if (!body.messages?.length) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'messages required' }));
        }
        const contents = body.messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));
        try {
          const upstream = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                system_instruction: body.system ? { parts: [{ text: body.system }] } : undefined,
                contents,
                generationConfig: { maxOutputTokens: body.max_tokens ?? 1000, temperature: 0.7 },
              }),
            },
          );
          const data = await upstream.json();
          res.statusCode = upstream.status;
          res.setHeader('Content-Type', 'application/json');
          if (!upstream.ok) {
            return res.end(JSON.stringify({ error: data?.error?.message ?? `Gemini ${upstream.status}` }));
          }
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          res.end(JSON.stringify({ content: [{ type: 'text', text }] }));
        } catch (e) {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }));
        }
      });
    },
  };
}

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
    plugins: [react(), chatDevPlugin(env.GEMINI_API_KEY)],
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
