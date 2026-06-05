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

// [name, ISO flag code]. Scotland/England use the FIFA sub-region codes.
const GROUPS: Record<string, [string, string][]> = {
  A: [["Mexico", "mx"], ["South Korea", "kr"], ["South Africa", "za"], ["Czechia", "cz"]],
  B: [["Canada", "ca"], ["Switzerland", "ch"], ["Qatar", "qa"], ["Bosnia-Herzegovina", "ba"]],
  C: [["Brazil", "br"], ["Morocco", "ma"], ["Scotland", "gb-sct"], ["Haiti", "ht"]],
  D: [["USA", "us"], ["Paraguay", "py"], ["Australia", "au"], ["Türkiye", "tr"]],
  E: [["Germany", "de"], ["Ecuador", "ec"], ["Ivory Coast", "ci"], ["Curaçao", "cw"]],
  F: [["Netherlands", "nl"], ["Japan", "jp"], ["Tunisia", "tn"], ["Sweden", "se"]],
  G: [["Belgium", "be"], ["Iran", "ir"], ["Egypt", "eg"], ["New Zealand", "nz"]],
  H: [["Spain", "es"], ["Uruguay", "uy"], ["Saudi Arabia", "sa"], ["Cape Verde", "cv"]],
  I: [["France", "fr"], ["Senegal", "sn"], ["Norway", "no"], ["Iraq", "iq"]],
  J: [["Argentina", "ar"], ["Austria", "at"], ["Algeria", "dz"], ["Jordan", "jo"]],
  K: [["Portugal", "pt"], ["Colombia", "co"], ["Uzbekistan", "uz"], ["DR Congo", "cd"]],
  L: [["England", "gb-eng"], ["Croatia", "hr"], ["Panama", "pa"], ["Ghana", "gh"]],
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
    })
    .onConflictDoUpdate({
      target: [tournament.name, tournament.year],
      set: { groupCount: 12, teamCount: 48 },
    })
    .returning();

  // Upsert teams by (tournament_id, name); corrects group/flag if changed.
  const rows = Object.entries(GROUPS).flatMap(([groupLabel, teams]) =>
    teams.map(([name, flagCode]) => ({
      tournamentId: t.id,
      name,
      groupLabel,
      flagCode,
    })),
  );
  await db
    .insert(team)
    .values(rows)
    .onConflictDoUpdate({
      target: [team.tournamentId, team.name],
      set: {
        groupLabel: sql`excluded.group_label`,
        flagCode: sql`excluded.flag_code`,
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
