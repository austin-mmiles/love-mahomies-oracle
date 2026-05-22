# Love Mahomies Oracle

A fantasy football dashboard for ESPN league `#97124817` (seasons 2020–2025).

Static site — built with Vite + React + TypeScript, deployed to **GitHub Pages**. ESPN data is fetched into JSON snapshots on a nightly schedule via GitHub Actions, so the site loads instantly and has no runtime backend.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in ESPN_SWID + ESPN_S2 if you want current-year data
npm run fetch-data           # writes public/data/*.json
npm run dev                  # http://localhost:5173
```

The data fetch takes ~30s the first time (pulls every season + every week). Re-run `fetch-data` whenever you want fresh stats locally.

## Deploy (GitHub Pages)

Already wired. Any push to `master`/`main` triggers `.github/workflows/deploy.yml` which:

1. Runs `npm run fetch-data` using `ESPN_SWID` + `ESPN_S2` from repo secrets
2. Builds the site with the correct base path
3. Publishes to GitHub Pages

**First-time setup (one-off):**

1. **Repo Settings → Pages** → Source: **GitHub Actions**
2. **Repo Settings → Secrets and variables → Actions** → add:
   - `ESPN_SWID` (with curly braces)
   - `ESPN_S2`
3. Push to `master` → workflow runs → site goes live at `https://USER.github.io/love-mahomies-oracle/`

The workflow also runs **nightly** (Aug–Feb, 10:00 UTC) so weekly results show up the morning after games.

## Project layout

```
.github/workflows/deploy.yml  # build + deploy
scripts/fetch-espn.mjs        # ESPN snapshot generator
public/data/                  # generated; gitignored
src/lib/                      # data layer
src/components/               # one file per tab
src/App.tsx                   # shell + tab routing
```

## Cache

Snapshots are also cached in `localStorage` with a 24h TTL for instant repeat visits. Force a refresh with `localStorage.clear()` in DevTools.
