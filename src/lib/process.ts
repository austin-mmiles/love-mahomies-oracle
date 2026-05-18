import type { ESPNLeague, ManagerStats, Matchup, ProcessedData } from './types';

function teamName(team: { location?: string; nickname?: string } | undefined, id: number): string {
  if (!team) return `Team ${id}`;
  return `${team.location ?? ''} ${team.nickname ?? ''}`.trim() || `Team ${id}`;
}

export function processAllData(leagueData: Record<number, ESPNLeague>): ProcessedData {
  const matchups: Matchup[] = [];
  const managers: Record<string, ManagerStats> = {};

  const ensureManager = (name: string): ManagerStats => {
    if (!managers[name]) {
      managers[name] = {
        name,
        wins: 0,
        losses: 0,
        ties: 0,
        totalPts: 0,
        weekCount: 0,
        seasons: 0,
        championships: 0,
        playoffApps: 0,
        bestFinish: 999,
        seasonWins: {},
        seasonLoss: {},
        seasonPts: {},
      };
    }
    return managers[name];
  };

  for (const yearStr of Object.keys(leagueData)) {
    const year = Number(yearStr);
    const data = leagueData[year];
    if (!data) continue;
    const teams = data.teams ?? [];
    const schedule = data.schedule ?? [];
    const sched = data.settings?.scheduleSettings ?? {};
    const numPlayoffTeams = sched.playoffTeamCount ?? 4;
    const regularSeasonWeeks = sched.matchupPeriodCount ?? 13;

    const nameById = new Map<number, string>();
    for (const t of teams) {
      const nm = teamName(t, t.id);
      nameById.set(t.id, nm);
      const m = ensureManager(nm);
      m.seasons++;
      m.seasonWins[year] = 0;
      m.seasonLoss[year] = 0;
      m.seasonPts[year] = 0;
    }

    for (const game of schedule) {
      const home = game.home;
      const away = game.away;
      if (!home || !away) continue;
      if (home.totalPoints === undefined || away.totalPoints === undefined) continue;
      const homeScore = home.totalPoints;
      const awayScore = away.totalPoints;
      if (homeScore === 0 && awayScore === 0) continue;

      const homeName = nameById.get(home.teamId) ?? `Team ${home.teamId}`;
      const awayName = nameById.get(away.teamId) ?? `Team ${away.teamId}`;
      const week = game.matchupPeriodId;
      const isPlayoff = week > regularSeasonWeeks;
      const margin = Math.abs(homeScore - awayScore);

      matchups.push({
        season: year,
        week,
        homeTeam: homeName,
        homeScore,
        awayTeam: awayName,
        awayScore,
        winner: homeScore > awayScore ? homeName : awayName,
        loser: homeScore > awayScore ? awayName : homeName,
        winnerScore: Math.max(homeScore, awayScore),
        loserScore: Math.min(homeScore, awayScore),
        margin: parseFloat(margin.toFixed(2)),
        isPlayoff,
        isChampionship: false,
      });

      for (const nm of [homeName, awayName]) {
        const m = managers[nm];
        if (!m) continue;
        const scored = nm === homeName ? homeScore : awayScore;
        const opp = nm === homeName ? awayScore : homeScore;
        m.totalPts += scored;
        m.weekCount++;
        if (!isPlayoff) {
          if (scored > opp) {
            m.wins++;
            m.seasonWins[year] = (m.seasonWins[year] ?? 0) + 1;
          } else if (scored < opp) {
            m.losses++;
            m.seasonLoss[year] = (m.seasonLoss[year] ?? 0) + 1;
          } else {
            m.ties++;
          }
          m.seasonPts[year] = (m.seasonPts[year] ?? 0) + scored;
        }
      }
    }

    const standings = teams
      .map((t) => ({
        name: teamName(t, t.id),
        seed: t.rankCalculatedFinal ?? 99,
      }))
      .sort((a, b) => a.seed - b.seed);

    standings.forEach((t, i) => {
      const m = managers[t.name];
      if (!m) return;
      if (i < numPlayoffTeams) m.playoffApps++;
      const finish = i + 1;
      if (finish < m.bestFinish) m.bestFinish = finish;
      if (finish === 1) m.championships++;
    });
  }

  return { matchups, managers };
}

// Small formatting helpers shared across components
export function pct(w: number, l: number, t = 0): string {
  const g = w + l + t;
  return g ? ((w / g) * 100).toFixed(1) + '%' : '—';
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
