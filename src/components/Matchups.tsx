import { useState } from 'react';
import { SEASONS } from '../lib/espn';
import type { ESPNLeague, Matchup, ProcessedData } from '../lib/types';

interface Props {
  leagueData: Record<number, ESPNLeague>;
  processed: ProcessedData;
}

export default function Matchups({ leagueData, processed }: Props) {
  const [season, setSeason] = useState<string>('all');
  const [manager, setManager] = useState<string>('all');

  const valid = processed.matchups.filter((m) => m.homeScore > 0 && m.awayScore > 0);
  const bigBlowout = valid.reduce<Matchup | { margin: 0 }>(
    (b, m) => (m.margin > (b as { margin: number }).margin ? m : b),
    { margin: 0 },
  ) as Matchup;
  const closest = valid.reduce<Matchup | { margin: number }>(
    (b, m) => (m.margin < (b as { margin: number }).margin ? m : b),
    { margin: 9999 },
  ) as Matchup;
  const highScore = valid.reduce<{ score: number; m?: Matchup }>(
    (b, m) => {
      const hi = Math.max(m.homeScore, m.awayScore);
      return hi > b.score ? { score: hi, m } : b;
    },
    { score: 0 },
  );
  const lowScore = valid
    .filter((m) => m.homeScore > 50 && m.awayScore > 50)
    .reduce<{ score: number; m?: Matchup }>(
      (b, m) => {
        const lo = Math.min(m.homeScore, m.awayScore);
        return lo < b.score ? { score: lo, m } : b;
      },
      { score: 9999 },
    );

  let filtered = [...valid];
  if (season !== 'all') filtered = filtered.filter((m) => m.season === Number(season));
  if (manager !== 'all')
    filtered = filtered.filter((m) => m.homeTeam === manager || m.awayTeam === manager);
  filtered.sort((a, b) => b.season - a.season || b.week - a.week);

  const managers = Object.keys(processed.managers).sort();

  return (
    <>
      <div className="section-head">Record Book — All-Time Extremes</div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">Biggest Blowout</div>
          <div className="val">+{bigBlowout.margin}</div>
          <div className="sub">
            {bigBlowout.winner} · {bigBlowout.season} Wk{bigBlowout.week}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Closest Game</div>
          <div className="val">+{closest.margin}</div>
          <div className="sub">
            {closest.winner} · {closest.season} Wk{closest.week}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Highest Score Ever</div>
          <div className="val">{highScore.score.toFixed(1)}</div>
          <div className="sub">
            {highScore.m
              ? `${
                  highScore.m.homeScore >= highScore.m.awayScore
                    ? highScore.m.homeTeam
                    : highScore.m.awayTeam
                } · ${highScore.m.season}`
              : ''}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Lowest Score (non-zero)</div>
          <div className="val">{lowScore.score.toFixed(1)}</div>
        </div>
      </div>

      <div className="section-head">All Matchups</div>
      <div style={{ display: 'flex', gap: 10, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select value={season} onChange={(e) => setSeason(e.target.value)}>
          <option value="all">All Seasons</option>
          {SEASONS.filter((y) => leagueData[y]).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select value={manager} onChange={(e) => setManager(e.target.value)}>
          <option value="all">All Managers</option>
          {managers.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Season</th>
              <th>Wk</th>
              <th>Winner</th>
              <th>Score</th>
              <th>Score</th>
              <th>Loser</th>
              <th>Margin</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((m, i) => (
              <tr key={i}>
                <td>{m.season}</td>
                <td>Wk{m.week}</td>
                <td className="positive">{m.winner}</td>
                <td className="mono positive">{m.winnerScore.toFixed(2)}</td>
                <td className="mono negative">{m.loserScore.toFixed(2)}</td>
                <td className="negative">{m.loser}</td>
                <td className="mono">+{m.margin}</td>
                <td>
                  <span className={`badge ${m.isPlayoff ? 'badge-blue' : 'badge-dim'}`}>
                    {m.isPlayoff ? '🏆 Playoff' : 'Regular'}
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
