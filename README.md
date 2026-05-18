# Gridiron Oracle

A fantasy football dashboard for ESPN league `#97124817` (seasons 2020–2025).

Stack: **Vite + React + TypeScript** frontend, **Vercel serverless functions** for the ESPN proxy and Claude chat.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in ANTHROPIC_API_KEY
vercel dev                   # runs API routes on :3000
npm run dev                  # runs Vite on :5173 (proxies /api → :3000)
```

If you don't have the Vercel CLI installed: `npm i -g vercel`.

## Deploy

```bash
vercel              # first time — links the project
vercel --prod       # deploy to production
```

Then in the Vercel dashboard, set:
- `ANTHROPIC_API_KEY` (required for the AI chat tab)
- `ESPN_SWID` / `ESPN_S2` (only if the league becomes private)

## Project layout

```
api/
  espn/[year].ts   # ESPN proxy (CORS + edge caching)
  chat.ts          # Claude proxy (hides API key)
src/
  lib/             # data layer (fetch + cache + processing)
  components/      # one file per tab
  App.tsx          # shell + tab routing + load screen
```

## Cache

ESPN season payloads are cached in `localStorage` with a 24h TTL. To force a refresh:
```js
localStorage.clear()
```
The serverless proxy also sets `Cache-Control: s-maxage=3600, stale-while-revalidate=86400` so the Vercel edge cache absorbs most traffic.
