import { useEffect, useMemo, useState } from 'react';
import { useNav } from '../lib/nav';
import { fetchWeek } from '../lib/espn';
import { pct } from '../lib/process';
import type { ESPNLeague, ESPNRosterEntry, ProcessedData } from '../lib/types';

interface Props {
  ownerId: string;
  leagueData: Record<number, ESPNLeague>;
  processed: ProcessedData;
}

// ESPN lineup slot IDs → friendly labels
const SLOT_LABEL: Record<number, string> = {
  0: 'QB',
  1: 'TQB',
  2: 'RB',
  3: 'RB/WR',
  4: 'WR',
  5: 'WR/TE',
  6: 'TE',
  7: 'OP',
  8: 'DT',
  9: 'DE',
  10: 'LB',
  11: 'DL',
  12: 'CB',
  13: 'S',
  14: 'DB',
  15: 'DP',
  16: 'D/ST',
  17: 'K',
  18: 'P',
  19: 'HC',
  20: 'BE',
  21: 'IR',
  23: 'FLEX',
  24: 'ER',
};
const BENCH_SLOTS = new Set([20, 21]);

interface WeekRow {
  week: number;
  opponentTeam: string;
  opponentOwner: string;
  for: number;
  against: number;
  isPlayoff: boolean;
  entries: ESPNRosterEntry[];
}

function pointsFor(entry: ESPNRosterEntry, week: number): number {
  const stat = entry.playerPoolEntry?.player?.stats?.find(
    (s) => s.statSourceId === 0 && s.scoringPeriodId === week,
  );
  return stat?.appliedTotal ?? 0;
}

function playerName(e: ESPNRosterEntry): string {
  return e.playerPoolEntry?.player?.fullName ?? `Player ${e.playerId}`;
}

export default function ManagerDetail({ ownerId, leagueData, processed }: Props) {
  const { goTo } = useNav();
  const mgr = processed.managers[ownerId];
  const avail = (mgr?.seasonsActive ?? []).slice().sort((a, b) => b - a);
  const [season, setSeason] = useState<number | null>(avail[0] ?? null);
  const [weekData, setWeekData] = useState<Record<number, ESPNLeague>>({});
  const [loadingLineups, setLoadingLineups] = useState(false);

  // Build the schedule rows from the bulk season payload (no lineups yet)
  const scheduleRows = useMemo<WeekRow[]>(() => {
    if (!season) return [];
    const data = leagueData[season];
    if (!data) return [];
    const teamForOwner = (data.teams ?? []).find((t) => t.owners?.[0] === ownerId);
    const teamId = teamForOwner?.id;
    if (teamId == null) return [];
    const teamNameById = new Map<number, string>();
    const ownerByTeamId = new Map<number, string>();
    for (const t of data.teams ?? []) {
      teamNameById.set(t.id, `${t.name ?? ''}`.trim() || `Team ${t.id}`);
      ownerByTeamId.set(t.id, t.owners?.[0] ?? '');
    }
    const out: WeekRow[] = [];
    for (const g of data.schedule ?? []) {
      const reg = data.settings?.scheduleSettings?.matchupPeriodCount ?? 13;
      const after = g.matchupPeriodId > reg;
      const tier = g.playoffTierType ?? 'NONE';
      if (after && tier !== 'WINNERS_BRACKET' && tier !== 'NONE') continue;

      let mine = null as typeof g.home | null;
      let opp = null as typeof g.home | null;
      if (g.home?.teamId === teamId) {
        mine = g.home;
        opp = g.away ?? null;
      } else if (g.away?.teamId === teamId) {
        mine = g.away;
        opp = g.home ?? null;
      }
      if (!mine || !opp) continue;
      if (mine.totalPoints === undefined || opp.totalPoints === undefined) continue;
      if (mine.totalPoints === 0 && opp.totalPoints === 0) continue;
      out.push({
        week: g.matchupPeriodId,
        opponentTeam: teamNameById.get(opp.teamId) ?? `Team ${opp.teamId}`,
        opponentOwner: ownerByTeamId.get(opp.teamId) ?? '',
        for: mine.totalPoints,
        against: opp.totalPoints,
        isPlayoff: after,
        entries: [],
      });
    }
    return out.sort((a, b) => a.week - b.week);
  }, [season, ownerId, leagueData]);

  // Fetch per-week lineups for the active season in parallel (cached in localStorage)
  useEffect(() => {
    if (!season || scheduleRows.length === 0) return;
    let cancelled = false;
    setLoadingLineups(true);
    (async () => {
      const newWeekData: Record<number, ESPNLeague> = {};
      const promises = scheduleRows.map(async (r) => {
        try {
          const d = await fetchWeek(season, r.week);
          newWeekData[r.week] = d;
        } catch (e) {
          console.warn(`Failed week ${season}/${r.week}:`, e);
        }
      });
      await Promise.all(promises);
      if (!cancelled) {
        setWeekData(newWeekData);
        setLoadingLineups(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [season, scheduleRows]);

  // Resolve this owner's teamId for the season once
  const teamId = useMemo(() => {
    if (!season) return null;
    const t = (leagueData[season]?.teams ?? []).find((t) => t.owners?.[0] === ownerId);
    return t?.id ?? null;
  }, [season, ownerId, leagueData]);

  // Merge lineup entries into the schedule rows
  const weeks = useMemo<WeekRow[]>(() => {
    if (teamId == null) return scheduleRows;
    return scheduleRows.map((row) => {
      const wd = weekData[row.week];
      if (!wd) return row;
      const game = (wd.schedule ?? []).find(
        (g) =>
          g.matchupPeriodId === row.week &&
          (g.home?.teamId === teamId || g.away?.teamId === teamId),
      );
      const side = game?.home?.teamId === teamId ? game.home : game?.away;
      return { ...row, entries: side?.rosterForCurrentScoringPeriod?.entries ?? [] };
    });
  }, [scheduleRows, weekData, teamId]);

  // Season-long player totals (while rostered)
  const seasonPlayerTotals = useMemo(() => {
    const map = new Map<number, { name: string; total: number; weeksRostered: number; weeksStarted: number }>();
    for (const w of weeks) {
      for (const e of w.entries) {
        const p = e.playerPoolEntry?.player;
        if (!p) continue;
        const id = p.id;
        const cur = map.get(id) ?? { name: p.fullName ?? `Player ${id}`, total: 0, weeksRostered: 0, weeksStarted: 0 };
        cur.weeksRostered++;
        if (!BENCH_SLOTS.has(e.lineupSlotId)) cur.weeksStarted++;
        cur.total += pointsFor(e, w.week);
        map.set(id, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [weeks]);

  if (!mgr) {
    return (
      <div>
        <button className="retry-btn" onClick={() => goTo({ kind: 'tab', id: 'overview' })}>
          ← Back
        </button>
        <p style={{ marginTop: '1rem' }}>Manager not found.</p>
      </div>
    );
  }

  const recordLine = `${mgr.wins}-${mgr.losses}${mgr.ties ? `-${mgr.ties}` : ''} (${pct(mgr.wins, mgr.losses, mgr.ties)} win rate)`;

  return (
    <>
      <button
        className="retry-btn"
        style={{ marginBottom: '1rem' }}
        onClick={() => history.length > 1 ? history.back() : goTo({ kind: 'tab', id: 'overview' })}
      >
        ← Back
      </button>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">Manager</div>
          <div className="val" style={{ fontSize: '1.4rem' }}>{mgr.name}</div>
          <div className="sub">{recordLine}</div>
        </div>
        <div className="stat-card">
          <div className="label">Seasons</div>
          <div className="val">{mgr.seasons}</div>
          <div className="sub">{mgr.seasonsActive.slice().sort().join(', ')}</div>
        </div>
        <div className="stat-card">
          <div className="label">Titles</div>
          <div className="val">{mgr.championships}</div>
          <div className="sub">Playoffs: {mgr.playoffApps}/{mgr.seasons}</div>
        </div>
        <div className="stat-card">
          <div className="label">Avg Pts/Wk</div>
          <div className="val">{mgr.weekCount ? (mgr.totalPts / mgr.weekCount).toFixed(1) : '—'}</div>
          <div className="sub">{mgr.weekCount} scoring weeks</div>
        </div>
      </div>

      {mgr.teamNames.length > 0 && (
        <div style={{ marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
          <strong style={{ color: 'var(--text)' }}>Team names used:</strong> {mgr.teamNames.join(' · ')}
        </div>
      )}

      <div className="season-tabs">
        {avail.map((y) => (
          <button
            key={y}
            className={`season-tab ${y === season ? 'active' : ''}`}
            onClick={() => setSeason(y)}
          >
            {y}
          </button>
        ))}
      </div>

      {season && weeks.length === 0 && (
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
          No roster-level data available for {season}.
          {mgr.ownerId !== (leagueData[season]?.teams ?? []).find((t) => t.owners?.[0] === mgr.ownerId)?.owners?.[0] && (
            <span> (This may be an aliased account that didn't directly own a team this year.)</span>
          )}
        </p>
      )}

      {weeks.length > 0 && (
        <>
          <div className="section-head">Weekly Results — {season}</div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Wk</th>
                  <th>Opponent</th>
                  <th>Result</th>
                  <th>Score</th>
                  <th>vs</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => {
                  const won = w.for > w.against;
                  const tie = w.for === w.against;
                  return (
                    <tr key={w.week}>
                      <td>Wk {w.week}</td>
                      <td>{w.opponentTeam}</td>
                      <td>
                        <span className={`badge ${won ? 'badge-green' : tie ? 'badge-dim' : 'badge-red'}`}>
                          {won ? 'W' : tie ? 'T' : 'L'}
                        </span>
                      </td>
                      <td className={`mono ${won ? 'positive' : 'negative'}`}>{w.for.toFixed(2)}</td>
                      <td className="mono">{w.against.toFixed(2)}</td>
                      <td>
                        <span className={`badge ${w.isPlayoff ? 'badge-blue' : 'badge-dim'}`}>
                          {w.isPlayoff ? 'Playoff' : 'Regular'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="section-head">Season Player Totals</div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
            Points each player put up while on this roster in {season}.
          </p>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Wks Started</th>
                  <th>Wks Rostered</th>
                  <th>Total Pts</th>
                  <th>Avg/Wk Rostered</th>
                </tr>
              </thead>
              <tbody>
                {seasonPlayerTotals.map((p, i) => (
                  <tr key={i}>
                    <td><strong>{p.name}</strong></td>
                    <td className="mono">{p.weeksStarted}</td>
                    <td className="mono">{p.weeksRostered}</td>
                    <td className="mono positive">{p.total.toFixed(2)}</td>
                    <td className="mono">{p.weeksRostered ? (p.total / p.weeksRostered).toFixed(2) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="section-head">
            Weekly Lineups
            {loadingLineups && (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dimmer)', marginLeft: 10, fontFamily: 'DM Mono, monospace' }}>
                loading rosters…
              </span>
            )}
          </div>
          {weeks.map((w) => (
            <div key={w.week} className="chart-card" style={{ padding: '1rem 1.25rem' }}>
              <div className="chart-title" style={{ marginBottom: '0.6rem' }}>
                Wk {w.week} — vs {w.opponentTeam} · {w.for.toFixed(2)}–{w.against.toFixed(2)}
              </div>
              <table style={{ fontSize: '0.78rem' }}>
                <thead>
                  <tr><th style={{ padding: '4px 8px' }}>Slot</th><th style={{ padding: '4px 8px' }}>Player</th><th style={{ padding: '4px 8px' }}>Pts</th></tr>
                </thead>
                <tbody>
                  {w.entries
                    .slice()
                    .sort((a, b) => a.lineupSlotId - b.lineupSlotId)
                    .map((e, i) => {
                      const pts = pointsFor(e, w.week);
                      const bench = BENCH_SLOTS.has(e.lineupSlotId);
                      return (
                        <tr key={i}>
                          <td style={{ padding: '3px 8px' }}>
                            <span className={`badge ${bench ? 'badge-dim' : 'badge-gold'}`}>
                              {SLOT_LABEL[e.lineupSlotId] ?? `S${e.lineupSlotId}`}
                            </span>
                          </td>
                          <td style={{ padding: '3px 8px', color: bench ? 'var(--text-dim)' : 'var(--text)' }}>
                            {playerName(e)}
                          </td>
                          <td className={`mono ${bench ? '' : 'positive'}`} style={{ padding: '3px 8px' }}>
                            {pts.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </>
  );
}
