import { useEffect, useMemo, useState } from 'react';
import { SEASONS, loadAllSeasons } from './lib/espn';
import { processAllData } from './lib/process';
import type { ESPNLeague, ProcessedData } from './lib/types';
import Overview from './components/Overview';
import Seasons from './components/Seasons';
import Standings from './components/Standings';
import Matchups from './components/Matchups';
import H2H from './components/H2H';
import Players from './components/Players';
import Chat from './components/Chat';

type TabId = 'overview' | 'seasons' | 'standings' | 'matchups' | 'h2h' | 'players' | 'chat';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'seasons', label: 'Seasons' },
  { id: 'standings', label: 'Standings' },
  { id: 'matchups', label: 'Matchups' },
  { id: 'h2h', label: 'H2H' },
  { id: 'players', label: 'Players' },
  { id: 'chat', label: 'AI Chat' },
];

export default function App() {
  const [leagueData, setLeagueData] = useState<Record<number, ESPNLeague> | null>(null);
  const [loadStatus, setLoadStatus] = useState('Initializing...');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('overview');

  useEffect(() => {
    (async () => {
      try {
        const data = await loadAllSeasons((loaded, total, year) => {
          setProgress((loaded / total) * 90);
          setLoadStatus(`Fetching ${year} season...`);
        });
        setProgress(95);
        setLoadStatus('Processing stats...');
        setLeagueData(data);
        setProgress(100);
        setLoadStatus('Done!');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      }
    })();
  }, []);

  const processed: ProcessedData | null = useMemo(
    () => (leagueData ? processAllData(leagueData) : null),
    [leagueData],
  );

  if (!leagueData || !processed) {
    return (
      <div id="load-screen">
        <div className="load-title">⚡ Gridiron Oracle</div>
        <div className="load-sub">Fetching league data from ESPN · 2020–2025</div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="load-status">{loadStatus}</div>
        {error && (
          <div className="load-error" style={{ display: 'block' }}>
            <div>⚠️ {error}</div>
            <button className="retry-btn" onClick={() => location.reload()}>
              Retry
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <header className="header">
        <div className="logo">
          ⚡ Gridiron Oracle
          <span>
            <span className="status-dot done" />
            League #97124817 · Live Data
          </span>
        </div>
        <nav>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? 'active' : ''}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <div className="panel">
        {tab === 'overview' && <Overview leagueData={leagueData} processed={processed} />}
        {tab === 'seasons' && <Seasons leagueData={leagueData} processed={processed} />}
        {tab === 'standings' && <Standings leagueData={leagueData} processed={processed} />}
        {tab === 'matchups' && <Matchups leagueData={leagueData} processed={processed} />}
        {tab === 'h2h' && <H2H processed={processed} />}
        {tab === 'players' && <Players leagueData={leagueData} processed={processed} />}
        {tab === 'chat' && <Chat leagueData={leagueData} processed={processed} />}
      </div>
    </>
  );
}
