/**
 * Builds the read-time "live" view of a sweepstake: knockout bracket, prize
 * outcomes and per-participant winnings — always computed fresh from the
 * matches on file, so the UI never lags the last cron run.
 */
import { eq } from "drizzle-orm";
import { db } from "../db";
import { match, scorer } from "../db/schema";
import {
  computeOutcomes,
  buildPrizeRows,
  computeWinnings,
  orderBracketRounds,
  type EngineMatch,
  type Stage,
  type PrizeLeader,
} from "./engine";

interface TeamInfo {
  id: string;
  name: string;
  groupLabel: string;
  flagCode: string | null;
}

interface ParticipantInfo {
  id: string;
  displayName: string;
}

interface AssignmentInfo {
  teamId: string;
  participantId: string | null;
  team: TeamInfo;
  participant: ParticipantInfo | null;
}

interface PrizeCategoryInfo {
  id: string;
  ruleType: string;
  label: string;
  amount: number;
  perGroup: boolean;
  enabled: boolean;
}

export interface LiveSlot {
  teamId: string;
  name: string;
  flagCode: string | null;
  participantName: string | null;
}

export interface LiveMatch {
  id: string;
  stage: Stage;
  kickoffAt: Date | null;
  status: "scheduled" | "in_play" | "finished";
  home: LiveSlot | null;
  away: LiveSlot | null;
  homeScore: number | null;
  awayScore: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
  winnerTeamId: string | null;
}

/** Front-runner for a stat prize, enriched with team/participant display data. */
export interface LiveLeader {
  teamId: string | null;
  name: string | null; // team name
  flagCode: string | null;
  participantName: string | null;
  playerName: string | null; // set for golden_boot
  statKey: PrizeLeader["statKey"];
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
}

export interface LiveView {
  updatedAt: Date | null;
  bracket: { stage: Stage; matches: LiveMatch[] }[];
  prizes: LivePrize[];
  leaderboard: {
    participantId: string;
    displayName: string;
    won: number;
    inPlay: number;
  }[];
  potWon: number;
}

export async function buildLiveView(input: {
  tournamentId: string;
  teams: TeamInfo[];
  participants: ParticipantInfo[];
  assignments: AssignmentInfo[];
  prizeCategories: PrizeCategoryInfo[];
}): Promise<LiveView | null> {
  const [matches, scorers] = await Promise.all([
    db.query.match.findMany({
      where: eq(match.tournamentId, input.tournamentId),
    }),
    db.query.scorer.findMany({
      where: eq(scorer.tournamentId, input.tournamentId),
    }),
  ]);
  if (matches.length === 0) return null;

  const teamById = new Map(input.teams.map((t) => [t.id, t]));
  const ownerByTeam = new Map(
    input.assignments.map((a) => [a.teamId, a.participantId]),
  );
  const participantById = new Map(input.participants.map((p) => [p.id, p]));

  const slot = (teamId: string | null): LiveSlot | null => {
    if (teamId === null) return null;
    const t = teamById.get(teamId);
    if (!t) return null;
    const ownerId = ownerByTeam.get(teamId) ?? null;
    return {
      teamId,
      name: t.name,
      flagCode: t.flagCode,
      participantName:
        (ownerId && participantById.get(ownerId)?.displayName) || null,
    };
  };

  const engineMatches: EngineMatch[] = matches.map((m) => ({
    stage: m.stage as Stage,
    groupLabel: m.groupLabel,
    homeTeamId: m.homeTeamId,
    awayTeamId: m.awayTeamId,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    winnerTeamId: m.winnerTeamId,
    status: m.status,
  }));

  const outcomes = computeOutcomes(input.teams, engineMatches, scorers);
  const rows = buildPrizeRows(input.prizeCategories, outcomes);
  const winnings = computeWinnings(
    input.participants.map((p) => p.id),
    ownerByTeam,
    rows,
  );

  const bracket = orderBracketRounds(matches).map(({ stage, matches: round }) => ({
    stage,
    matches: round.map((m) => ({
      id: m.id,
      stage: m.stage as Stage,
      kickoffAt: m.kickoffAt,
      status: m.status,
      home: slot(m.homeTeamId),
      away: slot(m.awayTeamId),
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      homePenalties: m.homePenalties,
      awayPenalties: m.awayPenalties,
      winnerTeamId: m.winnerTeamId,
    })),
  }));

  const leaderboard = winnings.entries
    .map((e) => ({
      participantId: e.participantId,
      displayName: participantById.get(e.participantId)?.displayName ?? "",
      won: e.won,
      inPlay: e.inPlay,
    }))
    .sort(
      (a, b) =>
        b.won - a.won ||
        b.inPlay - a.inPlay ||
        a.displayName.localeCompare(b.displayName),
    );

  const updatedAt = matches.reduce<Date | null>(
    (max, m) => (max === null || m.updatedAt > max ? m.updatedAt : max),
    null,
  );

  return {
    updatedAt,
    bracket,
    prizes: rows.map((r) => ({
      categoryId: r.categoryId,
      ruleType: r.ruleType,
      label: r.label,
      amount: r.amount,
      perGroup: r.perGroup,
      groupLabel: r.groupLabel,
      computable: r.computable,
      decided: r.decided,
      winner: r.decided ? slot(r.winningTeamId) : null,
      leader: r.leader
        ? {
            teamId: r.leader.teamId,
            name: r.leader.teamId
              ? (teamById.get(r.leader.teamId)?.name ?? null)
              : null,
            flagCode: r.leader.teamId
              ? (teamById.get(r.leader.teamId)?.flagCode ?? null)
              : null,
            participantName: r.leader.teamId
              ? (slot(r.leader.teamId)?.participantName ?? null)
              : null,
            playerName: r.leader.playerName,
            statKey: r.leader.statKey,
            statValue: r.leader.statValue,
          }
        : null,
    })),
    leaderboard,
    potWon: winnings.potWon,
  };
}
