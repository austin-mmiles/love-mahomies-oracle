import type { ProcessedData } from '../lib/types';
import OwnerLink from './OwnerLink';

interface Props {
  processed: ProcessedData;
}

interface Cell {
  w: number;
  l: number;
  pts: number;
  oppPts: number;
}

const lastName = (nm: string) => nm.split(' ').pop() || nm;

export default function H2H({ processed }: Props) {
  const managerList = Object.values(processed.managers).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const managers = managerList.map((m) => m.ownerId);
  const nameOf = (ownerId: string) => processed.managers[ownerId]?.name ?? '?';
  const shortOf = (ownerId: string) => lastName(nameOf(ownerId));

  const h2h: Record<string, Record<string, Cell>> = {};
  for (const a of managers) {
    h2h[a] = {};
    for (const b of managers) h2h[a][b] = { w: 0, l: 0, pts: 0, oppPts: 0 };
  }

  for (const m of processed.matchups) {
    if (m.homeScore <= 0 || m.awayScore <= 0) continue;
    if (!h2h[m.homeOwner]?.[m.awayOwner]) continue;
    if (m.homeScore > m.awayScore) {
      h2h[m.homeOwner][m.awayOwner].w++;
      h2h[m.awayOwner][m.homeOwner].l++;
    } else {
      h2h[m.homeOwner][m.awayOwner].l++;
      h2h[m.awayOwner][m.homeOwner].w++;
    }
    h2h[m.homeOwner][m.awayOwner].pts += m.homeScore;
    h2h[m.homeOwner][m.awayOwner].oppPts += m.awayScore;
    h2h[m.awayOwner][m.homeOwner].pts += m.awayScore;
    h2h[m.awayOwner][m.homeOwner].oppPts += m.homeScore;
  }

  const rivalries: {
    a: string;
    b: string;
    w: number;
    l: number;
    total: number;
    dominant: string;
    avgMargin: string;
  }[] = [];
  for (let i = 0; i < managers.length; i++) {
    for (let j = i + 1; j < managers.length; j++) {
      const a = managers[i];
      const b = managers[j];
      const r = h2h[a][b];
      if (r.w + r.l < 2) continue;
      const total = r.w + r.l;
      const dominant = r.w > r.l ? a : r.l > r.w ? b : 'Tied';
      const avgMargin = (Math.abs(r.pts - r.oppPts) / total).toFixed(1);
      rivalries.push({ a, b, w: r.w, l: r.l, total, dominant, avgMargin });
    }
  }
  rivalries.sort((x, y) => y.total - x.total);

  return (
    <>
      <div className="section-head">Head-to-Head Matrix (All-Time)</div>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>
        Rows = your record vs each opponent. Green = winning record, Red = losing.
      </p>
      <div className="h2h-matrix tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>vs →</th>
              {managers.map((m) => (
                <th key={m}>{shortOf(m)}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {managers.map((a) => {
              let totalW = 0;
              let totalL = 0;
              const cells = managers.map((b) => {
                if (a === b)
                  return (
                    <td key={b} className="h2h-self">
                      —
                    </td>
                  );
                const r = h2h[a][b];
                if (r.w + r.l === 0)
                  return (
                    <td key={b} className="h2h-self">
                      —
                    </td>
                  );
                totalW += r.w;
                totalL += r.l;
                const cls =
                  r.w > r.l ? 'h2h-win' : r.w < r.l ? 'h2h-loss' : 'h2h-self';
                return (
                  <td key={b} className={cls}>
                    {r.w}-{r.l}
                  </td>
                );
              });
              return (
                <tr key={a}>
                  <td>
                    <strong><OwnerLink ownerId={a}>{shortOf(a)}</OwnerLink></strong>
                  </td>
                  {cells}
                  <td>
                    <strong>
                      {totalW}-{totalL}
                    </strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="section-head">Biggest Rivalries</div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Matchup</th>
              <th>Games</th>
              <th>Record</th>
              <th>Avg Margin</th>
              <th>Dominant Side</th>
            </tr>
          </thead>
          <tbody>
            {rivalries.slice(0, 15).map((r, i) => (
              <tr key={i}>
                <td>
                  <strong>{shortOf(r.a)}</strong> vs{' '}
                  <strong>{shortOf(r.b)}</strong>
                </td>
                <td className="mono">{r.total}</td>
                <td className="mono">
                  {r.w}-{r.l}
                </td>
                <td className="mono">+{r.avgMargin}</td>
                <td>
                  {r.dominant === 'Tied' ? (
                    <span className="badge badge-dim">Tied</span>
                  ) : (
                    <span className="badge badge-gold">{shortOf(r.dominant)}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
