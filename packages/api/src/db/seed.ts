/**
 * Seeds the 2026 FIFA World Cup (spec Appendix A): 48 teams across 12 groups.
 *
 * Idempotent — upserts the tournament (by name+year) and each team (by
 * tournament+name). Safe to run on every deploy, like migrations: it never
 * deletes, so existing sweepstakes that reference the tournament are untouched.
 *
 *   pnpm db:seed          (local, via tsx)
 *   node dist/db/seed.js  (deploy, after migrations — see packages/api/Dockerfile)
 *
 * NOTE: verify against the official FIFA source at build time; this is the
 * post-draw seed as of the spec.
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db, pool } from "./index";
import { tournament, team } from "./schema";

const NAME = "2026 FIFA World Cup";
const YEAR = 2026;

// [name, ISO flag code, strength rank]. Scotland/England use the FIFA
// sub-region codes. The rank is the team's ORDINAL position among the 48
// qualifiers (1 = strongest) per the final pre-tournament FIFA world ranking
// (11 June 2026 edition); it drives the tiered draw.
const GROUPS: Record<string, [string, string, number][]> = {
  A: [["Mexico", "mx", 13], ["South Korea", "kr", 23], ["South Africa", "za", 40], ["Czechia", "cz", 32]],
  B: [["Canada", "ca", 27], ["Switzerland", "ch", 18], ["Qatar", "qa", 38], ["Bosnia-Herzegovina", "ba", 43]],
  C: [["Brazil", "br", 6], ["Morocco", "ma", 7], ["Scotland", "gb-sct", 34], ["Haiti", "ht", 47]],
  D: [["USA", "us", 16], ["Paraguay", "py", 33], ["Australia", "au", 24], ["Türkiye", "tr", 20]],
  E: [["Germany", "de", 10], ["Ecuador", "ec", 21], ["Ivory Coast", "ci", 29], ["Curaçao", "cw", 46]],
  F: [["Netherlands", "nl", 8], ["Japan", "jp", 17], ["Tunisia", "tn", 35], ["Sweden", "se", 31]],
  G: [["Belgium", "be", 9], ["Iran", "ir", 19], ["Egypt", "eg", 26], ["New Zealand", "nz", 48]],
  H: [["Spain", "es", 2], ["Uruguay", "uy", 15], ["Saudi Arabia", "sa", 41], ["Cape Verde", "cv", 44]],
  I: [["France", "fr", 3], ["Senegal", "sn", 14], ["Norway", "no", 28], ["Iraq", "iq", 39]],
  J: [["Argentina", "ar", 1], ["Austria", "at", 22], ["Algeria", "dz", 25], ["Jordan", "jo", 42]],
  K: [["Portugal", "pt", 5], ["Colombia", "co", 12], ["Uzbekistan", "uz", 37], ["DR Congo", "cd", 36]],
  L: [["England", "gb-eng", 4], ["Croatia", "hr", 11], ["Panama", "pa", 30], ["Ghana", "gh", 45]],
};

async function seed() {
  // Upsert the tournament by (name, year).
  const [t] = await db
    .insert(tournament)
    .values({
      name: NAME,
      year: YEAR,
      groupCount: 12,
      teamCount: 48,
      format: "international_cup",
      status: "upcoming",
      // football-data.org competition code — the results sync reads this.
      dataSourceId: "football-data:WC",
    })
    .onConflictDoUpdate({
      target: [tournament.name, tournament.year],
      set: { groupCount: 12, teamCount: 48, dataSourceId: "football-data:WC" },
    })
    .returning();

  // Upsert teams by (tournament_id, name); corrects group/flag/rank if changed.
  const rows = Object.entries(GROUPS).flatMap(([groupLabel, teams]) =>
    teams.map(([name, flagCode, strengthRank]) => ({
      tournamentId: t.id,
      name,
      groupLabel,
      flagCode,
      strengthRank,
    })),
  );

  // The ranks must be a permutation of 1..48 — a typo here would silently
  // skew the tiered draw.
  const ranks = rows.map((r) => r.strengthRank).sort((a, b) => a - b);
  if (!ranks.every((r, i) => r === i + 1))
    throw new Error("Seed strength ranks are not a permutation of 1..48.");

  await db
    .insert(team)
    .values(rows)
    .onConflictDoUpdate({
      target: [team.tournamentId, team.name],
      set: {
        groupLabel: sql`excluded.group_label`,
        flagCode: sql`excluded.flag_code`,
        strengthRank: sql`excluded.strength_rank`,
      },
    });

  console.log(`Seeded "${NAME}" — ${rows.length} teams across 12 groups.`);
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    pool.end();
    process.exit(1);
  });
