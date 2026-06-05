import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";
import { tournament, team } from "./tournament";

// --- Enums -----------------------------------------------------------------

// Lifecycle state machine (spec §2): draft → open → drawn → live → settled
export const sweepstakeStatusEnum = pgEnum("sweepstake_status", [
  "draft",
  "open",
  "drawn",
  "live",
  "settled",
]);

// What happens to the T mod N remainder teams at draw time (spec §4)
export const remainderPolicyEnum = pgEnum("remainder_policy", [
  "spread_fairly",
  "to_pot",
]);

// Prize rule types (spec §6). `custom` for organiser-defined prizes.
export const ruleTypeEnum = pgEnum("rule_type", [
  "winner",
  "runner_up",
  "third_place",
  "group_top",
  "group_bottom",
  "player_of_tournament",
  "golden_boot",
  "most_cards",
  "least_conceded",
  "most_possession",
  "least_possession",
  "biggest_loss",
  "custom",
]);

// Every prize result starts pending; nothing is final until approved (spec §0.2)
export const prizeResultStatusEnum = pgEnum("prize_result_status", [
  "pending_approval",
  "approved",
  "manual_override",
]);

// --- Tables ----------------------------------------------------------------

export const sweepstake = pgTable(
  "sweepstake",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Organiser is a Better Auth user.
    organiserId: text("organiser_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournament.id),
    name: text("name").notNull(),
    // ISO-4217 code, e.g. "ZAR". Drives minor-unit math.
    currency: text("currency").notNull().default("ZAR"),
    // All money fields are integers in the currency's MINOR unit (e.g. cents).
    buyIn: integer("buy_in").notNull().default(0),
    donation: integer("donation").notNull().default(0),
    // Pot the prize structure was designed against (participant count isn't
    // final at creation). Reconciled / rescaled at draw time (spec §3.1).
    designedPot: integer("designed_pot").notNull().default(0),
    status: sweepstakeStatusEnum("status").notNull().default("draft"),
    joinToken: text("join_token").notNull(),
    // Stored for provably-fair, reproducible draws (spec §4).
    drawSeed: text("draw_seed"),
    drawAlgoVersion: integer("draw_algo_version"),
    remainderPolicy: remainderPolicyEnum("remainder_policy")
      .notNull()
      .default("spread_fairly"),
    // Admin-controlled, independent of the draw (spec gives the organiser full
    // control): join_closed stops new joiners; finalized reveals the drawn
    // teams to players. The draw stays re-runnable either way.
    joinClosed: boolean("join_closed").notNull().default(false),
    finalized: boolean("finalized").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (s) => [
    uniqueIndex("sweepstake_join_token_idx").on(s.joinToken),
    index("sweepstake_organiser_idx").on(s.organiserId),
  ],
);

export const participant = pgTable(
  "participant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sweepstakeId: uuid("sweepstake_id")
      .notNull()
      .references(() => sweepstake.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    email: text("email"),
    paid: boolean("paid").notNull().default(false),
    // Snapshotted at join (minor units) so settlement is stable.
    amountDue: integer("amount_due").notNull().default(0),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (p) => [index("participant_sweepstake_idx").on(p.sweepstakeId)],
);

// One row per team in the sweepstake. participantId null = owned by the pot.
export const teamAssignment = pgTable(
  "team_assignment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sweepstakeId: uuid("sweepstake_id")
      .notNull()
      .references(() => sweepstake.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => team.id),
    participantId: uuid("participant_id").references(() => participant.id, {
      onDelete: "set null",
    }),
  },
  (a) => [
    index("assignment_sweepstake_idx").on(a.sweepstakeId),
    uniqueIndex("assignment_unique_team_idx").on(a.sweepstakeId, a.teamId),
  ],
);

export const prizeCategory = pgTable(
  "prize_category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sweepstakeId: uuid("sweepstake_id")
      .notNull()
      .references(() => sweepstake.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    description: text("description"),
    ruleType: ruleTypeEnum("rule_type").notNull(),
    // Minor units. For per-group prizes this is the PER-GROUP amount.
    amount: integer("amount").notNull().default(0),
    perGroup: boolean("per_group").notNull().default(false),
    enabled: boolean("enabled").notNull().default(true),
  },
  (c) => [index("prize_category_sweepstake_idx").on(c.sweepstakeId)],
);

export const prizeResult = pgTable(
  "prize_result",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    prizeCategoryId: uuid("prize_category_id")
      .notNull()
      .references(() => prizeCategory.id, { onDelete: "cascade" }),
    // Set for per-group prizes (one result per group).
    groupLabel: text("group_label"),
    winningTeamId: uuid("winning_team_id").references(() => team.id),
    winningParticipantId: uuid("winning_participant_id").references(
      () => participant.id,
      { onDelete: "set null" },
    ),
    status: prizeResultStatusEnum("status")
      .notNull()
      .default("pending_approval"),
    approvedBy: text("approved_by").references(() => user.id),
    approvedAt: timestamp("approved_at"),
  },
  (r) => [index("prize_result_category_idx").on(r.prizeCategoryId)],
);

// --- Relations -------------------------------------------------------------

export const sweepstakeRelations = relations(sweepstake, ({ one, many }) => ({
  organiser: one(user, {
    fields: [sweepstake.organiserId],
    references: [user.id],
  }),
  tournament: one(tournament, {
    fields: [sweepstake.tournamentId],
    references: [tournament.id],
  }),
  participants: many(participant),
  assignments: many(teamAssignment),
  prizeCategories: many(prizeCategory),
}));

export const participantRelations = relations(
  participant,
  ({ one, many }) => ({
    sweepstake: one(sweepstake, {
      fields: [participant.sweepstakeId],
      references: [sweepstake.id],
    }),
    assignments: many(teamAssignment),
  }),
);

export const teamAssignmentRelations = relations(teamAssignment, ({ one }) => ({
  sweepstake: one(sweepstake, {
    fields: [teamAssignment.sweepstakeId],
    references: [sweepstake.id],
  }),
  team: one(team, {
    fields: [teamAssignment.teamId],
    references: [team.id],
  }),
  participant: one(participant, {
    fields: [teamAssignment.participantId],
    references: [participant.id],
  }),
}));

export const prizeCategoryRelations = relations(
  prizeCategory,
  ({ one, many }) => ({
    sweepstake: one(sweepstake, {
      fields: [prizeCategory.sweepstakeId],
      references: [sweepstake.id],
    }),
    results: many(prizeResult),
  }),
);

export const prizeResultRelations = relations(prizeResult, ({ one }) => ({
  category: one(prizeCategory, {
    fields: [prizeResult.prizeCategoryId],
    references: [prizeCategory.id],
  }),
  winningTeam: one(team, {
    fields: [prizeResult.winningTeamId],
    references: [team.id],
  }),
  winningParticipant: one(participant, {
    fields: [prizeResult.winningParticipantId],
    references: [participant.id],
  }),
}));
