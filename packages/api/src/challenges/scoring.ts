/**
 * Versioned challenge scoring. A challenge stores its `scoringVersion`, so a
 * future ladder can be added alongside this one without rewriting the results
 * of a challenge that already ran under v1.
 *
 * Everything here is derived at read time — levels, medals, totals and
 * streaks are never persisted or accepted from the client.
 */

export type Medal = "none" | "bronze" | "silver" | "gold" | "platinum";

export interface Rung {
  minMinutes: number;
  level: number;
  medal: Medal;
}

export interface ScoringRules {
  version: string;
  baselineMinutes: number;
  ladder: Rung[]; // ascending by minMinutes; ladder[0] is always level 0
}

export const ACTIVITY_MINUTES_V1: ScoringRules = {
  version: "activity-minutes-v1",
  baselineMinutes: 150,
  ladder: [
    { minMinutes: 0, level: 0, medal: "none" },
    { minMinutes: 150, level: 1, medal: "bronze" },
    { minMinutes: 200, level: 2, medal: "bronze" },
    { minMinutes: 250, level: 3, medal: "bronze" },
    { minMinutes: 300, level: 4, medal: "silver" },
    { minMinutes: 350, level: 5, medal: "silver" },
    { minMinutes: 400, level: 6, medal: "silver" },
    { minMinutes: 450, level: 7, medal: "silver" },
    { minMinutes: 500, level: 8, medal: "gold" },
    { minMinutes: 600, level: 9, medal: "gold" },
    { minMinutes: 800, level: 10, medal: "gold" },
    { minMinutes: 1000, level: 11, medal: "platinum" },
  ],
};

const RULES: Record<string, ScoringRules> = {
  [ACTIVITY_MINUTES_V1.version]: ACTIVITY_MINUTES_V1,
};

export function scoringRules(version: string): ScoringRules {
  const rules = RULES[version];
  if (!rules) throw new Error(`Unknown scoring version: ${version}`);
  return rules;
}

export interface WeekResult {
  minutes: number;
  level: number;
  medal: Medal;
  /** 0–100, capped: progress toward the baseline (150). */
  baselinePercent: number;
  reachedBaseline: boolean;
  /** Next rung, or null at the top of the ladder ("Highest level reached"). */
  nextLevel: number | null;
  nextThreshold: number | null;
  minutesToNext: number | null;
}

/** Result for one week's total. `null` minutes (not entered) → `null`. */
export function weekResult(
  minutes: number | null,
  rules: ScoringRules = ACTIVITY_MINUTES_V1,
): WeekResult | null {
  if (minutes === null) return null;
  let idx = 0;
  for (let i = 0; i < rules.ladder.length; i++) {
    if (minutes >= rules.ladder[i].minMinutes) idx = i;
  }
  const rung = rules.ladder[idx];
  const next = rules.ladder[idx + 1] ?? null;
  return {
    minutes,
    level: rung.level,
    medal: rung.medal,
    baselinePercent: Math.min(100, Math.floor((minutes / rules.baselineMinutes) * 100)),
    reachedBaseline: minutes >= rules.baselineMinutes,
    nextLevel: next?.level ?? null,
    nextThreshold: next?.minMinutes ?? null,
    minutesToNext: next ? next.minMinutes - minutes : null,
  };
}

export interface ChallengeSummary {
  /** Sum of entered weeks; null when nothing is entered. */
  totalMinutes: number | null;
  /** Highest entered week; null when nothing is entered. */
  bestWeek: number | null;
  /** Weeks at or above the baseline. */
  successfulWeeks: number;
  /** Longest run of consecutive weeks at or above the baseline. */
  bestStreak: number;
  weekCount: number;
  enteredWeeks: number;
}

/** `weeks[i]` is week i+1's total (null = not entered). */
export function summarise(
  weeks: (number | null)[],
  rules: ScoringRules = ACTIVITY_MINUTES_V1,
): ChallengeSummary {
  const entered = weeks.filter((m): m is number => m !== null);
  let successfulWeeks = 0;
  let run = 0;
  let bestStreak = 0;
  for (const m of weeks) {
    if (m !== null && m >= rules.baselineMinutes) {
      successfulWeeks++;
      run++;
      bestStreak = Math.max(bestStreak, run);
    } else {
      // Missing or below baseline breaks the run.
      run = 0;
    }
  }
  return {
    totalMinutes: entered.length ? entered.reduce((a, b) => a + b, 0) : null,
    bestWeek: entered.length ? Math.max(...entered) : null,
    successfulWeeks,
    bestStreak,
    weekCount: weeks.length,
    enteredWeeks: entered.length,
  };
}
