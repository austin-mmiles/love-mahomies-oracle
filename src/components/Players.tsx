import { useMemo, useState } from 'react';
import { SEASONS } from '../lib/espn';
import type { ESPNLeague } from '../lib/types';

interface Props {
  leagueData: Record<number, ESPNLeague>;
}

interface WeeklyPerf {
  playerId: number;
  player: string;
  manager: string;
  season: number;
  week: number;
  points: number;
  started: boolean;
}

const BENCH_SLOTS = new Set([20, 21]); // 20=bench, 21=IR (ESPN slot IDs)

function teamName(t: { location?: string; nickname?: string } | undefined, id: number): string {
  if (!t) return `Team ${id}`;
  return `${t.location ?? ''} ${t.nickname ?? ''}`.trim() || `Team ${id}`;
}

function extractPerformances(leagueData: Record<number, ESPNLeague>): WeeklyPerf[] {
  const perfs: WeeklyPerf[] = [];
  for (const yearStr of Object.keys(leagueData)) {
    const year = Number(yearStr);
    const data = leagueData[year];
    const teams = data?.teams ?? [];
    const nameById = new Map<number, string>();
    for (const t of teams) nameById.set(t.id, teamName(t, t.id));

    for (const game of data?.schedule ?? []) {
      const week = game.matchupPeriodId;
      for (const side of [game.home, game.away]) {
        if (!side) continue;
        const mgr = nameById.get(side.teamId) ?? `Team ${side.teamId}`;
        const entries = side.rosterForCurrentScoringPeriod?.entries ?? [];
        for (const e of entries) {
          const player = e.playerPoolEntry?.player;
          if (!player) continue;
          // Find the actual (statSourceId=0) weekly stat for this scoring period
          const stat = player.stats?.find(
            (s) => s.statSourceId === 0 && s.scoringPeriodId === week,
          );
          if (!stat || stat.appliedTotal === undefined) continue;
          perfs.push({
            playerId: player.id,
            player: player.fullName ?? `Player ${player.id}`,
            manager: mgr,
            season: year,
            week,
            points: stat.appliedTotal,
            started: !BENCH_SLOTS.has(e.lineupSlotId),
          });
        }
      }
    }
  }
  return perfs;
}

export default function Players({ leagueData }: Props) {
  const [season, setSeason] = useState<string>('all');
  const [onlyStarters, setOnlyStarters] = useState(true);

  const perfs = useMemo(() => extractPerformances(leagueData), [leagueData]);

  if (perfs.length === 0) {
    return (
      <>
        <div className="section-head">Player Stats</div>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
          No player-level data found in the cached ESPN payload. This can happen if the
          mRoster view wasn't returned for these seasons. Try clearing your local cache and
          reloading.
        </p>
      </>
    );
  }

  const filtered = perfs.filter(
    (p) => (season === 'all' || p.season === Number(season)) && (!onlyStarters || p.started),
  );

  const topWeekly = [...filtered].sort((a, b) => b.points - a.points).slice(0, 25);

  // Aggregate per-player season totals
  const seasonTotals = new Map<string, { player: string; manager: string; season: number; total: number; weeks: number }>();
  for (const p of filtered) {
    const key = `${p.playerId}|${p.season}`;
    const cur = seasonTotals.get(key);
    if (cur) {
      cur.total += p.points;
      cur.weeks++;
    } else {
      seasonTotals.set(key, { player: p.player, manager: p.manager, season: p.season, total: p.points, weeks: 1 });
    }
  }
  const topSeason = [...seasonTotals.values()].sort((a, b) => b.total - a.total).slice(0, 25);

  // Manager → unique player-seasons rostered (a rough "talent acquired" stat)
  const mgrPlayers = new Map<string, Set<string>>();
  for (const p of filtered) {
    if (!mgrPlayers.has(p.manager)) mgrPlayers.set(p.manager, new Set());
    mgrPlayers.get(p.manager)!.add(`${p.playerId}|${p.season}`);
  }
  const mgrSummary = [...mgrPlayers.entries()]
    .map(([manager, set]) => ({ manager, uniquePlayers: set.size }))
    .sort((a, b) => b.uniquePlayers - a.uniquePlayers);

  return (
    <>
      <div className="section-head">Player Stats</div>
      <div style={{ display: 'flex', gap: 10, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={season} onChange={(e) => setSeason(e.target.value)}>
          <option value="all">All Seasons</option>
          {SEASONS.filter((y) => leagueData[y]).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={onlyStarters}
            onChange={(e) => setOnlyStarters(e.target.checked)}
          />
          Starters only
        </label>
      </div>

      <div className="section-head">Top Single-Week Performances</div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Manager</th>
              <th>Season</th>
              <th>Wk</th>
              <th>Points</th>
              <th>Slot</th>
            </tr>
          </thead>
          <tbody>
            {topWeekly.map((p, i) => (
              <tr key={i}>
                <td className="rank">#{i + 1}</td>
                <td><strong>{p.player}</strong></td>
                <td>{p.manager}</td>
                <td>{p.season}</td>
                <td>Wk {p.week}</td>
                <td className="mono positive">{p.points.toFixed(2)}</td>
                <td>
                  <span className={`badge ${p.started ? 'badge-green' : 'badge-dim'}`}>
                    {p.started ? 'Started' : 'Bench'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-head">Top Season Totals (while rostered)</div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Manager</th>
              <th>Season</th>
              <th>Wks Rostered</th>
              <th>Total Pts</th>
              <th>Avg/Wk</th>
            </tr>
          </thead>
          <tbody>
            {topSeason.map((p, i) => (
              <tr key={i}>
                <td className="rank">#{i + 1}</td>
                <td><strong>{p.player}</strong></td>
                <td>{p.manager}</td>
                <td>{p.season}</td>
                <td className="mono">{p.weeks}</td>
                <td className="mono positive">{p.total.toFixed(1)}</td>
                <td className="mono">{(p.total / p.weeks).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-head">Manager Roster Volume</div>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
        Unique player-seasons rostered (higher = more churn / waiver activity).
      </p>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Manager</th>
              <th>Unique Player-Seasons</th>
            </tr>
          </thead>
          <tbody>
            {mgrSummary.map((m) => (
              <tr key={m.manager}>
                <td><strong>{m.manager}</strong></td>
                <td className="mono">{m.uniquePlayers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
