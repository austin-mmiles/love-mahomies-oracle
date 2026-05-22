// Minimal types for the ESPN payloads we actually use.
// ESPN's API is undocumented; treat all fields as optional and parse defensively.

export interface ESPNTeam {
  id: number;
  name?: string;
  abbrev?: string;
  location?: string;
  nickname?: string;
  owners?: string[];
  points?: number;
  pointsAgainst?: number;
  rankCalculatedFinal?: number;
  playoffSeed?: number;
  record?: {
    overall?: {
      wins?: number;
      losses?: number;
      ties?: number;
      streakLength?: number;
      streakType?: 'WIN' | 'LOSS';
    };
  };
  roster?: { entries?: ESPNRosterEntry[] };
}

export interface ESPNRosterEntry {
  playerId: number;
  lineupSlotId: number;
  playerPoolEntry?: {
    player?: {
      id: number;
      fullName?: string;
      defaultPositionId?: number;
      proTeamId?: number;
      stats?: ESPNPlayerStat[];
    };
  };
}

export interface ESPNPlayerStat {
  scoringPeriodId: number;
  seasonId: number;
  statSourceId: number; // 0 = actual, 1 = projected
  statSplitTypeId: number;
  appliedTotal?: number;
}

export interface ESPNMatchupSide {
  teamId: number;
  totalPoints?: number;
  rosterForCurrentScoringPeriod?: { entries?: ESPNRosterEntry[] };
}

// ESPN tags every matchup with a tier. Anything past the regular season
// that's not WINNERS_BRACKET (e.g. WINNERS_CONSOLATION_LADDER,
// LOSERS_CONSOLATION_LADDER, THIRD_PLACE_GAME) is a consolation game
// and shouldn't count toward W/L/points totals.
export type PlayoffTierType =
  | 'NONE'
  | 'WINNERS_BRACKET'
  | 'WINNERS_CONSOLATION_LADDER'
  | 'LOSERS_CONSOLATION_LADDER'
  | 'THIRD_PLACE_GAME'
  | string;

export interface ESPNMatchup {
  matchupPeriodId: number;
  home?: ESPNMatchupSide;
  away?: ESPNMatchupSide;
  playoffTierType?: PlayoffTierType;
  winner?: 'HOME' | 'AWAY' | 'TIE' | 'UNDECIDED';
}

export interface ESPNMember {
  id: string; // SWID-style GUID, e.g. "{ABCD-1234-...}"
  firstName?: string;
  lastName?: string;
  displayName?: string;
}

export interface ESPNLeague {
  id: number;
  seasonId: number;
  teams?: ESPNTeam[];
  members?: ESPNMember[];
  schedule?: ESPNMatchup[];
  settings?: {
    name?: string;
    scheduleSettings?: {
      matchupPeriodCount?: number;
      playoffTeamCount?: number;
      playoffSeedingRule?: number;
    };
  };
}

// Normalized shapes used throughout the app.
// Owner identity (a stable SWID GUID) is the primary key for aggregating
// stats. Team names change every season and even owners can be replaced,
// so we keep team names only for per-game display and key everything else
// off the owner GUID.
export interface Matchup {
  season: number;
  week: number;
  homeOwner: string;
  homeTeam: string;
  homeScore: number;
  awayOwner: string;
  awayTeam: string;
  awayScore: number;
  winnerOwner: string;
  winnerTeam: string;
  loserOwner: string;
  loserTeam: string;
  winnerScore: number;
  loserScore: number;
  margin: number;
  isPlayoff: boolean;
  isChampionship: boolean;
}

export interface ManagerStats {
  ownerId: string;       // stable SWID GUID
  name: string;          // owner's real name (or fallback)
  teamNames: string[];   // every team name they've used, most recent first
  wins: number;
  losses: number;
  ties: number;
  totalPts: number;
  weekCount: number;
  seasons: number;       // distinct seasons they appeared in
  seasonsActive: number[];
  championships: number;
  playoffApps: number;
  bestFinish: number;
  seasonWins: Record<number, number>;
  seasonLoss: Record<number, number>;
  seasonPts: Record<number, number>;
  seasonTeamName: Record<number, string>; // year -> team name that season
}

export interface ProcessedData {
  matchups: Matchup[];
  managers: Record<string, ManagerStats>; // keyed by ownerId
}
