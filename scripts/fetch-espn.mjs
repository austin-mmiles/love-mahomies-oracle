#!/usr/bin/env node
// Pulls every ESPN payload the frontend needs and writes JSON snapshots
// to public/data/. Run via `npm run fetch-data` locally, or by the
// scheduled GitHub Action. Reads ESPN_SWID + ESPN_S2 from env when present
// so private/locked seasons (e.g. the current year) come through.

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'data');

const LEAGUE_ID = 97124817;
const SEASONS = [2020, 2021, 2022, 2023, 2024, 2025];
const BASE = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons';

const SEASON_VIEWS = ['mTeam', 'mSettings', 'mMatchup', 'mMatchupScore', 'mRoster', 'mStandings'];
const WEEK_VIEWS = ['mBoxscore', 'mMatchup', 'mTeam', 'mRoster'];

const cookieHeader = (() => {
  const swid = process.env.ESPN_SWID;
  const s2 = process.env.ESPN_S2;
  return swid && s2 ? `SWID=${swid}; espn_s2=${s2}` : null;
})();

async function fetchJson(url) {
  const headers = { Accept: 'application/json' };
  if (cookieHeader) headers.Cookie = cookieHeader;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${url}\n${body.slice(0, 200)}`);
  }
  return res.json();
}

function seasonUrl(year) {
  return `${BASE}/${year}/segments/0/leagues/${LEAGUE_ID}?${SEASON_VIEWS.map((v) => `view=${v}`).join('&')}`;
}

function weekUrl(year, week) {
  return `${BASE}/${year}/segments/0/leagues/${LEAGUE_ID}?${WEEK_VIEWS.map((v) => `view=${v}`).join('&')}&scoringPeriodId=${week}`;
}

function writeJson(relPath, data) {
  const full = join(OUT_DIR, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, JSON.stringify(data));
}

// Strip a weekly boxscore down to just the fields the frontend reads.
// The raw payload includes the entire league's player history per week
// and runs ~2MB per file. Slimming cuts each to ~50-100KB.
function slimWeek(raw, week) {
  return {
    id: raw.id,
    seasonId: raw.seasonId,
    settings: { scheduleSettings: raw.settings?.scheduleSettings },
    schedule: (raw.schedule ?? [])
      .filter((g) => g.matchupPeriodId === week)
      .map((g) => ({
        matchupPeriodId: g.matchupPeriodId,
        playoffTierType: g.playoffTierType,
        winner: g.winner,
        home: slimSide(g.home, week),
        away: slimSide(g.away, week),
      })),
  };
}

function slimSide(side, week) {
  if (!side) return undefined;
  return {
    teamId: side.teamId,
    totalPoints: side.totalPoints,
    rosterForCurrentScoringPeriod: side.rosterForCurrentScoringPeriod
      ? {
          entries: (side.rosterForCurrentScoringPeriod.entries ?? []).map((e) => {
            const p = e.playerPoolEntry?.player;
            const thisWeekStat = p?.stats?.find(
              (s) => s.statSourceId === 0 && s.scoringPeriodId === week,
            );
            return {
              playerId: e.playerId,
              lineupSlotId: e.lineupSlotId,
              playerPoolEntry: p
                ? {
                    player: {
                      id: p.id,
                      fullName: p.fullName,
                      defaultPositionId: p.defaultPositionId,
                      stats: thisWeekStat
                        ? [
                            {
                              scoringPeriodId: thisWeekStat.scoringPeriodId,
                              statSourceId: thisWeekStat.statSourceId,
                              appliedTotal: thisWeekStat.appliedTotal,
                            },
                          ]
                        : [],
                    },
                  }
                : undefined,
            };
          }),
        }
      : undefined,
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const manifest = { fetchedAt: new Date().toISOString(), seasons: [], weeksByYear: {} };

  for (const year of SEASONS) {
    process.stdout.write(`[${year}] season... `);
    let season;
    try {
      season = await fetchJson(seasonUrl(year));
    } catch (e) {
      console.log(`SKIP (${e.message.split('\n')[0]})`);
      continue;
    }
    writeJson(`${year}.json`, season);
    manifest.seasons.push(year);

    // Pull every week of historical lineups too. matchupPeriodCount +
    // playoff weeks (usually 3-4 more). We probe up through week 18.
    const regWks = season.settings?.scheduleSettings?.matchupPeriodCount ?? 13;
    const maxWk = regWks + 4;
    const weeksThisYear = [];
    for (let week = 1; week <= maxWk; week++) {
      process.stdout.write(`w${week} `);
      try {
        const wk = await fetchJson(weekUrl(year, week));
        // Skip weeks where no team played (totalPoints all 0)
        const anyPlayed = (wk.schedule ?? []).some((g) => {
          const h = g.home?.totalPoints ?? 0;
          const a = g.away?.totalPoints ?? 0;
          return g.matchupPeriodId === week && (h > 0 || a > 0);
        });
        if (!anyPlayed) {
          process.stdout.write('(empty) ');
          continue;
        }
        writeJson(`${year}/week-${week}.json`, slimWeek(wk, week));
        weeksThisYear.push(week);
      } catch (e) {
        process.stdout.write(`ERR(${e.message.split(' ')[1] ?? 'x'}) `);
      }
    }
    manifest.weeksByYear[year] = weeksThisYear;
    console.log('done');
  }

  writeJson('manifest.json', manifest);
  console.log(`\nWrote ${manifest.seasons.length} seasons + ${Object.values(manifest.weeksByYear).flat().length} week files`);
  console.log(`Output: ${OUT_DIR}`);
  if (manifest.seasons.length === 0) {
    console.error('No seasons fetched. Check ESPN_SWID / ESPN_S2 env vars.');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
