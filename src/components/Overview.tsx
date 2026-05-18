import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { SEASONS } from '../lib/espn';
import { ordinal, pct, teamName } from '../lib/process';
import type { ESPNLeague, ProcessedData } from '../lib/types';

interface Props {
  leagueData: Record<number, ESPNLeague>;
  processed: ProcessedData;
}

export default function Overview({ leagueData, processed }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const managers = Object.values(processed.managers);
  const totalGames = processed.matchups.length;
  const allScores = processed.matchups.flatMap((m) => [m.homeScore, m.awayScore]);
  const avgPts = allScores.length
    ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1)
    : '—';
  const highScore = processed.matchups.reduce(
    (best, m) => Math.max(best, m.homeScore, m.awayScore),
    0,
  );
  const seasons = Object.keys(leagueData).length;

  const yearLabels = SEASONS.filter((y) => leagueData[y]);
  const yearAvgs = yearLabels.map((y) => {
    const scores = processed.matchups
      .filter((m) => m.season === y && !m.isPlayoff)
      .flatMap((m) => [m.homeScore, m.awayScore]);
    return scores.length
      ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
      : null;
  });

  useEffect(() => {
    if (!canvasRef.current) return;
    const chart = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: yearLabels.map(String),
        datasets: [
          {
            label: 'Avg pts/week',
            data: yearAvgs,
            borderColor: '#C9A84C',
            backgroundColor: 'rgba(201,168,76,0.08)',
            tension: 0.4,
            fill: true,
            pointRadius: 5,
            pointBackgroundColor: '#C9A84C',
            pointBorderColor: '#0d1117',
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            ticks: { color: '#8b949e', font: { size: 11 } },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
          x: {
            ticks: { color: '#8b949e', font: { size: 11 } },
            grid: { display: false },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [JSON.stringify(yearAvgs), yearLabels.join(',')]);

  const sortedManagers = [...managers].sort((a, b) => {
    const wa = a.wins / (a.wins + a.losses + a.ties || 1);
    const wb = b.wins / (b.wins + b.losses + b.ties || 1);
    return wb - wa;
  });

  return (
    <>
      <div className="stat-grid">
        <Stat label="Seasons Loaded" val={seasons} sub="2020–2025" />
        <Stat label="Total Matchups" val={totalGames} sub="Regular + Playoffs" />
        <Stat label="Avg Pts/Week" val={avgPts} sub="All managers, all weeks" />
        <Stat label="Season High Score" val={highScore.toFixed(1)} sub="Single week record" />
        <Stat label="Managers" val={managers.length} sub="Active / Historical" />
      </div>

      <div className="section-head">Hall of Champions</div>
      <div className="trophy-row">
        {yearLabels.map((y) => {
          const teams = leagueData[y]?.teams ?? [];
          const champ = [...teams].sort(
            (a, b) => (a.rankCalculatedFinal ?? 99) - (b.rankCalculatedFinal ?? 99),
          )[0];
          if (!champ) return null;
          const r = champ.record?.overall ?? {};
          return (
            <div key={y} className="trophy-card">
              <div className="trophy-year">{y}</div>
              <div style={{ fontSize: '1.2rem' }}>🏆</div>
              <div className="trophy-name">{teamName(champ, champ.id)}</div>
              <div className="trophy-record">
                {r.wins ?? 0}-{r.losses ?? 0}
                {r.ties ? `-${r.ties}` : ''}
              </div>
            </div>
          );
        })}
      </div>

      <div className="section-head">All-Time Power Rankings</div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Manager</th>
              <th>Titles</th>
              <th>W</th>
              <th>L</th>
              <th>Win %</th>
              <th>Avg Pts/Wk</th>
              <th>Playoff Apps</th>
              <th>Best Finish</th>
            </tr>
          </thead>
          <tbody>
            {sortedManagers.map((m, i) => {
              const avg = m.weekCount ? (m.totalPts / m.weekCount).toFixed(1) : '—';
              const bf = m.bestFinish === 999 ? '—' : ordinal(m.bestFinish);
              return (
                <tr key={m.name}>
                  <td className="rank">#{i + 1}</td>
                  <td>
                    <strong>{m.name}</strong>
                  </td>
                  <td>
                    {m.championships ? (
                      <span className="badge badge-gold">🏆 {m.championships}x</span>
                    ) : (
                      <span className="badge badge-dim">—</span>
                    )}
                  </td>
                  <td className="mono positive">{m.wins}</td>
                  <td className="mono negative">{m.losses}</td>
                  <td className="mono">{pct(m.wins, m.losses, m.ties)}</td>
                  <td className="mono">{avg}</td>
                  <td>
                    {m.playoffApps}/{m.seasons}
                  </td>
                  <td>{bf}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="section-head">Scoring Trend by Season</div>
      <div className="chart-card">
        <div className="chart-title">Average weekly score across all managers</div>
        <div className="chart-wrap" style={{ height: 220 }}>
          <canvas ref={canvasRef} role="img" aria-label="Average weekly scoring trend" />
        </div>
      </div>
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
