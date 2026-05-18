import { useState } from 'react';
import { SEASONS } from '../lib/espn';
import { pct } from '../lib/process';
import type { ESPNLeague, ProcessedData } from '../lib/types';

interface Props {
  leagueData: Record<number, ESPNLeague>;
  processed: ProcessedData;
}

function teamName(t: { location?: string; nickname?: string }): string {
  return `${t.location ?? ''} ${t.nickname ?? ''}`.trim();
}

export default function Standings({ leagueData, processed }: Props) {
  const avail = SEASONS.filter((y) => leagueData[y]);
  const [active, setActive] = useState<number>(avail[avail.length - 1]);

  const data = leagueData[active];
  if (!data) return null;
  const teams = data.teams ?? [];
  const sorted = teams
    .map((t) => {
      const r = t.record?.overall ?? {};
      return {
        name: teamName(t),
        w: r.wins ?? 0,
        l: r.losses ?? 0,
        ti: r.ties ?? 0,
        pts: t.points ?? 0,
        pa: t.pointsAgainst ?? 0,
        rank: t.rankCalculatedFinal ?? 99,
        streak: r.streakLength
          ? `${r.streakType === 'WIN' ? 'W' : 'L'}${r.streakLength}`
          : '—',
      };
    })
    .sort((a, b) => a.rank - b.rank);

  const seasonMs = processed.matchups
    .filter((m) => m.season === active)
    .sort((a, b) => b.winnerScore - a.winnerScore);

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

      <div className="tbl-wrap" style={{ marginTop: '1rem' }}>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Team</th>
              <th>Manager</th>
              <th>W</th>
              <th>L</th>
              <th>T</th>
              <th>Win %</th>
              <th>Pts For</th>
              <th>Pts Against</th>
              <th>Streak</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => (
              <tr key={t.name}>
                <td className="rank">
                  {i === 0 ? '🏆 ' : ''}#{i + 1}
                </td>
                <td>
                  <strong>{t.name}</strong>
                </td>
                <td>—</td>
                <td className="mono positive">{t.w}</td>
                <td className="mono negative">{t.l}</td>
                <td className="mono">{t.ti}</td>
                <td className="mono">{pct(t.w, t.l, t.ti)}</td>
                <td className="mono">{t.pts.toFixed(2)}</td>
                <td className="mono">{t.pa.toFixed(2)}</td>
                <td>
                  <span
                    className={`badge ${
                      t.streak.startsWith('W') ? 'badge-green' : 'badge-red'
                    }`}
                  >
                    {t.streak}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-head" style={{ marginTop: '2rem' }}>
        Weekly High Scores
      </div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Week</th>
              <th>Manager</th>
              <th>Score</th>
              <th>Opponent</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {seasonMs.slice(0, 15).map((m, i) => (
              <tr key={i}>
                <td>Wk {m.week}</td>
                <td>{m.homeScore >= m.awayScore ? m.homeTeam : m.awayTeam}</td>
                <td className="mono positive">
                  {Math.max(m.homeScore, m.awayScore).toFixed(2)}
                </td>
                <td className="negative">
                  {m.homeScore < m.awayScore ? m.homeTeam : m.awayTeam}
                </td>
                <td>
                  <span className={`badge ${m.isPlayoff ? 'badge-blue' : 'badge-dim'}`}>
                    {m.isPlayoff ? 'Playoff' : 'Regular'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
