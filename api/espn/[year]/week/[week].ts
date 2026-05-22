import type { VercelRequest, VercelResponse } from '@vercel/node';

const LEAGUE_ID = 97124817;
const BASE = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons';

// mBoxscore + scoringPeriodId returns the actual lineup that was set for
// that specific week, including bench. Required for historical drill-ins.
const VIEWS = ['mBoxscore', 'mMatchup', 'mTeam', 'mRoster'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const yearRaw = req.query.year;
  const weekRaw = req.query.week;
  const year = Number(Array.isArray(yearRaw) ? yearRaw[0] : yearRaw);
  const week = Number(Array.isArray(weekRaw) ? weekRaw[0] : weekRaw);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return res.status(400).json({ error: 'Invalid year' });
  }
  if (!Number.isInteger(week) || week < 1 || week > 20) {
    return res.status(400).json({ error: 'Invalid week' });
  }

  const viewQs = VIEWS.map((v) => `view=${v}`).join('&');
  const url = `${BASE}/${year}/segments/0/leagues/${LEAGUE_ID}?${viewQs}&scoringPeriodId=${week}`;

  const headers: Record<string, string> = { Accept: 'application/json' };
  const swid = process.env.ESPN_SWID;
  const s2 = process.env.ESPN_S2;
  if (swid && s2) headers.Cookie = `SWID=${swid}; espn_s2=${s2}`;

  try {
    const upstream = await fetch(url, { headers });
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `ESPN responded ${upstream.status}` });
    }
    const data = await upstream.json();
    // Historical weeks never change; cache aggressively.
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return res.status(502).json({ error: `Upstream fetch failed: ${msg}` });
  }
}
