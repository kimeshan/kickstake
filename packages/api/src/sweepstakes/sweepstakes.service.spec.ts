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

  describe("savePrizes", () => {
    async function fresh(pot = 60000) {
      // pot = buyIn * players; pick buyIn so buyIn*players = pot
      return svc.create(organiserId, {
        tournamentId,
        name: "Editable",
        buyIn: pot / 6,
        expectedParticipants: 6,
      });
    }

    it("saves a structure that reconciles to the pot, replacing the old one", async () => {
      const s = await fresh(60000);
      const updated = await svc.savePrizes(organiserId, s.id, [
        { label: "Winner takes most", ruleType: "winner", amount: 50000, perGroup: false, enabled: true },
        { label: "Wooden spoon", ruleType: "custom", amount: 10000, perGroup: false, enabled: true },
      ]);
      expect(updated.prizeCategories).toHaveLength(2);
      expect(prizeTotal(updated.prizeCategories, 12)).toBe(60000);
      expect(updated.prizeCategories.some((p) => p.ruleType === "custom")).toBe(true);
    });

    it("counts per-group prizes × group count when reconciling", async () => {
      const s = await fresh(60000);
      // 5000 per group × 12 = 60000
      const updated = await svc.savePrizes(organiserId, s.id, [
        { label: "Top of group", ruleType: "group_top", amount: 5000, perGroup: true, enabled: true },
      ]);
      expect(prizeTotal(updated.prizeCategories, 12)).toBe(60000);
    });

    it("rejects a structure that doesn't total the pot", async () => {
      const s = await fresh(60000);
      await expect(
        svc.savePrizes(organiserId, s.id, [
          { label: "Short", ruleType: "winner", amount: 40000, perGroup: false, enabled: true },
        ]),
      ).rejects.toThrow(/pot/i);
    });

    it("ignores disabled prizes in the reconciliation", async () => {
      const s = await fresh(60000);
      const updated = await svc.savePrizes(organiserId, s.id, [
        { label: "Winner", ruleType: "winner", amount: 60000, perGroup: false, enabled: true },
        { label: "Off", ruleType: "custom", amount: 999, perGroup: false, enabled: false },
      ]);
      expect(prizeTotal(updated.prizeCategories, 12)).toBe(60000);
    });
  });
});
