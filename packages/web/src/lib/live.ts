/** Shapes of the API's live results payload (see api/src/results/live.ts). */

export interface LiveSlot {
  teamId: string;
  name: string;
  flagCode: string | null;
  participantName: string | null;
}

export type LiveStageName =
  | "round_of_32"
  | "round_of_16"
  | "quarter_final"
  | "semi_final"
  | "third_place"
  | "final";

export interface LiveMatch {
  id: string;
  stage: LiveStageName;
  kickoffAt: string | null;
  status: "scheduled" | "in_play" | "finished";
  home: LiveSlot | null;
  away: LiveSlot | null;
  homeScore: number | null;
  awayScore: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
  winnerTeamId: string | null;
}

export interface LiveLeader {
  teamId: string | null;
  name: string | null; // team name
  flagCode: string | null;
  participantName: string | null;
  playerName: string | null; // set for golden_boot
  statKey: "goals" | "conceded" | "lossMargin";
  statValue: number;
}

export interface LivePrize {
  categoryId: string;
  ruleType: string;
  label: string;
  amount: number;
  perGroup: boolean;
  groupLabel: string | null;
  computable: boolean;
  decided: boolean;
  winner: LiveSlot | null;
  leader: LiveLeader | null;
  resultId: string | null;
  paidOut: boolean;
}

export interface LiveView {
  updatedAt: string | null;
  bracket: { stage: LiveStageName; matches: LiveMatch[] }[];
  prizes: LivePrize[];
  leaderboard: {
    participantId: string;
    displayName: string;
    won: number;
    inPlay: number;
  }[];
  potWon: number;
}
