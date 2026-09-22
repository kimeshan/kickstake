import { ACTIVITY_MINUTES_V1 } from "./scoring";

/**
 * The first challenge, created by the explicit bootstrap command
 * (`db:challenge:bootstrap`). Already under way at launch — the start date is
 * fixed, NOT deployment day.
 */
export const INITIAL_CHALLENGE = {
  slug: "family-level-up-sep-2026",
  title: "Family Level Up",
  startDate: "2026-09-21",
  weekCount: 4,
  timeZone: "Africa/Johannesburg",
  // Monday 19 October 2026, 12:00 SAST.
  finalEditCutoff: new Date("2026-10-19T10:00:00Z"),
  scoringVersion: ACTIVITY_MINUTES_V1.version,
} as const;
