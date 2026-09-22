/**
 * Server-side challenge calendar. Week boundaries are computed in the
 * challenge's IANA time zone — never from the phone's local date. Intervals
 * are half-open: local Monday 00:00 inclusive → next Monday 00:00 exclusive.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Offset (ms) of `timeZone` from UTC at `instant`. */
function tzOffsetMs(instant: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(
    dtf.formatToParts(new Date(instant)).map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** UTC instant of local wall-clock `date` (YYYY-MM-DD) at hh:mm in `timeZone`. */
export function zonedToUtc(date: string, timeZone: string, hour = 0, minute = 0): Date {
  const [y, m, d] = date.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, hour, minute);
  // Two passes settle DST transitions (offset at the guess vs at the result).
  let ts = naive - tzOffsetMs(naive, timeZone);
  ts = naive - tzOffsetMs(ts, timeZone);
  return new Date(ts);
}

/** Calendar arithmetic on a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Validates an IANA zone name. */
export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export interface ChallengeCalendarInput {
  startDate: string;
  weekCount: number;
  timeZone: string;
  finalEditCutoff: Date;
}

export type WeekStatus = "future" | "current" | "elapsed";
export type ChallengePhase = "upcoming" | "active" | "reporting" | "finished";

export interface WeekWindow {
  weekNumber: number;
  /** First local activity date (Monday). */
  startDate: string;
  /** Last local activity date (Sunday), inclusive. */
  endDate: string;
  startsAt: string; // ISO instant
  endsAt: string; // ISO instant, exclusive
  /** Soft reminder: following Monday 12:00 local. Not a lock. */
  reportingDueAt: string;
  status: WeekStatus;
}

export interface ChallengeTiming {
  serverTime: string;
  phase: ChallengePhase;
  /** Week containing `now`, or null outside the activity window. */
  currentWeek: number | null;
  /** Week the UI should open on. */
  defaultWeek: number;
  startsAt: string;
  activityEndsAt: string;
  /** Last local activity date (inclusive). */
  lastActivityDate: string;
  finalEditCutoff: string;
  /** Participants may still write (before the final cutoff). */
  beforeCutoff: boolean;
  weeks: WeekWindow[];
}

export function challengeTiming(c: ChallengeCalendarInput, now: Date): ChallengeTiming {
  const t = now.getTime();
  const weeks: WeekWindow[] = [];
  let currentWeek: number | null = null;
  for (let i = 0; i < c.weekCount; i++) {
    const startDate = addDays(c.startDate, i * 7);
    const nextMonday = addDays(startDate, 7);
    const startsAt = zonedToUtc(startDate, c.timeZone);
    const endsAt = zonedToUtc(nextMonday, c.timeZone);
    const status: WeekStatus =
      t < startsAt.getTime() ? "future" : t < endsAt.getTime() ? "current" : "elapsed";
    if (status === "current") currentWeek = i + 1;
    weeks.push({
      weekNumber: i + 1,
      startDate,
      endDate: addDays(startDate, 6),
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      reportingDueAt: zonedToUtc(nextMonday, c.timeZone, 12).toISOString(),
      status,
    });
  }
  const first = weeks[0];
  const last = weeks[weeks.length - 1];
  const beforeCutoff = t < c.finalEditCutoff.getTime();
  const phase: ChallengePhase =
    t < Date.parse(first.startsAt)
      ? "upcoming"
      : currentWeek !== null
        ? "active"
        : beforeCutoff
          ? "reporting"
          : "finished";
  return {
    serverTime: now.toISOString(),
    phase,
    currentWeek,
    defaultWeek: phase === "upcoming" ? 1 : (currentWeek ?? c.weekCount),
    startsAt: first.startsAt,
    activityEndsAt: last.endsAt,
    lastActivityDate: last.endDate,
    finalEditCutoff: c.finalEditCutoff.toISOString(),
    beforeCutoff,
    weeks,
  };
}
