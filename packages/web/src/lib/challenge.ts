/**
 * Activity challenge client: types mirroring the API, a fetch wrapper that
 * surfaces machine-readable error codes, and locale-aware formatting.
 */
import { apiUrl } from "./api";

export type Medal = "none" | "bronze" | "silver" | "gold" | "platinum";
export type WeekStatus = "future" | "current" | "elapsed";
export type Phase = "upcoming" | "active" | "reporting" | "finished";
export type UpdateSource = "participant" | "organiser";

export interface Rung {
  minMinutes: number;
  level: number;
  medal: Medal;
}

export interface WeekWindow {
  weekNumber: number;
  startDate: string;
  endDate: string;
  startsAt: string;
  endsAt: string;
  reportingDueAt: string;
  status: WeekStatus;
}

export interface Timing {
  serverTime: string;
  phase: Phase;
  currentWeek: number | null;
  defaultWeek: number;
  startsAt: string;
  activityEndsAt: string;
  lastActivityDate: string;
  finalEditCutoff: string;
  beforeCutoff: boolean;
  weeks: WeekWindow[];
}

export interface WeekResult {
  minutes: number;
  level: number;
  medal: Medal;
  baselinePercent: number;
  reachedBaseline: boolean;
  nextLevel: number | null;
  nextThreshold: number | null;
  minutesToNext: number | null;
}

export interface Summary {
  totalMinutes: number | null;
  bestWeek: number | null;
  successfulWeeks: number;
  bestStreak: number;
  weekCount: number;
  enteredWeeks: number;
}

export interface ChallengeDetail {
  id: string;
  title: string;
  startDate: string;
  weekCount: number;
  timeZone: string;
  scoringVersion: string;
  baselineMinutes: number;
  ladder: Rung[];
  joiningClosed: boolean;
  participantEditingLocked: boolean;
  timing: Timing;
  role: {
    isOwner: boolean;
    isMember: boolean;
    memberId: string | null;
    displayName: string | null;
  };
}

export interface MyWeek extends WeekWindow {
  minutes: number | null;
  version: number;
  updatedAt: string | null;
  updateSource: UpdateSource | null;
  editable: boolean;
  inProgress: boolean;
  result: WeekResult | null;
}

export interface MyProgress {
  member: { id: string; displayName: string; joinedAt: string };
  participantEditingLocked: boolean;
  timing: Timing;
  weeks: MyWeek[];
  summary: Summary;
}

export interface Invitation {
  title: string;
  startDate: string;
  lastActivityDate: string;
  weekCount: number;
  timeZone: string;
  baselineMinutes: number;
  ladder: Rung[];
  weeks: { weekNumber: number; startDate: string; endDate: string }[];
  phase: Phase;
  finalEditCutoff: string;
  joinable: boolean;
  unavailableReason: "joining_closed" | "challenge_ended" | null;
  viewer: { status: "none" | "member" | "removed" | "owner"; challengeId?: string } | null;
}

export interface StandingEntry {
  memberId: string;
  displayName: string;
  minutes: number | null;
  level: number | null;
  medal: Medal | null;
  reachedBaseline: boolean;
  updateSource: UpdateSource | null;
  successfulWeeks: number;
  isMe: boolean;
  rank: number | null;
}

export interface Aggregates {
  groupMinutes: number;
  activeCount: number;
  atBaselineCount: number;
  enteredCount: number;
  notEnteredCount: number;
  levelCounts: Record<string, number>;
}

export interface Standings {
  week: WeekWindow;
  inProgress: boolean;
  aggregates: Aggregates;
  entries: StandingEntry[];
  timing: Timing;
}

export interface MineItem {
  id: string;
  title: string;
  startDate: string;
  lastActivityDate: string;
  phase: Phase;
  displayName: string | null;
  isOwner: boolean;
  isMember: boolean;
}

/** Error codes the API returns; each maps to translated copy (challenge.errors.*). */
export const KNOWN_ERROR_CODES = [
  "invalid_display_name",
  "invalid_minutes",
  "reason_required",
  "not_a_member",
  "not_organiser",
  "membership_removed",
  "challenge_not_found",
  "invitation_not_found",
  "member_not_found",
  "joining_closed",
  "challenge_ended",
  "week_not_started",
  "editing_closed",
  "editing_locked",
  "version_conflict",
  "rate_limited",
  "untrusted_origin",
] as const;

export class ChallengeApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly body: Record<string, unknown>,
  ) {
    super(`${status}: ${code}`);
  }
}

/** Thrown when the request never got an HTTP answer (offline, DNS, reset). */
export class NetworkError extends Error {}

/** Translation key for an error: known API code, else a generic fallback. */
export function errorKey(e: unknown): string {
  if (e instanceof NetworkError) return "network";
  if (e instanceof ChallengeApiError) {
    if ((KNOWN_ERROR_CODES as readonly string[]).includes(e.code)) return e.code;
    if (e.status === 401) return "signed_out";
  }
  return "generic";
}

/** Same-origin `/api/challenges…` request that throws typed errors. */
export async function challengeApi<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(`/challenges${path}`), {
      ...init,
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch (e) {
    throw new NetworkError(e instanceof Error ? e.message : "network");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new ChallengeApiError(res.status, String(body.code ?? res.status), body);
  }
  return (await res.json()) as T;
}

// --- Formatting -----------------------------------------------------------

/** A YYYY-MM-DD calendar date as a UTC-midnight Date (no zone shifting). */
function calendarDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** "21–27 Sep" / "28 Sep – 4 Oct", localised. */
export function formatDateRange(start: string, end: string, locale: string): string {
  const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });
  try {
    return fmt.formatRange(calendarDate(start), calendarDate(end));
  } catch {
    return `${fmt.format(calendarDate(start))} – ${fmt.format(calendarDate(end))}`;
  }
}

/** "Mon, 28 Sep", localised. */
export function formatDate(date: string, locale: string, long = false): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: long ? "long" : "short",
    day: "numeric",
    month: long ? "long" : "short",
    timeZone: "UTC",
  }).format(calendarDate(date));
}

/** An instant shown in the challenge's zone, with the zone named: "Mon 19 Oct, 12:00 SAST". */
export function formatInstant(iso: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(new Date(iso));
}

export function formatNumber(n: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(n);
}

/** Hours + minutes split, for the >1,000 confirmation and the Platinum note. */
export function hoursAndMinutes(total: number): { h: number; m: number } {
  return { h: Math.floor(total / 60), m: total % 60 };
}

/** Minutes entry: digits only (0–10,080). Returns null with a reason if invalid. */
export function parseMinutesInput(
  raw: string,
): { ok: true; value: number } | { ok: false; reason: "empty" | "format" | "range" } {
  const s = raw.trim();
  if (!s) return { ok: false, reason: "empty" };
  if (!/^\d+$/.test(s)) return { ok: false, reason: "format" };
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n > 10_080) return { ok: false, reason: "range" };
  return { ok: true, value: n };
}

export const MEDAL_STYLES: Record<Medal, string> = {
  none: "bg-muted text-muted-foreground border-border",
  bronze: "bg-[#cd7f32]/15 text-[#e7a05d] border-[#cd7f32]/40",
  silver: "bg-[#c0c7cf]/15 text-[#d6dde4] border-[#c0c7cf]/40",
  gold: "bg-[#f2c94c]/15 text-[#f2c94c] border-[#f2c94c]/40",
  platinum: "bg-[#9fe7ff]/15 text-[#bdf0ff] border-[#9fe7ff]/40",
};

// --- Organiser --------------------------------------------------------------

export interface ManageWeek {
  weekNumber: number;
  minutes: number | null;
  version: number;
  updatedAt: string | null;
  updateSource: UpdateSource | null;
  level: number | null;
}

export interface ManageMember {
  memberId: string;
  displayName: string;
  joinedAt: string;
  removedAt: string | null;
  lastUpdatedAt: string | null;
  weeks: ManageWeek[];
  summary: Summary;
}

export interface ManageView extends Omit<ChallengeDetail, "role"> {
  joinToken: string;
  invitationUrl: string;
  finalEditCutoff: string;
  members: ManageMember[];
}

export interface WeekSummary extends Aggregates {
  title: string;
  timeZone: string;
  baselineMinutes: number;
  weekNumber: number;
  weekCount: number;
  startDate: string;
  endDate: string;
  inProgress: boolean;
}

/** Copies text; falls back to a hidden textarea where the async API is unavailable. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
