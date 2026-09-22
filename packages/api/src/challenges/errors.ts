import { HttpException } from "@nestjs/common";

/**
 * Machine-readable challenge error codes. The web app maps `code` to
 * translated copy, so never rely on `message` for UI text.
 */
export type ChallengeErrorCode =
  | "invalid_body"
  | "unknown_field"
  | "invalid_display_name"
  | "invalid_minutes"
  | "invalid_version"
  | "invalid_week"
  | "invalid_week_query"
  | "reason_required"
  | "invalid_setting"
  | "invalid_member_update"
  | "untrusted_origin"
  | "not_a_member"
  | "not_organiser"
  | "membership_removed"
  | "challenge_not_found"
  | "invitation_not_found"
  | "member_not_found"
  | "joining_closed"
  | "challenge_ended"
  | "week_not_started"
  | "editing_closed"
  | "editing_locked"
  | "version_conflict"
  | "rate_limited";

export function challengeError(
  status: number,
  code: ChallengeErrorCode,
  extra: Record<string, unknown> = {},
): HttpException {
  return new HttpException({ statusCode: status, code, ...extra }, status);
}
