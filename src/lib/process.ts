import type {
  ESPNLeague,
  ESPNMember,
  ManagerStats,
  Matchup,
  ProcessedData,
} from './types';

export function teamName(
  team: { name?: string; location?: string; nickname?: string } | undefined,
  id: number,
): string {
  if (!team) return `Team ${id}`;
  // Newer ESPN payloads use `name`; older ones used `location` + `nickname`.
  return (
    team.name?.trim() ||
    `${team.location ?? ''} ${team.nickname ?? ''}`.trim() ||
    `Team ${id}`
  );
}

function ownerName(member: ESPNMember | undefined, ownerId: string): string {
  if (!member) return `Unknown (${ownerId.slice(1, 9)})`;
  const full = `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim();
  return full || member.displayName?.trim() || `Unknown (${ownerId.slice(1, 9)})`;
}

const UNCLAIMED = '__unclaimed__';

// When the same human registers multiple ESPN accounts over the years, map
// the older account(s) to their current/canonical one so stats merge.
// Key = old SWID, value = canonical SWID. Add new entries as you find them.
const OWNER_ALIASES: Record<string, string> = {
  // Bradley Heckman — used 07F89356 in 2020, switched to D0FECDB3 from 2021+
  '{07F89356-7A88-4D0C-B893-567A889D0CA4}': '{D0FECDB3-D42D-4AB1-A728-654B6CC65DBF}',
};

function canonical(ownerId: string): string {
  return OWNER_ALIASES[ownerId] ?? ownerId;
}

export function processAllData(leagueData: Record<number, ESPNLeague>): ProcessedData {
  const matchups: Matchup[] = [];
  const managers: Record<string, ManagerStats> = {};
  const seasonsSeen = new Map<string, Set<number>>();

  const ensureManager = (ownerId: string, name: string, year: number, team: string): ManagerStats => {
    let m = managers[ownerId];
    if (!m) {
      m = {
        ownerId,
        name,
        teamNames: [],
        wins: 0,
        losses: 0,
        ties: 0,
        totalPts: 0,
        weekCount: 0,
        seasons: 0,
        seasonsActive: [],
        championships: 0,
        playoffApps: 0,
        bestFinish: 999,
        seasonWins: {},
        seasonLoss: {},
        seasonPts: {},
        seasonTeamName: {},
      };
      managers[ownerId] = m;
      seasonsSeen.set(ownerId, new Set());
    } else if (name && !m.name.startsWith('Unknown')) {
      // Keep the existing real name; otherwise upgrade from a placeholder.
    } else if (name) {
      m.name = name;
    }
    const yrs = seasonsSeen.get(ownerId)!;
    if (!yrs.has(year)) {
      yrs.add(year);
      m.seasons++;
      m.seasonsActive.push(year);
      m.seasonsActive.sort((a, b) => b - a);
    }
    m.seasonTeamName[year] = team;
    if (!m.teamNames.includes(team)) m.teamNames.unshift(team);
    if (m.seasonWins[year] === undefined) m.seasonWins[year] = 0;
    if (m.seasonLoss[year] === undefined) m.seasonLoss[year] = 0;
    if (m.seasonPts[year] === undefined) m.seasonPts[year] = 0;
    return m;
  };

  for (const yearStr of Object.keys(leagueData)) {
    const year = Number(yearStr);
    const data = leagueData[year];
    if (!data) continue;
    const teams = data.teams ?? [];
    const members = data.members ?? [];
    const schedule = data.schedule ?? [];
    const sched = data.settings?.scheduleSettings ?? {};
    const numPlayoffTeams = sched.playoffTeamCount ?? 4;
    const regularSeasonWeeks = sched.matchupPeriodCount ?? 13;

    const memberById = new Map<string, ESPNMember>();
    for (const m of members) memberById.set(m.id, m);

    // teamId → { ownerId, teamName } for this season
    const ownerByTeamId = new Map<number, string>();
    const teamNameByTeamId = new Map<number, string>();
    for (const t of teams) {
      const tn = teamName(t, t.id);
      teamNameByTeamId.set(t.id, tn);
      const rawOwnerId = t.owners?.[0] ?? `${UNCLAIMED}-${year}-${t.id}`;
      const ownerId = canonical(rawOwnerId);
      ownerByTeamId.set(t.id, ownerId);
      // Resolve display name from THIS season's members first (so an alias
      // mapping a defunct account uses the canonical account's real name).
      const member = memberById.get(ownerId) ?? memberById.get(rawOwnerId);
      const name = ownerName(member, ownerId);
      ensureManager(ownerId, name, year, tn);
    }

    for (const game of schedule) {
      const home = game.home;
      const away = game.away;
      if (!home || !away) continue;
      if (home.totalPoints === undefined || away.totalPoints === undefined) continue;
      const homeScore = home.totalPoints;
      const awayScore = away.totalPoints;
      if (homeScore === 0 && awayScore === 0) continue;

      const homeOwner = ownerByTeamId.get(home.teamId) ?? `${UNCLAIMED}-${year}-${home.teamId}`;
      const awayOwner = ownerByTeamId.get(away.teamId) ?? `${UNCLAIMED}-${year}-${away.teamId}`;
      const homeTeam = teamNameByTeamId.get(home.teamId) ?? `Team ${home.teamId}`;
      const awayTeam = teamNameByTeamId.get(away.teamId) ?? `Team ${away.teamId}`;
      const week = game.matchupPeriodId;
      const isPlayoff = week > regularSeasonWeeks;
      const margin = Math.abs(homeScore - awayScore);
      const homeWon = homeScore > awayScore;

      matchups.push({
        season: year,
        week,
        homeOwner,
        homeTeam,
        homeScore,
        awayOwner,
        awayTeam,
        awayScore,
        winnerOwner: homeWon ? homeOwner : awayOwner,
        winnerTeam: homeWon ? homeTeam : awayTeam,
        loserOwner: homeWon ? awayOwner : homeOwner,
        loserTeam: homeWon ? awayTeam : homeTeam,
        winnerScore: Math.max(homeScore, awayScore),
        loserScore: Math.min(homeScore, awayScore),
        margin: parseFloat(margin.toFixed(2)),
        isPlayoff,
        isChampionship: false,
      });

      for (const ownerId of [homeOwner, awayOwner]) {
        const m = managers[ownerId];
        if (!m) continue;
        const scored = ownerId === homeOwner ? homeScore : awayScore;
        const opp = ownerId === homeOwner ? awayScore : homeScore;
        m.totalPts += scored;
        m.weekCount++;
        if (!isPlayoff) {
          if (scored > opp) {
            m.wins++;
            m.seasonWins[year]++;
          } else if (scored < opp) {
            m.losses++;
            m.seasonLoss[year]++;
          } else {
            m.ties++;
          }
          m.seasonPts[year] += scored;
        }
      }
    }

    const standings = teams
      .map((t) => ({
        ownerId: ownerByTeamId.get(t.id) ?? `${UNCLAIMED}-${year}-${t.id}`,
        seed: t.rankCalculatedFinal ?? 99,
      }))
      .sort((a, b) => a.seed - b.seed);

    standings.forEach((t, i) => {
      const m = managers[t.ownerId];
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
