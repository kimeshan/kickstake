import {
  pgTable,
  pgEnum,
  text,
  integer,
  timestamp,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Tournament format. v1 ships international cups; architecture allows more as data.
export const tournamentFormatEnum = pgEnum("tournament_format", [
  "international_cup",
  "club_competition",
]);

export const tournamentStatusEnum = pgEnum("tournament_status", [
  "upcoming",
  "active",
  "completed",
]);

export const tournament = pgTable("tournament", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  year: integer("year").notNull(),
  groupCount: integer("group_count").notNull(),
  teamCount: integer("team_count").notNull(),
  format: tournamentFormatEnum("format").notNull().default("international_cup"),
  // Pointer to an external results provider (API-Football etc.); null = manual only.
  dataSourceId: text("data_source_id"),
  status: tournamentStatusEnum("status").notNull().default("upcoming"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  // A tournament is unique by name + year — lets the seed upsert idempotently.
  uniqueIndex("tournament_name_year_idx").on(t.name, t.year),
]);

export const team = pgTable(
  "team",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournament.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    groupLabel: text("group_label").notNull(),
    // ISO-3166 alpha-2 (lowercase) for flag rendering, e.g. "br", "gb-eng".
    flagCode: text("flag_code"),
    // Ordinal strength within the tournament (1 = strongest), seeded from the
    // FIFA world ranking. Drives the tiered draw; null = tiering unavailable.
    strengthRank: integer("strength_rank"),
    // The results provider's team id, learned on first successful name match
    // so later syncs survive provider name quirks ("Korea Republic" etc.).
    externalRef: text("external_ref"),
  },
  (t) => [
    index("team_tournament_idx").on(t.tournamentId),
    // Unique per tournament — lets the seed upsert teams idempotently.
    uniqueIndex("team_tournament_name_idx").on(t.tournamentId, t.name),
  ],
);

// Tournament phases a match can belong to. WC2026 (48 teams) runs
// group → round_of_32 → … → final; smaller cups simply skip early rounds.
export const matchStageEnum = pgEnum("match_stage", [
  "group",
  "round_of_32",
  "round_of_16",
  "quarter_final",
  "semi_final",
  "third_place",
  "final",
]);

export const matchStatusEnum = pgEnum("match_status", [
  "scheduled",
  "in_play",
  "finished",
]);

// One row per tournament match, kept in sync by the results sync (cron or
// manual trigger). Team slots are nullable — knockout pairings are TBD until
// the previous round resolves.
export const match = pgTable(
  "match",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournament.id, { onDelete: "cascade" }),
    // Provider's match id (or "demo-…" from the dev seed). Sync upserts on it.
    externalId: text("external_id").notNull(),
    stage: matchStageEnum("stage").notNull(),
    // Set for group-stage matches only, e.g. "A".
    groupLabel: text("group_label"),
    kickoffAt: timestamp("kickoff_at"),
    homeTeamId: uuid("home_team_id").references(() => team.id),
    awayTeamId: uuid("away_team_id").references(() => team.id),
    // Final score after extra time, excluding any shoot-out.
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),
    homePenalties: integer("home_penalties"),
    awayPenalties: integer("away_penalties"),
    // Authoritative outcome (provider's `winner`) — covers shoot-outs.
    winnerTeamId: uuid("winner_team_id").references(() => team.id),
    status: matchStatusEnum("status").notNull().default("scheduled"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (m) => [
    index("match_tournament_idx").on(m.tournamentId),
    uniqueIndex("match_external_idx").on(m.tournamentId, m.externalId),
  ],
);

// Top scorers, synced from the results provider — powers the live Golden
// Boot leader. Replaced wholesale on each sync.
export const scorer = pgTable(
  "scorer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournament.id, { onDelete: "cascade" }),
    playerName: text("player_name").notNull(),
    // Null when the provider's team couldn't be matched to ours.
    teamId: uuid("team_id").references(() => team.id),
    goals: integer("goals").notNull().default(0),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (s) => [
    index("scorer_tournament_idx").on(s.tournamentId),
    uniqueIndex("scorer_tournament_player_idx").on(s.tournamentId, s.playerName),
  ],
);

export const tournamentRelations = relations(tournament, ({ many }) => ({
  teams: many(team),
  matches: many(match),
  scorers: many(scorer),
}));

export const scorerRelations = relations(scorer, ({ one }) => ({
  tournament: one(tournament, {
    fields: [scorer.tournamentId],
    references: [tournament.id],
  }),
  team: one(team, {
    fields: [scorer.teamId],
    references: [team.id],
  }),
}));

export const teamRelations = relations(team, ({ one }) => ({
  tournament: one(tournament, {
    fields: [team.tournamentId],
    references: [tournament.id],
  }),
}));

export const matchRelations = relations(match, ({ one }) => ({
  tournament: one(tournament, {
    fields: [match.tournamentId],
    references: [tournament.id],
  }),
  homeTeam: one(team, {
    fields: [match.homeTeamId],
    references: [team.id],
  }),
  awayTeam: one(team, {
    fields: [match.awayTeamId],
    references: [team.id],
  }),
}));
