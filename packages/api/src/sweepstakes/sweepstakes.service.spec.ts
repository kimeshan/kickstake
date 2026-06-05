import { db, pool } from "../db";
import { user, tournament } from "../db/schema";
import { SweepstakesService } from "./sweepstakes.service";
import { prizeTotal } from "./prize-generation";

describe("SweepstakesService (DB integration)", () => {
  const svc = new SweepstakesService();
  const organiserId = "svc-org";
  const otherId = "svc-other";
  let tournamentId: string;

  beforeAll(async () => {
    await db.insert(user).values([
      { id: organiserId, name: "Org", email: "svc-org@test.dev" },
      { id: otherId, name: "Other", email: "svc-other@test.dev" },
    ]);
    const [t] = await db
      .insert(tournament)
      .values({ name: "Service Cup", year: 2030, groupCount: 12, teamCount: 48 })
      .returning();
    tournamentId = t.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates a draft with a prize pot that reconciles to the designed pot", async () => {
    const s = await svc.create(organiserId, {
      tournamentId,
      name: "  Family WC  ",
      buyIn: 15000,
      donation: 20000,
      expectedParticipants: 12,
    });
    expect(s.status).toBe("draft");
    expect(s.name).toBe("Family WC"); // trimmed
    expect(s.joinToken).toHaveLength(8);
    const designedPot = 15000 * 12 + 20000; // 200000
    expect(s.designedPot).toBe(designedPot);
    expect(s.prizeCategories).toHaveLength(12);
    expect(prizeTotal(s.prizeCategories, 12)).toBe(designedPot);
  });

  it("lists the organiser's sweepstakes", async () => {
    const list = await svc.list(organiserId);
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  it("hides another organiser's sweepstake (ownership)", async () => {
    const s = await svc.create(organiserId, {
      tournamentId,
      name: "Private",
      buyIn: 10000,
      expectedParticipants: 5,
    });
    await expect(svc.findOne(otherId, s.id)).rejects.toThrow(/not your/i);
  });

  it("rejects a zero pot", async () => {
    await expect(
      svc.create(organiserId, {
        tournamentId,
        name: "Free",
        buyIn: 0,
        donation: 0,
        expectedParticipants: 4,
      }),
    ).rejects.toThrow(/pot/i);
  });

  it("requires at least 2 participants", async () => {
    await expect(
      svc.create(organiserId, {
        tournamentId,
        name: "Solo",
        buyIn: 1000,
        expectedParticipants: 1,
      }),
    ).rejects.toThrow(/participants/i);
  });

  it("rejects an unknown tournament", async () => {
    await expect(
      svc.create(organiserId, {
        tournamentId: "00000000-0000-0000-0000-000000000000",
        name: "Ghost",
        buyIn: 1000,
        expectedParticipants: 4,
      }),
    ).rejects.toThrow(/tournament/i);
  });
});
