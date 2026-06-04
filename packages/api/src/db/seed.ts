/**
 * Seeds the 2026 FIFA World Cup (spec Appendix A): 48 teams across 12 groups.
 * Idempotent — re-running replaces the existing WC2026 tournament + teams.
 *
 *   pnpm db:seed
 *
 * NOTE: verify against the official FIFA source at build time; this is the
 * post-draw seed as of the spec.
 */
import "dotenv/config";
import { eq, and } from "drizzle-orm";
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
  // Clear any prior copy so the seed is repeatable.
  const existing = await db
    .select({ id: tournament.id })
    .from(tournament)
    .where(and(eq(tournament.name, NAME), eq(tournament.year, YEAR)));
  for (const t of existing) {
    await db.delete(tournament).where(eq(tournament.id, t.id)); // teams cascade
  }

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
    .returning();

  const rows = Object.entries(GROUPS).flatMap(([groupLabel, teams]) =>
    teams.map(([name, flagCode]) => ({
      tournamentId: t.id,
      name,
      groupLabel,
      flagCode,
    })),
  );
  await db.insert(team).values(rows);

  console.log(`Seeded "${NAME}" — ${rows.length} teams across 12 groups.`);
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    pool.end();
    process.exit(1);
  });
