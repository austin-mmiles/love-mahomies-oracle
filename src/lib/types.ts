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

export interface ESPNMatchup {
  matchupPeriodId: number;
  home?: ESPNMatchupSide;
  away?: ESPNMatchupSide;
  playoffTierType?: string;
  winner?: 'HOME' | 'AWAY' | 'TIE' | 'UNDECIDED';
}

export interface ESPNLeague {
  id: number;
  seasonId: number;
  teams?: ESPNTeam[];
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

// Normalized shapes used throughout the app
export interface Matchup {
  season: number;
  week: number;
  homeTeam: string;
  homeScore: number;
  awayTeam: string;
  awayScore: number;
  winner: string;
  loser: string;
  winnerScore: number;
  loserScore: number;
  margin: number;
  isPlayoff: boolean;
  isChampionship: boolean;
}

export interface ManagerStats {
  name: string;
  wins: number;
  losses: number;
  ties: number;
  totalPts: number;
  weekCount: number;
  seasons: number;
  championships: number;
  playoffApps: number;
  bestFinish: number;
  seasonWins: Record<number, number>;
  seasonLoss: Record<number, number>;
  seasonPts: Record<number, number>;
}

export interface ProcessedData {
  matchups: Matchup[];
  managers: Record<string, ManagerStats>;
}
