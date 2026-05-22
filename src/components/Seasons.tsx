import { useState } from 'react';
import { SEASONS } from '../lib/espn';
import { pct, teamName } from '../lib/process';
import type { ESPNLeague, ProcessedData } from '../lib/types';

interface Props {
  leagueData: Record<number, ESPNLeague>;
  processed: ProcessedData;
}

export default function Seasons({ leagueData, processed }: Props) {
  const avail = SEASONS.filter((y) => leagueData[y]);
  const [active, setActive] = useState<number>(avail[avail.length - 1]);

  const data = leagueData[active];
  if (!data) return <p style={{ color: 'var(--text-dim)' }}>No data for this season</p>;

  const teams = data.teams ?? [];
  const sched = data.settings?.scheduleSettings ?? {};
  const regularWks = sched.matchupPeriodCount ?? 13;
  const seasonMatchups = processed.matchups.filter((m) => m.season === active);
  const playoffMatchups = seasonMatchups.filter((m) => m.isPlayoff);
  const allScores = seasonMatchups.flatMap((m) => [m.homeScore, m.awayScore]).filter((s) => s > 0);

  const highWeek = seasonMatchups.reduce<{ score: number; mgr?: string; week?: number }>(
    (b, m) => {
      const hi = Math.max(m.homeScore, m.awayScore);
      return hi > b.score
        ? { score: hi, mgr: hi === m.homeScore ? m.homeTeam : m.awayTeam, week: m.week }
        : b;
    },
    { score: 0 },
  );
  const biggestBlowout = seasonMatchups.reduce<{
    margin: number;
    winnerOwner?: string;
    winnerTeam?: string;
    week?: number;
  }>((b, m) => (m.margin > b.margin ? m : b), { margin: 0 });

  const standings = teams
    .map((t) => {
      const r = t.record?.overall ?? {};
      return {
        name: teamName(t, t.id),
        w: r.wins ?? 0,
        l: r.losses ?? 0,
        ti: r.ties ?? 0,
        pts: (t.points ?? 0).toFixed(2),
        pa: (t.pointsAgainst ?? 0).toFixed(2),
        rank: t.rankCalculatedFinal ?? 99,
        streak: r.streakLength
          ? `${r.streakType === 'WIN' ? 'W' : 'L'}${r.streakLength}`
          : '—',
      };
    })
    .sort((a, b) => a.rank - b.rank);

  return (
    <>
      <div className="season-tabs">
        {avail.map((y) => (
          <button
            key={y}
            className={`season-tab ${y === active ? 'active' : ''}`}
            onClick={() => setActive(y)}
          >
            {y}
          </button>
        ))}
      </div>

      <div className="stat-grid">
        <Stat label="Regular Season Wks" val={regularWks} />
        <Stat label="Total Matchups" val={seasonMatchups.length} />
        <Stat
          label="Avg Score"
          val={
            allScores.length
              ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1)
              : '—'
          }
        />
        <Stat
          label="Season High"
          val={highWeek.score.toFixed(1)}
          sub={highWeek.mgr ? `${highWeek.mgr} · Wk ${highWeek.week}` : ''}
        />
        <Stat
          label="Biggest Blowout"
          val={`+${biggestBlowout.margin}`}
          sub={
            biggestBlowout.winnerOwner
              ? `${processed.managers[biggestBlowout.winnerOwner]?.name ?? biggestBlowout.winnerTeam} · Wk ${biggestBlowout.week}`
              : '—'
          }
        />
      </div>

      <div className="section-head">Final Standings</div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Finish</th>
              <th>Team</th>
              <th>W</th>
              <th>L</th>
              <th>Win%</th>
              <th>Pts For</th>
              <th>Pts Against</th>
              <th>Streak</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((t, i) => (
              <tr key={t.name}>
                <td>
                  {i === 0 ? '🏆' : i < 4 ? '🥈' : ''}#{i + 1}
                </td>
                <td>{t.name}</td>
                <td className="positive mono">{t.w}</td>
                <td className="negative mono">{t.l}</td>
                <td className="mono">{pct(t.w, t.l, t.ti)}</td>
                <td className="mono">{t.pts}</td>
                <td className="mono">{t.pa}</td>
                <td>{t.streak}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-head">Playoff Bracket Results</div>
      {playoffMatchups.length ? (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Week</th>
                <th>Winner</th>
                <th>Score</th>
                <th>Score</th>
                <th>Loser</th>
                <th>Margin</th>
              </tr>
            </thead>
            <tbody>
              {playoffMatchups.map((m, i) => {
                const wn = processed.managers[m.winnerOwner]?.name ?? m.winnerTeam;
                const ln = processed.managers[m.loserOwner]?.name ?? m.loserTeam;
                return (
                <tr key={i}>
                  <td>Wk {m.week}</td>
                  <td className="positive" title={m.winnerTeam}>{wn}</td>
                  <td className="mono positive">{m.winnerScore.toFixed(2)}</td>
                  <td className="mono negative">{m.loserScore.toFixed(2)}</td>
                  <td className="negative" title={m.loserTeam}>{ln}</td>
                  <td className="mono">+{m.margin}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
          Playoff data not yet available for this season.
        </p>
      )}
    </>
  );
}

function Stat({ label, val, sub }: { label: string; val: string | number; sub?: string }) {
  return (
    <div className="stat-card">
      <div className="label">{label}</div>
      <div className="val">{val}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
