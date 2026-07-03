import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createApp } from "../create-app";
import { db, pool } from "../db";
import { tournament, team, match } from "../db/schema";
import { testOtpStore } from "../email/email";
import { ResultsService } from "./results.service";
import { resolveTeamId, normalizeTeamName } from "./football-data";

/**
 * End-to-end: draw a sweepstake, store match results, recompute, and check
 * the live payload + persisted prize results the way the web app sees them.
 */
describe("Live prize results", () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication["getHttpServer"]>;
  let results: ResultsService;
  let tournamentId: string;
  // Group A: a1, a2 — Group B: b1, b2.
  const teamIds: Record<string, string> = {};

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    server = app.getHttpServer();
    results = app.get(ResultsService);

    const [t] = await db
      .insert(tournament)
      .values({ name: "Results Cup", year: 2031, groupCount: 2, teamCount: 4 })
      .returning();
    tournamentId = t.id;
    for (const [name, groupLabel] of [
      ["Alpha", "A"],
      ["Aster", "A"],
      ["Bravo", "B"],
      ["Basil", "B"],
    ] as const) {
      const [row] = await db
        .insert(team)
        .values({ tournamentId, name, groupLabel, flagCode: "br" })
        .returning();
      teamIds[name] = row.id;
    }
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  async function signIn(email: string) {
    const agent = request.agent(server);
    await agent
      .post("/auth/email-otp/send-verification-otp")
      .send({ email, type: "sign-in" })
      .expect(200);
    await agent
      .post("/auth/sign-in/email-otp")
      .send({ email, otp: testOtpStore.get(email) })
      .expect(200);
    return agent;
  }

  it("computes live winnings, persists approved results, flips drawn → live", async () => {
    const agent = await signIn("results-org@kickstake.dev");

    // Create → join twice → manual draw (Ann gets group A, Ben gets group B).
    const created = await agent
      .post("/sweepstakes")
      .send({ tournamentId, name: "Live Cup", buyIn: 10000, expectedParticipants: 2 })
      .expect(201);
    const id = created.body.id;
    const token = created.body.joinToken;
    expect(created.body.live).toBeNull(); // not drawn yet

    for (const displayName of ["Ann", "Ben"])
      await request(server)
        .post(`/j/${token}/participants`)
        .send({ displayName })
        .expect(201);
    const detail = await agent.get(`/sweepstakes/${id}`).expect(200);
    const ann = detail.body.participants.find(
      (p: { displayName: string }) => p.displayName === "Ann",
    );
    const ben = detail.body.participants.find(
      (p: { displayName: string }) => p.displayName === "Ben",
    );

    await agent
      .post(`/sweepstakes/${id}/draw`)
      .send({
        mode: "manual",
        assignments: [
          { teamId: teamIds.Alpha, participantId: ann.id },
          { teamId: teamIds.Aster, participantId: ann.id },
          { teamId: teamIds.Bravo, participantId: ben.id },
          { teamId: teamIds.Basil, participantId: ben.id },
        ],
      })
      .expect(201);

    // Group A decided (Alpha top), group B unplayed, final Alpha v Bravo won
    // by Bravo.
    await db.insert(match).values([
      {
        tournamentId,
        externalId: "t-a",
        stage: "group",
        groupLabel: "A",
        homeTeamId: teamIds.Alpha,
        awayTeamId: teamIds.Aster,
        homeScore: 2,
        awayScore: 0,
        winnerTeamId: teamIds.Alpha,
        status: "finished",
      },
      {
        tournamentId,
        externalId: "t-f",
        stage: "final",
        homeTeamId: teamIds.Alpha,
        awayTeamId: teamIds.Bravo,
        homeScore: 1,
        awayScore: 2,
        winnerTeamId: teamIds.Bravo,
        status: "finished",
      },
    ]);

    await results.recomputeTournament(tournamentId);

    const s = await agent.get(`/sweepstakes/${id}`).expect(200);
    expect(s.body.status).toBe("live");
    const live = s.body.live;
    expect(live).not.toBeNull();

    // Decided: group_top/bottom A, winner (Bravo/Ben), runner_up (Alpha/Ann).
    const byRule = (rule: string, group: string | null = null) =>
      live.prizes.find(
        (p: { ruleType: string; groupLabel: string | null }) =>
          p.ruleType === rule && p.groupLabel === group,
      );
    expect(byRule("group_top", "A")).toMatchObject({
      decided: true,
      winner: { name: "Alpha", participantName: "Ann" },
    });
    expect(byRule("group_top", "B").decided).toBe(false);
    expect(byRule("winner")).toMatchObject({
      decided: true,
      winner: { name: "Bravo", participantName: "Ben" },
    });
    expect(byRule("golden_boot")).toMatchObject({ computable: false });

    // Leaderboard: won = sum of decided prizes owned. Ben still has group B
    // prizes in play; Ann's remaining teams are all eliminated.
    const lb = Object.fromEntries(
      live.leaderboard.map((e: { displayName: string }) => [e.displayName, e]),
    );
    // Tournament complete (final played) → stat prizes settle too: Ann's
    // Aster suffered the biggest loss, Ben's Basil conceded least.
    const expectAnn =
      byRule("group_top", "A").amount +
      byRule("group_bottom", "A").amount +
      byRule("runner_up").amount +
      byRule("biggest_loss").amount;
    expect(lb.Ann.won).toBe(expectAnn);
    expect(lb.Ben.won).toBe(
      byRule("winner").amount + byRule("least_conceded").amount,
    );
    expect(lb.Ben.inPlay).toBeGreaterThan(0);
    expect(lb.Ann.inPlay).toBe(0);

    // Bracket carries participant names for the "Ann vs Ben" display.
    const final = live.bracket.find(
      (b: { stage: string }) => b.stage === "final",
    );
    expect(final.matches[0].home).toMatchObject({
      name: "Alpha",
      participantName: "Ann",
    });

    // Persisted, auto-approved results exist.
    const stored = await db.query.prizeResult.findMany();
    expect(stored.length).toBeGreaterThanOrEqual(4);
    expect(stored.every((r) => r.status === "approved")).toBe(true);

    // Public view: hidden until finalized, then visible.
    const hidden = await request(server).get(`/j/${token}`).expect(200);
    expect(hidden.body.live).toBeNull();
    await agent.patch(`/sweepstakes/${id}`).send({ finalized: true }).expect(200);
    const shown = await request(server).get(`/j/${token}`).expect(200);
    expect(shown.body.live.leaderboard).toHaveLength(2);

    // Recompute is idempotent — no duplicate rows on a second run.
    await results.recomputeTournament(tournamentId);
    const again = await db.query.prizeResult.findMany();
    expect(again.length).toBe(stored.length);

    // Manual sync endpoint works without a provider key (recompute only).
    const sync = await agent
      .post(`/tournaments/${tournamentId}/sync-results`)
      .expect(201);
    expect(sync.body).toMatchObject({ matchesUpserted: 0 });
  });
});

describe("provider team matching", () => {
  const teams = [
    { id: "1", name: "South Korea", externalRef: null },
    { id: "2", name: "Türkiye", externalRef: null },
    { id: "3", name: "Ivory Coast", externalRef: "900" },
    { id: "4", name: "Bosnia-Herzegovina", externalRef: null },
  ];

  it("normalizes diacritics and punctuation", () => {
    expect(normalizeTeamName("Côte d’Ivoire")).toBe("cotedivoire");
    expect(normalizeTeamName("Bosnia-Herzegovina")).toBe("bosniaherzegovina");
  });

  it("resolves provider spellings via aliases, externalRef first", () => {
    expect(resolveTeamId({ externalId: null, name: "Korea Republic" }, teams)).toBe("1");
    expect(resolveTeamId({ externalId: null, name: "Turkey" }, teams)).toBe("2");
    expect(resolveTeamId({ externalId: null, name: "Türkiye" }, teams)).toBe("2");
    expect(resolveTeamId({ externalId: "900", name: "Whatever FC" }, teams)).toBe("3");
    expect(
      resolveTeamId({ externalId: null, name: "Bosnia and Herzegovina" }, teams),
    ).toBe("4");
    expect(resolveTeamId({ externalId: null, name: "Atlantis" }, teams)).toBeNull();
  });
});
