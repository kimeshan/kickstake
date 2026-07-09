/**
 * Pure results engine (no DB, no I/O — mirrors draw.ts).
 *
 * Turns the stored matches of a tournament into:
 *   - group standings (FIFA tiebreakers),
 *   - decided/undecided outcomes per result-based prize rule,
 *   - per-participant winnings (won so far + still in play).
 *
 * Only RESULT-BASED rules are computed (winner, runner_up, third_place,
 * group_top, group_bottom). Stats rules (golden boot etc.) can't be derived
 * from scorelines and stay manual.
 */

export type Stage =
  | "group"
  | "round_of_32"
  | "round_of_16"
  | "quarter_final"
  | "semi_final"
  | "third_place"
  | "final";

export const KNOCKOUT_STAGES: Stage[] = [
  "round_of_32",
  "round_of_16",
  "quarter_final",
  "semi_final",
  "third_place",
  "final",
];

/** Minimal match shape needed to lay out the knockout bracket. */
export interface BracketOrderMatch {
  stage: Stage;
  kickoffAt: Date | null;
  externalId: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
}

/**
 * Groups knockout matches into rounds ordered for bracket display. Kickoff
 * order reflects TV scheduling, not bracket position, so sorting a round by
 * date puts ties next to the wrong feeders. Instead the earliest round keeps
 * kickoff order and every later round is sorted by where its teams played in
 * the previous round, so each tie sits beside the two matches that feed it.
 * Ties whose teams are still TBD fall to the end of their round in kickoff
 * order — with no lineage there is no right slot to draw them in anyway.
 */
export function orderBracketRounds<M extends BracketOrderMatch>(
  matches: M[],
): { stage: Stage; matches: M[] }[] {
  const byKickoff = (a: M, b: M) =>
    (a.kickoffAt?.getTime() ?? 0) - (b.kickoffAt?.getTime() ?? 0) ||
    a.externalId.localeCompare(b.externalId);

  const rounds: { stage: Stage; matches: M[] }[] = [];
  let feeders: M[] = [];
  for (const stage of KNOCKOUT_STAGES) {
    const round = matches.filter((m) => m.stage === stage).sort(byKickoff);
    if (round.length === 0) continue;
    if (feeders.length > 0) {
      const prev = feeders;
      const feederIndex = (teamId: string | null) => {
        if (teamId === null) return Infinity;
        const i = prev.findIndex(
          (p) => p.homeTeamId === teamId || p.awayTeamId === teamId,
        );
        return i === -1 ? Infinity : i;
      };
      const pos = new Map(
        round.map((m) => [
          m,
          Math.min(feederIndex(m.homeTeamId), feederIndex(m.awayTeamId)),
        ]),
      );
      // Stable sort: TBD ties (Infinity) keep their kickoff order at the end.
      round.sort((a, b) => {
        const pa = pos.get(a)!;
        const pb = pos.get(b)!;
        return pa === pb ? 0 : pa - pb;
      });
    }
    rounds.push({ stage, matches: round });
    // The third-place play-off is a side match; the final feeds off the semis.
    if (stage !== "third_place") feeders = round;
  }
  return rounds;
}

export interface EngineTeam {
  id: string;
  groupLabel: string;
}

export interface EngineMatch {
  stage: Stage;
  groupLabel: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerTeamId: string | null;
  status: "scheduled" | "in_play" | "finished";
}

export interface StandingRow {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  position: number; // 1-based
}

/** Provider top-scorer row (Golden Boot input). */
export interface ScorerInput {
  playerName: string;
  teamId: string | null;
  goals: number;
}

/** Current front-runner for a stat-based prize (leader ≠ winner yet). */
export interface PrizeLeader {
  teamId: string | null;
  playerName: string | null; // set for golden_boot
  statKey: "goals" | "conceded" | "lossMargin";
  statValue: number;
}

export interface PrizeOutcome {
  ruleType: string;
  groupLabel: string | null; // set for group_top / group_bottom
  decided: boolean;
  winningTeamId: string | null; // set iff decided
  // Teams that can still take this prize (empty when decided).
  contenders: string[];
  leader?: PrizeLeader | null;
}

// --- Standings ---------------------------------------------------------------

interface Tally {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
}

function tallies(teamIds: string[], matches: EngineMatch[]): Map<string, Tally> {
  const map = new Map<string, Tally>(
    teamIds.map((id) => [
      id,
      { teamId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0 },
    ]),
  );
  for (const m of matches) {
    if (m.status !== "finished") continue;
    if (m.homeTeamId === null || m.awayTeamId === null) continue;
    if (m.homeScore === null || m.awayScore === null) continue;
    const home = map.get(m.homeTeamId);
    const away = map.get(m.awayTeamId);
    if (!home || !away) continue;
    home.played++;
    away.played++;
    home.gf += m.homeScore;
    home.ga += m.awayScore;
    away.gf += m.awayScore;
    away.ga += m.homeScore;
    if (m.homeScore > m.awayScore) {
      home.won++;
      away.lost++;
    } else if (m.homeScore < m.awayScore) {
      away.won++;
      home.lost++;
    } else {
      home.drawn++;
      away.drawn++;
    }
  }
  return map;
}

const points = (t: Tally) => t.won * 3 + t.drawn;
const gd = (t: Tally) => t.gf - t.ga;

/**
 * Orders a group's teams by the FIFA criteria: points → goal difference →
 * goals for, then the same three restricted to matches among the still-tied
 * teams. Ties beyond that (fair play / drawing of lots) fall back to teamId
 * for a stable, deterministic order.
 */
export function groupStandings(
  teamIds: string[],
  groupMatches: EngineMatch[],
): StandingRow[] {
  const overall = tallies(teamIds, groupMatches);

  const order = (ids: string[], tally: Map<string, Tally>): string[][] => {
    // Sort into clusters of exact ties on (points, gd, gf).
    const sorted = [...ids].sort((a, b) => {
      const ta = tally.get(a)!;
      const tb = tally.get(b)!;
      return (
        points(tb) - points(ta) || gd(tb) - gd(ta) || tb.gf - ta.gf ||
        (a < b ? -1 : 1)
      );
    });
    const clusters: string[][] = [];
    for (const id of sorted) {
      const prev = clusters[clusters.length - 1];
      const t = tally.get(id)!;
      const p = prev && tally.get(prev[0])!;
      if (p && points(p) === points(t) && gd(p) === gd(t) && p.gf === t.gf) {
        prev.push(id);
      } else {
        clusters.push([id]);
      }
    }
    return clusters;
  };

  const resolved: string[] = [];
  for (const cluster of order(teamIds, overall)) {
    if (cluster.length === 1) {
      resolved.push(cluster[0]);
      continue;
    }
    // Head-to-head mini-table among the tied teams.
    const inCluster = new Set(cluster);
    const h2h = tallies(
      cluster,
      groupMatches.filter(
        (m) =>
          m.homeTeamId !== null &&
          m.awayTeamId !== null &&
          inCluster.has(m.homeTeamId) &&
          inCluster.has(m.awayTeamId),
      ),
    );
    for (const sub of order(cluster, h2h)) resolved.push(...sub);
  }

  return resolved.map((teamId, i) => {
    const t = overall.get(teamId)!;
    return {
      teamId,
      played: t.played,
      won: t.won,
      drawn: t.drawn,
      lost: t.lost,
      goalsFor: t.gf,
      goalsAgainst: t.ga,
      goalDifference: gd(t),
      points: points(t),
      position: i + 1,
    };
  });
}

/** A group is decided once every pairing has a finished result. */
export function groupDecided(teamCount: number, groupMatches: EngineMatch[]): boolean {
  const expected = (teamCount * (teamCount - 1)) / 2;
  const finished = groupMatches.filter(
    (m) =>
      m.status === "finished" &&
      m.homeTeamId !== null &&
      m.awayTeamId !== null &&
      m.homeScore !== null &&
      m.awayScore !== null,
  ).length;
  return teamCount >= 2 && finished >= expected;
}

// --- Prize outcomes ----------------------------------------------------------

function loserOf(m: EngineMatch): string | null {
  if (m.winnerTeamId === null || m.homeTeamId === null || m.awayTeamId === null)
    return null;
  return m.winnerTeamId === m.homeTeamId ? m.awayTeamId : m.homeTeamId;
}

/**
 * Derives every result-based prize outcome from the matches on file.
 * Contender sets shrink as the tournament progresses; a prize flips to
 * decided the moment its deciding match (or full group) is finished.
 */
export function computeOutcomes(
  teams: EngineTeam[],
  matches: EngineMatch[],
  scorers: ScorerInput[] = [],
): PrizeOutcome[] {
  const outcomes: PrizeOutcome[] = [];
  const byGroup = new Map<string, EngineTeam[]>();
  for (const t of teams) {
    if (!byGroup.has(t.groupLabel)) byGroup.set(t.groupLabel, []);
    byGroup.get(t.groupLabel)!.push(t);
  }

  // Attribute a group match to the group its teams belong to — the stored
  // label is only a fallback, so provider label-format drift (e.g. "GROUP_A"
  // vs "A") can never strand a group as undecided.
  const groupOfTeam = new Map(teams.map((t) => [t.id, t.groupLabel]));
  const groupLabelOf = (m: EngineMatch): string | null => {
    const home = m.homeTeamId ? groupOfTeam.get(m.homeTeamId) : undefined;
    const away = m.awayTeamId ? groupOfTeam.get(m.awayTeamId) : undefined;
    if (home && home === away) return home;
    return m.groupLabel;
  };

  // Group prizes.
  for (const [label, groupTeams] of [...byGroup.entries()].sort()) {
    const groupMatches = matches.filter(
      (m) => m.stage === "group" && groupLabelOf(m) === label,
    );
    const ids = groupTeams.map((t) => t.id);
    if (groupDecided(ids.length, groupMatches)) {
      const table = groupStandings(ids, groupMatches);
      outcomes.push({
        ruleType: "group_top",
        groupLabel: label,
        decided: true,
        winningTeamId: table[0].teamId,
        contenders: [],
      });
      outcomes.push({
        ruleType: "group_bottom",
        groupLabel: label,
        decided: true,
        winningTeamId: table[table.length - 1].teamId,
        contenders: [],
      });
    } else {
      for (const ruleType of ["group_top", "group_bottom"]) {
        outcomes.push({
          ruleType,
          groupLabel: label,
          decided: false,
          winningTeamId: null,
          contenders: ids,
        });
      }
    }
  }

  // Knockout prizes.
  const knockout = matches.filter((m) => m.stage !== "group");
  const eliminated = new Set<string>();
  for (const m of knockout) {
    if (m.status !== "finished") continue;
    const loser = loserOf(m);
    if (loser) eliminated.add(loser);
  }
  // Teams missing from a fully-populated first knockout round never advanced.
  const firstStage = KNOCKOUT_STAGES.find((s) =>
    knockout.some((m) => m.stage === s && s !== "third_place"),
  );
  if (firstStage) {
    const roundMatches = knockout.filter((m) => m.stage === firstStage);
    if (roundMatches.every((m) => m.homeTeamId !== null && m.awayTeamId !== null)) {
      const advanced = new Set(
        roundMatches.flatMap((m) => [m.homeTeamId!, m.awayTeamId!]),
      );
      for (const t of teams) if (!advanced.has(t.id)) eliminated.add(t.id);
    }
  }
  const alive = teams.map((t) => t.id).filter((id) => !eliminated.has(id));

  const final = knockout.find((m) => m.stage === "final");
  const bronze = knockout.find((m) => m.stage === "third_place");
  const semiLosers = knockout
    .filter((m) => m.stage === "semi_final" && m.status === "finished")
    .map(loserOf)
    .filter((id): id is string => id !== null);

  const finalists =
    final && final.homeTeamId !== null && final.awayTeamId !== null
      ? [final.homeTeamId, final.awayTeamId]
      : null;

  outcomes.push(
    final?.status === "finished" && final.winnerTeamId
      ? { ruleType: "winner", groupLabel: null, decided: true, winningTeamId: final.winnerTeamId, contenders: [] }
      : { ruleType: "winner", groupLabel: null, decided: false, winningTeamId: null, contenders: finalists ?? alive },
  );
  outcomes.push(
    final?.status === "finished" && final.winnerTeamId
      ? { ruleType: "runner_up", groupLabel: null, decided: true, winningTeamId: loserOf(final), contenders: [] }
      : { ruleType: "runner_up", groupLabel: null, decided: false, winningTeamId: null, contenders: finalists ?? alive },
  );

  // Semi-final losers stay in contention for third place (bronze final);
  // teams that reached the final can no longer finish third.
  const semiWinners = new Set(
    knockout
      .filter((m) => m.stage === "semi_final" && m.status === "finished")
      .map((m) => m.winnerTeamId)
      .filter((id): id is string => id !== null),
  );
  const bronzeContenders =
    bronze && bronze.homeTeamId !== null && bronze.awayTeamId !== null
      ? [bronze.homeTeamId, bronze.awayTeamId]
      : [
          ...new Set([
            ...alive.filter(
              (id) => !semiWinners.has(id) && !(finalists?.includes(id) ?? false),
            ),
            ...semiLosers,
          ]),
        ];
  outcomes.push(
    bronze?.status === "finished" && bronze.winnerTeamId
      ? { ruleType: "third_place", groupLabel: null, decided: true, winningTeamId: bronze.winnerTeamId, contenders: [] }
      : { ruleType: "third_place", groupLabel: null, decided: false, winningTeamId: null, contenders: bronzeContenders },
  );

  // Stat-based prizes derived from scorelines (+ provider scorers). They run
  // as a "current leader" until the whole tournament is played, then settle —
  // unless the top spot is tied, which needs a human call.
  const complete = final?.status === "finished";
  outcomes.push(...statOutcomes(teams, matches, scorers, !!complete));

  return outcomes;
}

/** Top of a ranked list, decidable only when strictly ahead of second place. */
function front<T>(
  ranked: { subject: T; value: number }[],
  complete: boolean,
): { top: { subject: T; value: number }; unique: boolean } | null {
  if (ranked.length === 0) return null;
  const unique = ranked.length === 1 || ranked[0].value !== ranked[1].value;
  return { top: ranked[0], unique: unique && complete };
}

function statOutcomes(
  teams: EngineTeam[],
  matches: EngineMatch[],
  scorers: ScorerInput[],
  complete: boolean,
): PrizeOutcome[] {
  const outcomes: PrizeOutcome[] = [];
  const finished = matches.filter(
    (m) =>
      m.status === "finished" &&
      m.homeTeamId !== null &&
      m.awayTeamId !== null &&
      m.homeScore !== null &&
      m.awayScore !== null,
  );

  const stat = (
    ruleType: string,
    statKey: PrizeLeader["statKey"],
    ranked: { teamId: string | null; playerName?: string; value: number }[],
  ) => {
    const head = front(
      ranked.map((r) => ({ subject: r, value: r.value })),
      complete,
    );
    if (!head) return;
    const { top, unique } = head;
    const decided = unique && top.subject.teamId !== null;
    outcomes.push({
      ruleType,
      groupLabel: null,
      decided,
      winningTeamId: decided ? top.subject.teamId : null,
      contenders: [],
      leader: decided
        ? null
        : {
            teamId: top.subject.teamId,
            playerName: top.subject.playerName ?? null,
            statKey,
            statValue: top.subject.value,
          },
    });
  };

  // Best defence — fewest goals conceded across the tournament.
  if (finished.length > 0) {
    const conceded = new Map<string, number>(teams.map((t) => [t.id, 0]));
    for (const m of finished) {
      if (conceded.has(m.homeTeamId!))
        conceded.set(m.homeTeamId!, conceded.get(m.homeTeamId!)! + m.awayScore!);
      if (conceded.has(m.awayTeamId!))
        conceded.set(m.awayTeamId!, conceded.get(m.awayTeamId!)! + m.homeScore!);
    }
    stat(
      "least_conceded",
      "conceded",
      [...conceded.entries()]
        .map(([teamId, value]) => ({ teamId, value }))
        .sort((a, b) => a.value - b.value || a.teamId!.localeCompare(b.teamId!)),
    );

    // Biggest single-game defeat (consolation prize for its owner).
    const worstLoss = new Map<string, number>();
    for (const m of finished) {
      const margin = Math.abs(m.homeScore! - m.awayScore!);
      if (margin === 0) continue;
      const loser = m.homeScore! < m.awayScore! ? m.homeTeamId! : m.awayTeamId!;
      worstLoss.set(loser, Math.max(worstLoss.get(loser) ?? 0, margin));
    }
    stat(
      "biggest_loss",
      "lossMargin",
      [...worstLoss.entries()]
        .map(([teamId, value]) => ({ teamId, value }))
        .sort((a, b) => b.value - a.value || a.teamId!.localeCompare(b.teamId!)),
    );
  }

  // Golden Boot — needs provider scorer data.
  if (scorers.length > 0) {
    stat(
      "golden_boot",
      "goals",
      [...scorers]
        .map((s) => ({ teamId: s.teamId, playerName: s.playerName, value: s.goals }))
        .sort((a, b) => b.value - a.value || a.playerName!.localeCompare(b.playerName!)),
    );
  }

  return outcomes;
}

// --- Winnings ----------------------------------------------------------------

export interface EnginePrizeCategory {
  id: string;
  ruleType: string;
  label: string;
  amount: number; // minor units; per-group amount when perGroup
  perGroup: boolean;
  enabled: boolean;
}

export interface PrizeRow {
  categoryId: string;
  ruleType: string;
  label: string;
  amount: number;
  perGroup: boolean;
  groupLabel: string | null;
  // False when the engine produced no outcome for the rule (possession,
  // cards, custom, …) — those settle manually at the end.
  computable: boolean;
  decided: boolean;
  winningTeamId: string | null;
  contenders: string[];
  leader: PrizeLeader | null;
}

/**
 * Expands the sweepstake's enabled prize categories against the tournament
 * outcomes — per-group prizes become one row per group.
 */
export function buildPrizeRows(
  categories: EnginePrizeCategory[],
  outcomes: PrizeOutcome[],
): PrizeRow[] {
  const rows: PrizeRow[] = [];
  for (const c of categories) {
    if (!c.enabled) continue;
    const base = {
      categoryId: c.id,
      ruleType: c.ruleType,
      label: c.label,
      amount: c.amount,
      perGroup: c.perGroup,
    };
    const matching = outcomes.filter((o) => o.ruleType === c.ruleType);
    if (matching.length === 0) {
      rows.push({
        ...base,
        groupLabel: null,
        computable: false,
        decided: false,
        winningTeamId: null,
        contenders: [],
        leader: null,
      });
      continue;
    }
    for (const o of matching) {
      rows.push({
        ...base,
        groupLabel: o.groupLabel,
        computable: true,
        decided: o.decided,
        winningTeamId: o.winningTeamId,
        contenders: o.contenders,
        leader: o.leader ?? null,
      });
    }
  }
  return rows;
}

export interface LeaderboardEntry {
  participantId: string;
  won: number; // decided prize money, minor units
  inPlay: number; // undecided prize money where they still own a contender
}

export interface WinningsSummary {
  entries: LeaderboardEntry[];
  potWon: number; // decided money on pot-owned (unassigned) teams
}

/** teamId → participantId (null = pot-owned). */
export type OwnershipMap = Map<string, string | null>;

export function computeWinnings(
  participantIds: string[],
  ownership: OwnershipMap,
  rows: PrizeRow[],
): WinningsSummary {
  const won = new Map<string, number>(participantIds.map((id) => [id, 0]));
  const inPlay = new Map<string, number>(participantIds.map((id) => [id, 0]));
  let potWon = 0;

  for (const row of rows) {
    if (!row.computable) continue;
    if (row.decided && row.winningTeamId !== null) {
      const owner = ownership.get(row.winningTeamId) ?? null;
      if (owner !== null && won.has(owner)) {
        won.set(owner, won.get(owner)! + row.amount);
      } else {
        potWon += row.amount;
      }
    } else if (!row.decided) {
      const contendingOwners = new Set<string>();
      for (const teamId of row.contenders) {
        const owner = ownership.get(teamId) ?? null;
        if (owner !== null && inPlay.has(owner)) contendingOwners.add(owner);
      }
      for (const owner of contendingOwners)
        inPlay.set(owner, inPlay.get(owner)! + row.amount);
    }
  }

  return {
    entries: participantIds.map((participantId) => ({
      participantId,
      won: won.get(participantId)!,
      inPlay: inPlay.get(participantId)!,
    })),
    potWon,
  };
}
