import { useRef, useState } from 'react';
import { SEASONS } from '../lib/espn';
import { pct, teamName } from '../lib/process';
import type { ESPNLeague, ProcessedData } from '../lib/types';

interface Props {
  leagueData: Record<number, ESPNLeague>;
  processed: ProcessedData;
}

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'Who has the most championships? 🏆',
  "What's the biggest blowout ever?",
  'Who has the best playoff record?',
  'Who scores the most points per game?',
  'Most unlucky manager (high pts, low wins)?',
  'Closest game in league history?',
  'Best single season record?',
  'Who improves most year over year?',
];

function buildSystemPrompt(leagueData: Record<number, ESPNLeague>, processed: ProcessedData): string {
  const managers = Object.values(processed.managers);
  const avail = SEASONS.filter((y) => leagueData[y]);

  const champByYear = avail
    .map((y) => {
      const teams = leagueData[y]?.teams ?? [];
      const c = [...teams].sort(
        (a, b) => (a.rankCalculatedFinal ?? 99) - (b.rankCalculatedFinal ?? 99),
      )[0];
      return c ? `${y}: ${teamName(c, c.id)}` : null;
    })
    .filter(Boolean)
    .join(', ');

  const topScorers = avail
    .map((y) => {
      const ms = processed.matchups.filter((m) => m.season === y && !m.isPlayoff);
      const scores: Record<string, number> = {};
      for (const m of ms) {
        scores[m.homeTeam] = (scores[m.homeTeam] ?? 0) + m.homeScore;
        scores[m.awayTeam] = (scores[m.awayTeam] ?? 0) + m.awayScore;
      }
      const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
      return top ? `${y}: ${top[0]} (${top[1].toFixed(1)} total)` : null;
    })
    .filter(Boolean)
    .join('; ');

  const sorted = [...managers].sort(
    (a, b) => b.wins / (b.wins + b.losses || 1) - a.wins / (a.wins + a.losses || 1),
  );
  const managerSummary = sorted
    .map((m) => {
      const avg = m.weekCount ? (m.totalPts / m.weekCount).toFixed(1) : '?';
      return `${m.name}: ${m.wins}W-${m.losses}L (${pct(m.wins, m.losses, m.ties)} win rate), avg ${avg} pts/wk, ${m.championships} titles, ${m.playoffApps} playoff apps`;
    })
    .join('\n');

  const valid = processed.matchups.filter((m) => m.margin > 0);
  const bigBlowout = valid.reduce((b, m) => (m.margin > b.margin ? m : b), valid[0]);
  const closest = valid.reduce((b, m) => (m.margin < b.margin ? m : b), valid[0]);
  const highScore = processed.matchups.reduce(
    (b, m) => {
      const hi = Math.max(m.homeScore, m.awayScore);
      return hi > b.s ? { s: hi, m } : b;
    },
    { s: 0, m: processed.matchups[0] },
  );

  return `You are Gridiron Oracle, an expert fantasy football analyst for a private ESPN fantasy league (ID: 97124817).

REAL LEAGUE DATA (fetched live from ESPN API):
Seasons available: ${avail.join(', ')}

CHAMPIONS BY YEAR: ${champByYear}

ALL-TIME MANAGER STATS:
${managerSummary}

TOP SCORERS BY SEASON: ${topScorers}

RECORD BOOK:
- Biggest blowout: ${bigBlowout.winner} beat ${bigBlowout.loser} by ${bigBlowout.margin} pts (${bigBlowout.season} Week ${bigBlowout.week})
- Closest game: ${closest.winner} edged ${closest.loser} by ${closest.margin} pts (${closest.season} Week ${closest.week})
- Highest single score: ${highScore.s.toFixed(2)} pts (${highScore.m.season} Week ${highScore.m.week})

Answer questions with insight and personality. Use specific stats. Be like a sports analyst — opinionated, data-driven, entertaining. Keep answers concise (under 150 words) unless the user asks for detail. Use bold for names/numbers.`;
}

function renderMarkdown(s: string): string {
  return s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
}

export default function Chat({ leagueData, processed }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const userMsg: Msg = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setBusy(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: buildSystemPrompt(leagueData, processed),
          messages: next,
          max_tokens: 1000,
        }),
      });
      const data = await res.json();
      const reply = data?.content?.[0]?.text ?? data?.error ?? 'No response.';
      setMessages([...next, { role: 'assistant', content: reply }]);
    } catch {
      setMessages([
        ...next,
        { role: 'assistant', content: 'Connection error. Make sure you are online and try again.' },
      ]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      });
    }
  }

  return (
    <div className="chat-container">
      <div className="chat-msgs" ref={scrollRef}>
        <div className="msg ai">
          <strong>⚡ Gridiron Oracle online.</strong> I have full access to your league's real
          ESPN data from 2020–2025 — every matchup, score, and standing.
          <br />
          <br />
          Ask me anything: championship history, biggest blowouts, who chokes in playoffs,
          scoring trends, head-to-head records, or advanced stats.
        </div>
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="msg user">
              {m.content}
            </div>
          ) : (
            <div
              key={i}
              className="msg ai"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
            />
          ),
        )}
        {busy && (
          <div className="msg ai">
            <div className="typing-dots">
              <div className="dot" />
              <div className="dot" />
              <div className="dot" />
            </div>
          </div>
        )}
      </div>
      <div className="chat-bottom">
        <div className="chips">
          {SUGGESTIONS.map((s) => (
            <div key={s} className="chip" onClick={() => send(s)}>
              {s}
            </div>
          ))}
        </div>
        <div className="chat-row">
          <input
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send(input)}
            placeholder="Ask anything about your league..."
          />
          <button className="send-btn" disabled={busy} onClick={() => send(input)}>
            Ask Oracle ⚡
          </button>
        </div>
      </div>
    </div>
  );
}
