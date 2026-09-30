/**
 * Leaderboard construction, shared by the API's standings endpoint and the
 * emailed digest so both always rank people identically.
 */
import { summarise, weekResult, type Medal, type ScoringRules } from "./scoring";

export interface StandingsEntry {
  memberId: string;
  displayName: string;
  minutes: number | null;
  level: number | null;
  medal: Medal | null;
  reachedBaseline: boolean;
  updateSource: "participant" | "organiser" | null;
  successfulWeeks: number;
  totalMinutes: number | null;
  isMe: boolean;
  rank: number | null;
  overallRank: number | null;
}

export interface StandingsAggregates {
  groupMinutes: number;
  activeCount: number;
  atBaselineCount: number;
  enteredCount: number;
  notEnteredCount: number;
  levelCounts: Record<string, number>;
}

interface MemberLike {
  id: string;
  userId: string;
  displayName: string;
}

interface WeekRowLike {
  memberId: string;
  weekNumber: number;
  minutes: number | null;
  updateSource: "participant" | "organiser" | null;
}

const collator = new Intl.Collator("en", { sensitivity: "base" });

/**
 * Sorts by value desc (null last, names break ties for display only) and
 * assigns competition ranks — equal values share a rank (1, 1, 3); null
 * values stay unranked.
 */
export function assignRanks<T extends { displayName: string }>(
  items: T[],
  value: (t: T) => number | null,
  setRank: (t: T, rank: number | null) => void,
) {
  items.sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === null || vb === null)
      return va === vb ? collator.compare(a.displayName, b.displayName) : va === null ? 1 : -1;
    return vb - va || collator.compare(a.displayName, b.displayName);
  });
  let prev: { value: number; rank: number } | null = null;
  items.forEach((t, i) => {
    const v = value(t);
    if (v === null) return setRank(t, null);
    const rank = prev && prev.value === v ? prev.rank : i + 1;
    setRank(t, rank);
    prev = { value: v, rank };
  });
}

export function buildStandings(params: {
  weekNumber: number;
  weekCount: number;
  rules: ScoringRules;
  members: MemberLike[];
  rows: WeekRowLike[];
  /** Marks `isMe` for one viewer; null for machine consumers such as email. */
  viewerUserId: string | null;
}): { entries: StandingsEntry[]; aggregates: StandingsAggregates } {
  const { weekNumber, weekCount, rules, members, rows, viewerUserId } = params;
  const byMember = new Map<string, WeekRowLike[]>();
  for (const r of rows) byMember.set(r.memberId, [...(byMember.get(r.memberId) ?? []), r]);

  const entries: StandingsEntry[] = members.map((m) => {
    const mine = byMember.get(m.id) ?? [];
    const row = mine.find((r) => r.weekNumber === weekNumber);
    const minutes = row?.minutes ?? null;
    const result = weekResult(minutes, rules);
    const weeks: (number | null)[] = Array.from({ length: weekCount }, () => null);
    for (const r of mine) if (r.weekNumber <= weekCount) weeks[r.weekNumber - 1] = r.minutes;
    const summary = summarise(weeks, rules);
    return {
      memberId: m.id,
      displayName: m.displayName,
      minutes,
      level: result?.level ?? null,
      medal: result?.medal ?? null,
      reachedBaseline: result?.reachedBaseline ?? false,
      updateSource: row?.updateSource ?? null,
      successfulWeeks: summary.successfulWeeks,
      totalMinutes: summary.totalMinutes,
      isMe: m.userId === viewerUserId,
      rank: null,
      overallRank: null,
    };
  });

  // Overall first; the weekly pass below fixes the display order.
  assignRanks(entries, (e) => e.totalMinutes, (e, r) => (e.overallRank = r));
  assignRanks(entries, (e) => e.minutes, (e, r) => (e.rank = r));

  const entered = entries.filter((e) => e.minutes !== null);
  const levelCounts: Record<string, number> = {};
  for (const rung of rules.ladder) levelCounts[rung.level] = 0;
  for (const e of entered) levelCounts[e.level!]++;

  return {
    entries,
    aggregates: {
      groupMinutes: entered.reduce((s, e) => s + e.minutes!, 0),
      activeCount: entries.length,
      atBaselineCount: entered.filter((e) => e.reachedBaseline).length,
      enteredCount: entered.length,
      notEnteredCount: entries.length - entered.length,
      levelCounts,
    },
  };
}
