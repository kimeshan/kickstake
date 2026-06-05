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
  },
  (t) => [
    index("team_tournament_idx").on(t.tournamentId),
    // Unique per tournament — lets the seed upsert teams idempotently.
    uniqueIndex("team_tournament_name_idx").on(t.tournamentId, t.name),
  ],
);

export const tournamentRelations = relations(tournament, ({ many }) => ({
  teams: many(team),
}));

export const teamRelations = relations(team, ({ one }) => ({
  tournament: one(tournament, {
    fields: [team.tournamentId],
    references: [tournament.id],
  }),
}));
