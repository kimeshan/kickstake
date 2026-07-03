/**
 * DEV/E2E ONLY — synthesizes WC2026 results so the live-prizes UI has data
 * without a football-data.org key: every group finished (group prizes
 * decided), round of 32 finished, round of 16 scheduled.
 *
 *   pnpm db:seed:demo
 *
 * Deterministic (seeded PRNG keyed on match id) and idempotent (upserts by
 * external id, "demo-…"). Never wired into the deploy pipeline — production
 * gets real results from the provider sync instead.
 */
import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "./index";
import { tournament, team, match, scorer } from "./schema";
import { groupStandings, type EngineMatch } from "../results/engine";

const NAME = "2026 FIFA World Cup";
const YEAR = 2026;

// Tiny deterministic PRNG (same family as draw.ts).
function rng(seedStr: string): () => number {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface TeamRow {
  id: string;
  name: string;
  groupLabel: string;
  strengthRank: number | null;
}

/** Plausible score: the stronger side scores more, upsets happen sometimes. */
function score(externalId: string, home: TeamRow, away: TeamRow) {
  const rand = rng(externalId);
  const edge = ((away.strengthRank ?? 24) - (home.strengthRank ?? 24)) / 47; // -1..1, + = home stronger
  const homeGoals = Math.max(0, Math.round(rand() * 2.6 + edge * 1.6));
  const awayGoals = Math.max(0, Math.round(rand() * 2.6 - edge * 1.6));
  return { homeGoals, awayGoals };
}

type MatchInsert = typeof match.$inferInsert;

async function seedDemoResults() {
  const t = await db.query.tournament.findFirst({
    where: sql`${tournament.name} = ${NAME} and ${tournament.year} = ${YEAR}`,
  });
  if (!t) throw new Error(`Tournament "${NAME}" not seeded — run pnpm db:seed first.`);

  const teams: TeamRow[] = await db.query.team.findMany({
    where: eq(team.tournamentId, t.id),
  });
  const byGroup = new Map<string, TeamRow[]>();
  for (const row of teams) {
    if (!byGroup.has(row.groupLabel)) byGroup.set(row.groupLabel, []);
    byGroup.get(row.groupLabel)!.push(row);
  }

  const rows: MatchInsert[] = [];
  const kickoff = (dayOffset: number) =>
    new Date(Date.UTC(2026, 5, 11 + dayOffset, 18, 0, 0)); // Jun 11 2026 + offset

  // Group stage: every pairing in every group, finished.
  const engineByGroup = new Map<string, EngineMatch[]>();
  for (const [label, groupTeams] of [...byGroup.entries()].sort()) {
    const engineMatches: EngineMatch[] = [];
    let n = 0;
    for (let i = 0; i < groupTeams.length; i++) {
      for (let j = i + 1; j < groupTeams.length; j++) {
        const home = groupTeams[i];
        const away = groupTeams[j];
        const externalId = `demo-group-${label}-${++n}`;
        const { homeGoals, awayGoals } = score(externalId, home, away);
        rows.push({
          tournamentId: t.id,
          externalId,
          stage: "group",
          groupLabel: label,
          kickoffAt: kickoff(n * 2),
          homeTeamId: home.id,
          awayTeamId: away.id,
          homeScore: homeGoals,
          awayScore: awayGoals,
          winnerTeamId:
            homeGoals > awayGoals ? home.id : awayGoals > homeGoals ? away.id : null,
          status: "finished",
        });
        engineMatches.push({
          stage: "group",
          groupLabel: label,
          homeTeamId: home.id,
          awayTeamId: away.id,
          homeScore: homeGoals,
          awayScore: awayGoals,
          winnerTeamId: null,
          status: "finished",
        });
      }
    }
    engineByGroup.set(label, engineMatches);
  }

  // Qualifiers: 12 group winners + 12 runners-up + 8 best third-placed.
  const winners: TeamRow[] = [];
  const runnersUp: TeamRow[] = [];
  const thirds: { row: TeamRow; points: number; gd: number; gf: number }[] = [];
  for (const [label, groupTeams] of [...byGroup.entries()].sort()) {
    const table = groupStandings(
      groupTeams.map((x) => x.id),
      engineByGroup.get(label)!,
    );
    const byId = new Map(groupTeams.map((x) => [x.id, x]));
    winners.push(byId.get(table[0].teamId)!);
    runnersUp.push(byId.get(table[1].teamId)!);
    const third = table[2];
    thirds.push({
      row: byId.get(third.teamId)!,
      points: third.points,
      gd: third.goalDifference,
      gf: third.goalsFor,
    });
  }
  const bestThirds = thirds
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf)
    .slice(0, 8)
    .map((x) => x.row);

  // Round of 32 — finished. Simple deterministic pairing: strongest seed
  // pot vs weakest (real FIFA bracket slotting doesn't matter for demo data).
  const seeds = [...winners, ...runnersUp, ...bestThirds];
  const r32Winners: TeamRow[] = [];
  for (let i = 0; i < 16; i++) {
    const home = seeds[i];
    const away = seeds[31 - i];
    const externalId = `demo-r32-${i + 1}`;
    const { homeGoals, awayGoals } = score(externalId, home, away);
    let pens: { home: number; away: number } | null = null;
    if (homeGoals === awayGoals) {
      // Knockouts need a winner — send drawn games to a shoot-out.
      const r = rng(`${externalId}-pens`);
      pens = r() < 0.5 ? { home: 4, away: 3 } : { home: 3, away: 4 };
    }
    const winner =
      homeGoals > awayGoals || (pens && pens.home > pens.away) ? home : away;
    r32Winners.push(winner);
    rows.push({
      tournamentId: t.id,
      externalId,
      stage: "round_of_32",
      groupLabel: null,
      kickoffAt: kickoff(17 + Math.floor(i / 4)),
      homeTeamId: home.id,
      awayTeamId: away.id,
      homeScore: homeGoals,
      awayScore: awayGoals,
      homePenalties: pens?.home ?? null,
      awayPenalties: pens?.away ?? null,
      winnerTeamId: winner.id,
      status: "finished",
    });
  }

  // Round of 16 — pairings known, not yet played.
  for (let i = 0; i < 8; i++) {
    rows.push({
      tournamentId: t.id,
      externalId: `demo-r16-${i + 1}`,
      stage: "round_of_16",
      groupLabel: null,
      kickoffAt: kickoff(23 + Math.floor(i / 4)),
      homeTeamId: r32Winners[i * 2].id,
      awayTeamId: r32Winners[i * 2 + 1].id,
      status: "scheduled",
    });
  }

  for (const values of rows) {
    await db
      .insert(match)
      .values(values)
      .onConflictDoUpdate({
        target: [match.tournamentId, match.externalId],
        set: { ...values, updatedAt: new Date() },
      });
  }

  // Top scorers — powers the live Golden Boot leader. Fictional players on
  // real teams; the unique top makes the leader deterministic.
  const teamIdByName = new Map(teams.map((x) => [x.name, x.id]));
  const demoScorers: [string, string, number][] = [
    ["D. Herrera", "Argentina", 5],
    ["Y. Diallo", "France", 4],
    ["T. Whitmore", "England", 4],
    ["R. Cardoso", "Brazil", 3],
    ["L. Brandt", "Germany", 3],
  ];
  await db.transaction(async (tx) => {
    await tx.delete(scorer).where(eq(scorer.tournamentId, t.id));
    await tx.insert(scorer).values(
      demoScorers.map(([playerName, teamName, goals]) => ({
        tournamentId: t.id,
        playerName,
        teamId: teamIdByName.get(teamName) ?? null,
        goals,
      })),
    );
  });

  console.log(
    `Seeded ${rows.length} demo matches + ${demoScorers.length} demo scorers ` +
      `for "${NAME}" (groups + R32 finished, R16 scheduled).`,
  );
}

seedDemoResults()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    pool.end();
    process.exit(1);
  });
