import type { VercelRequest, VercelResponse } from '@vercel/node';

const LEAGUE_ID = 97124817;
const BASE = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons';
const VIEWS = [
  'mTeam',
  'mSettings',
  'mMatchup',
  'mMatchupScore',
  'mRoster',
  'mStandings',
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const yearRaw = req.query.year;
  const year = Number(Array.isArray(yearRaw) ? yearRaw[0] : yearRaw);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return res.status(400).json({ error: 'Invalid year' });
  }

  const url = `${BASE}/${year}/segments/0/leagues/${LEAGUE_ID}?${VIEWS.map((v) => `view=${v}`).join('&')}`;

  // Optional private-league cookies — only sent if both env vars are set.
  const headers: Record<string, string> = { Accept: 'application/json' };
  const swid = process.env.ESPN_SWID;
  const s2 = process.env.ESPN_S2;
  if (swid && s2) headers.Cookie = `SWID=${swid}; espn_s2=${s2}`;

  try {
    const upstream = await fetch(url, { headers });
    if (!upstream.ok) {
      return res
        .status(upstream.status)
        .json({ error: `ESPN responded ${upstream.status}` });
    }
    const data = await upstream.json();
    // Cache aggressively at the edge: 1h fresh, 24h stale-while-revalidate.
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return res.status(502).json({ error: `Upstream fetch failed: ${msg}` });
  }
}
