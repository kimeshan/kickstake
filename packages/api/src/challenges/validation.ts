import { MAX_WEEKLY_MINUTES } from "../db/schema";
import { challengeError } from "./errors";

// Runtime request validation. TypeScript types vanish at runtime, so every
// body is checked here — including rejecting fields the client may not set
// (userId, level, role, …).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

/** Ensures a plain JSON object whose keys are all in `allowed`. */
export function parseBody(body: unknown, allowed: string[]): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw challengeError(400, "invalid_body");
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) throw challengeError(400, "unknown_field", { field: key });
  }
  return body as Record<string, unknown>;
}

export const DISPLAY_NAME_MAX = 50;

/** 1–50 characters after trimming; control characters are stripped. */
export function parseDisplayName(v: unknown): string {
  if (typeof v !== "string") throw challengeError(400, "invalid_display_name");
  // eslint-disable-next-line no-control-regex
  const name = v.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  const length = [...name].length;
  if (length < 1 || length > DISPLAY_NAME_MAX) throw challengeError(400, "invalid_display_name");
  return name;
}

/** Whole minutes 0–10,080, or null to clear. Never rounds. */
export function parseMinutes(v: unknown): number | null {
  if (v === null) return null;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > MAX_WEEKLY_MINUTES)
    throw challengeError(400, "invalid_minutes");
  return v;
}

export function parseVersion(v: unknown): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0)
    throw challengeError(400, "invalid_version");
  return v;
}

/** Week path/query parameter, validated against the challenge's week count. */
export function parseWeek(v: unknown, weekCount: number): number {
  const s = typeof v === "string" ? v : "";
  if (!/^\d{1,3}$/.test(s)) throw challengeError(400, "invalid_week");
  const n = Number(s);
  if (n < 1 || n > weekCount) throw challengeError(400, "invalid_week");
  return n;
}

export const REASON_MAX = 500;

export function parseReason(v: unknown): string {
  const reason = typeof v === "string" ? v.trim() : "";
  if (!reason || reason.length > REASON_MAX) throw challengeError(400, "reason_required");
  return reason;
}
