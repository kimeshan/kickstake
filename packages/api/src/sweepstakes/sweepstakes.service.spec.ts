import { eq } from "drizzle-orm";
import { db, pool } from "../db";
import { user, tournament, team, participant } from "../db/schema";
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

  describe("update (currency)", () => {
    it("relabels without changing amounts between same-decimal currencies", async () => {
      const s = await svc.create(organiserId, {
        tournamentId,
        name: "Cur",
        currency: "USD",
        buyIn: 1000,
        expectedParticipants: 5,
      });
      const u = await svc.update(organiserId, s.id, { currency: "EUR" });
      expect(u.currency).toBe("EUR");
      expect(u.buyIn).toBe(1000); // USD & EUR both 2dp → unchanged
    });

    it("re-denominates when the decimal places differ (USD → JPY)", async () => {
      const s = await svc.create(organiserId, {
        tournamentId,
        name: "Cur2",
        currency: "USD",
        buyIn: 1500, // $15.00
        expectedParticipants: 4,
      });
      const u = await svc.update(organiserId, s.id, { currency: "JPY" });
      expect(u.currency).toBe("JPY");
      expect(u.buyIn).toBe(15); // ¥15, major value preserved
    });
  });

  describe("participant management", () => {
    async function withPlayers(n: number) {
      const s = await svc.create(organiserId, {
        tournamentId,
        name: "Players",
        buyIn: 1000,
        expectedParticipants: Math.max(2, n),
      });
      await db.insert(participant).values(
        Array.from({ length: n }, (_, i) => ({
          sweepstakeId: s.id,
          displayName: `P${i}`,
          amountDue: 1000,
        })),
      );
      return s;
    }

    it("edits a player's name and paid flag", async () => {
      const s = await withPlayers(2);
      const p = (await db.select().from(participant).where(eq(participant.sweepstakeId, s.id)))[0];
      const u = await svc.updateParticipant(organiserId, s.id, p.id, {
        displayName: "Renamed",
        paid: true,
      });
      const edited = u.participants.find((x) => x.id === p.id)!;
      expect(edited.displayName).toBe("Renamed");
      expect(edited.paid).toBe(true);
    });

    it("removes a player before the draw", async () => {
      const s = await withPlayers(3);
      const p = (await db.select().from(participant).where(eq(participant.sweepstakeId, s.id)))[0];
      const u = await svc.removeParticipant(organiserId, s.id, p.id);
      expect(u.participants).toHaveLength(2);
    });
  });

  describe("draw", () => {
    let drawTid: string;
    let teamIds: string[];

    beforeAll(async () => {
      const [dt] = await db
        .insert(tournament)
        .values({ name: "Draw Cup", year: 2032, groupCount: 2, teamCount: 6 })
        .returning();
      drawTid = dt.id;
      const rows = await db
        .insert(team)
        .values(
          Array.from({ length: 6 }, (_, i) => ({
            tournamentId: dt.id,
            name: `Team ${i}`,
            groupLabel: i < 3 ? "A" : "B",
          })),
        )
        .returning();
      teamIds = rows.map((r) => r.id);
    });

    async function withPlayers(n: number) {
      const s = await svc.create(organiserId, {
        tournamentId: drawTid,
        name: "DrawStake",
        buyIn: 1000,
        expectedParticipants: Math.max(2, n),
      });
      await db.insert(participant).values(
        Array.from({ length: n }, (_, i) => ({
          sweepstakeId: s.id,
          displayName: `D${i}`,
          amountDue: 1000,
        })),
      );
      const parts = await db
        .select()
        .from(participant)
        .where(eq(participant.sweepstakeId, s.id));
      return { s, parts };
    }

    it("blocks the draw with fewer than 2 players", async () => {
      const { s } = await withPlayers(1);
      await expect(svc.draw(organiserId, s.id, { mode: "random" })).rejects.toThrow(
        /2 players/i,
      );
    });

    it("randomly assigns every team and locks the sweepstake", async () => {
      const { s } = await withPlayers(3);
      const d = await svc.draw(organiserId, s.id, { mode: "random" });
      expect(d.status).toBe("drawn");
      expect(d.assignments).toHaveLength(6);
      expect(new Set(d.assignments.map((a) => a.teamId)).size).toBe(6);
      expect(d.drawSeed).toBeTruthy();
    });

    it("accepts a complete manual assignment", async () => {
      const { s, parts } = await withPlayers(2);
      const manual = teamIds.map((tid, i) => ({
        teamId: tid,
        participantId: parts[i % parts.length].id,
      }));
      const d = await svc.draw(organiserId, s.id, { mode: "manual", assignments: manual });
      expect(d.status).toBe("drawn");
      expect(d.drawSeed).toBeNull();
      expect(d.assignments).toHaveLength(6);
    });

    it("rejects an incomplete manual assignment", async () => {
      const { s, parts } = await withPlayers(2);
      await expect(
        svc.draw(organiserId, s.id, {
          mode: "manual",
          assignments: [{ teamId: teamIds[0], participantId: parts[0].id }],
        }),
      ).rejects.toThrow(/every team/i);
    });

    it("can be re-run (no lock-in) — assignments are replaced, still 6", async () => {
      const { s } = await withPlayers(2);
      await svc.draw(organiserId, s.id, { mode: "random" });
      const again = await svc.draw(organiserId, s.id, { mode: "random" });
      expect(again.status).toBe("drawn");
      expect(again.assignments).toHaveLength(6);
    });

    it("keeps joining open after the draw until the admin closes it", async () => {
      const { s } = await withPlayers(2);
      await svc.draw(organiserId, s.id, { mode: "random" });
      // still joinable after drawing
      await expect(
        svc.join(s.joinToken, { displayName: "Latecomer" }),
      ).resolves.toBeDefined();
      // close it
      await svc.update(organiserId, s.id, { joinClosed: true });
      await expect(
        svc.join(s.joinToken, { displayName: "TooLate" }),
      ).rejects.toThrow(/closed/i);
    });

    it("only reveals the draw to players once finalized", async () => {
      const { s } = await withPlayers(2);
      await svc.draw(organiserId, s.id, { mode: "random" });
      expect((await svc.publicView(s.joinToken)).draw).toBeNull();
      await svc.update(organiserId, s.id, { finalized: true });
      expect((await svc.publicView(s.joinToken)).draw).toHaveLength(6);
    });

    it("won't finalize before a draw has run", async () => {
      const { s } = await withPlayers(2);
      await expect(
        svc.update(organiserId, s.id, { finalized: true }),
      ).rejects.toThrow(/draw/i);
    });
  });
});
