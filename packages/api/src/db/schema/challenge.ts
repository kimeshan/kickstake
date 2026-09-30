import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  date,
  uuid,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth";

// Activity challenge (KickStake Challenge): a fixed run of Monday–Sunday
// weeks where each account-linked member reports ONE weekly minute total.
// Deliberately separate from the anonymous sweepstake `participant` table —
// challenge edits are authorised against a Better Auth account.

/**
 * How often the leaderboard digest goes out. Capped at twice a week by
 * design — more than that reads as spam for a four-week challenge.
 */
export const challengeDigestCadenceEnum = pgEnum("activity_challenge_digest_cadence", [
  "off",
  "weekly",
  "twice_weekly",
]);

/** How a digest or reminder send was triggered. */
export const challengeSendTriggerEnum = pgEnum("activity_challenge_send_trigger", [
  "scheduled",
  "organiser",
]);

/** How a weekly reminder was triggered. */
export const challengeReminderKindEnum = pgEnum("activity_challenge_reminder_kind", [
  "automatic",
  "organiser",
]);

/** Who wrote a weekly total — shown to the participant ("Updated by organiser"). */
export const challengeUpdateSourceEnum = pgEnum("activity_challenge_update_source", [
  "participant",
  "organiser",
]);

/** Hard upper bound for one week's minutes: 7 × 24 × 60. */
export const MAX_WEEKLY_MINUTES = 10_080;

export const activityChallenge = pgTable(
  "activity_challenge",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Stable key for the bootstrap command (idempotent upsert target).
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    // Restrict, not cascade: deleting the organiser's account must not
    // silently wipe a whole group's history.
    organiserId: text("organiser_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    // Local calendar date (in `timeZone`) of the first Monday.
    startDate: date("start_date", { mode: "string" }).notNull(),
    weekCount: integer("week_count").notNull(),
    // IANA zone that defines week boundaries, e.g. "Africa/Johannesburg".
    timeZone: text("time_zone").notNull(),
    // After this instant participant entries are read-only.
    finalEditCutoff: timestamp("final_edit_cutoff", { withTimezone: true }).notNull(),
    // Pins the scoring ladder so future versions never rewrite history.
    scoringVersion: text("scoring_version").notNull(),
    // Leaderboard digest schedule, organiser-controlled.
    digestCadence: challengeDigestCadenceEnum("digest_cadence").notNull().default("twice_weekly"),
    joinToken: text("join_token").notNull(),
    joiningClosed: boolean("joining_closed").notNull().default(false),
    participantEditingLocked: boolean("participant_editing_locked")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (c) => [
    uniqueIndex("activity_challenge_slug_idx").on(c.slug),
    uniqueIndex("activity_challenge_join_token_idx").on(c.joinToken),
    index("activity_challenge_organiser_idx").on(c.organiserId),
    check("activity_challenge_week_count_check", sql`${c.weekCount} > 0`),
  ],
);

export const activityChallengeMember = pgTable(
  "activity_challenge_member",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => activityChallenge.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Shown to the group. Email never is.
    displayName: text("display_name").notNull(),
    // Locale this person last used in the app — reminder emails follow it.
    locale: text("locale").notNull().default("en"),
    // Per-person opt-outs (neither ever blocks sign-in emails).
    remindersOptOut: boolean("reminders_opt_out").notNull().default(false),
    digestOptOut: boolean("digest_opt_out").notNull().default(false),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    // Soft removal keeps history; a removed account can't rejoin until restored.
    removedAt: timestamp("removed_at", { withTimezone: true }),
  },
  (m) => [
    // Includes removed rows — one membership per account per challenge, ever.
    uniqueIndex("activity_challenge_member_unique_idx").on(m.challengeId, m.userId),
    index("activity_challenge_member_user_idx").on(m.userId),
  ],
);

export const activityChallengeWeek = pgTable(
  "activity_challenge_week",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => activityChallengeMember.id, { onDelete: "cascade" }),
    weekNumber: integer("week_number").notNull(),
    // null = "Not entered" (distinct from an explicit 0).
    minutes: integer("minutes"),
    // Optimistic-concurrency counter; bumps on every write, including clears.
    version: integer("version").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    updateSource: challengeUpdateSourceEnum("update_source"),
  },
  (w) => [
    uniqueIndex("activity_challenge_week_unique_idx").on(w.memberId, w.weekNumber),
    check(
      "activity_challenge_week_minutes_check",
      sql`${w.minutes} IS NULL OR (${w.minutes} >= 0 AND ${w.minutes} <= 10080)`,
    ),
    check("activity_challenge_week_number_check", sql`${w.weekNumber} > 0`),
    check("activity_challenge_week_version_check", sql`${w.version} >= 0`),
  ],
);

export const activityChallengeWeekAudit = pgTable(
  "activity_challenge_week_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weekId: uuid("week_id")
      .notNull()
      .references(() => activityChallengeWeek.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    oldMinutes: integer("old_minutes"),
    newMinutes: integer("new_minutes"),
    oldVersion: integer("old_version").notNull(),
    newVersion: integer("new_version").notNull(),
    source: challengeUpdateSourceEnum("source").notNull(),
    // Required for organiser corrections.
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (a) => [index("activity_challenge_week_audit_week_idx").on(a.weekId)],
);

/**
 * One row per reminder email actually sent. Doubles as the idempotency
 * record: the partial unique index means the weekly job can run as often as
 * it likes (and be retried) without emailing anyone twice for a week.
 * Organiser nudges are deliberately repeatable, so they aren't constrained.
 */
export const activityChallengeReminder = pgTable(
  "activity_challenge_reminder",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => activityChallengeMember.id, { onDelete: "cascade" }),
    weekNumber: integer("week_number").notNull(),
    kind: challengeReminderKindEnum("kind").notNull(),
    // Null for the automatic job; the organiser's account for a manual send.
    sentBy: text("sent_by").references(() => user.id, { onDelete: "set null" }),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (r) => [
    uniqueIndex("activity_challenge_reminder_auto_idx")
      .on(r.memberId, r.weekNumber)
      .where(sql`${r.kind} = 'automatic'`),
    index("activity_challenge_reminder_member_idx").on(r.memberId),
  ],
);

/**
 * One row per leaderboard digest sent. `slot` is the local send window it
 * belongs to (e.g. "2026-10-01T18"), which makes the schedule idempotent:
 * the job can run every few minutes and each member gets at most one email
 * per slot. Organiser-triggered sends are recorded but not constrained.
 */
export const activityChallengeDigest = pgTable(
  "activity_challenge_digest",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => activityChallengeMember.id, { onDelete: "cascade" }),
    slot: text("slot").notNull(),
    trigger: challengeSendTriggerEnum("trigger").notNull(),
    sentBy: text("sent_by").references(() => user.id, { onDelete: "set null" }),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (d) => [
    uniqueIndex("activity_challenge_digest_slot_idx")
      .on(d.memberId, d.slot)
      .where(sql`${d.trigger} = 'scheduled'`),
    index("activity_challenge_digest_member_idx").on(d.memberId),
  ],
);
