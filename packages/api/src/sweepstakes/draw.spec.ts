import { runDraw, runTieredDraw, type RankedTeam } from "./draw";

const teams = Array.from({ length: 48 }, (_, i) => `t${i}`);

// Ranked teams in scrambled input order — the draw must sort, not trust input.
const ranked: RankedTeam[] = Array.from({ length: 48 }, (_, i) => ({
  id: `t${i}`,
  strengthRank: i + 1,
})).reverse();

const rankOf = (teamId: string) => parseInt(teamId.slice(1), 10) + 1;

describe("runDraw", () => {
  it("assigns every team exactly once", () => {
    const a = runDraw(teams, ["p1", "p2", "p3"], "seed", "spread_fairly");
    expect(a).toHaveLength(48);
    expect(new Set(a.map((x) => x.teamId)).size).toBe(48);
  });

  it("is reproducible for the same seed", () => {
    const opts = ["p1", "p2", "p3", "p4", "p5"] as const;
    expect(runDraw(teams, [...opts], "abc", "spread_fairly")).toEqual(
      runDraw(teams, [...opts], "abc", "spread_fairly"),
    );
  });

  it("differs for a different seed", () => {
    const a = runDraw(teams, ["p1", "p2", "p3", "p4", "p5"], "abc", "spread_fairly");
    const b = runDraw(teams, ["p1", "p2", "p3", "p4", "p5"], "xyz", "spread_fairly");
    expect(a).not.toEqual(b);
  });

  it("sends the remainder to the pot under to_pot (48 / 5 → 3 to pot)", () => {
    const a = runDraw(teams, ["p1", "p2", "p3", "p4", "p5"], "s", "to_pot");
    expect(a.filter((x) => x.participantId === null)).toHaveLength(3);
  });

  it("spreads the remainder to players by default (none to pot)", () => {
    const a = runDraw(teams, ["p1", "p2", "p3", "p4", "p5"], "s", "spread_fairly");
    expect(a.filter((x) => x.participantId === null)).toHaveLength(0);
  });

  it("does NOT require players === teams — 24 players get 2 each", () => {
    const players = Array.from({ length: 24 }, (_, i) => `p${i}`);
    const a = runDraw(teams, players, "s", "spread_fairly");
    const counts = new Map<string | null, number>();
    a.forEach((x) => counts.set(x.participantId, (counts.get(x.participantId) ?? 0) + 1));
    expect([...counts.values()].every((c) => c === 2)).toBe(true);
  });
});

describe("runTieredDraw", () => {
  it("assigns every team exactly once, with a tier", () => {
    const a = runTieredDraw(ranked, ["p1", "p2", "p3"], "seed", "spread_fairly");
    expect(a).toHaveLength(48);
    expect(new Set(a.map((x) => x.teamId)).size).toBe(48);
    expect(a.every((x) => x.tier !== undefined)).toBe(true);
  });

  it("gives every player exactly one team from each band (24 players, 2 tiers)", () => {
    const players = Array.from({ length: 24 }, (_, i) => `p${i}`);
    const a = runTieredDraw(ranked, players, "s", "spread_fairly");
    for (const p of players) {
      const mine = a.filter((x) => x.participantId === p);
      expect(mine).toHaveLength(2);
      expect(mine.map((x) => x.tier).sort()).toEqual([1, 2]);
      // Tier 1 = ranks 1–24, tier 2 = ranks 25–48: one strong + one weak each.
      const ranks = mine
        .sort((x, y) => x.tier! - y.tier!)
        .map((x) => rankOf(x.teamId));
      expect(ranks[0]).toBeLessThanOrEqual(24);
      expect(ranks[1]).toBeGreaterThan(24);
    }
  });

  it("generalizes: 4 players → 12 bands, one team per band each", () => {
    const players = ["p1", "p2", "p3", "p4"];
    const a = runTieredDraw(ranked, players, "s", "spread_fairly");
    for (const p of players) {
      const tiers = a
        .filter((x) => x.participantId === p)
        .map((x) => x.tier)
        .sort((x, y) => x! - y!);
      expect(tiers).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    }
  });

  it("is reproducible for the same seed and differs for another", () => {
    const players = ["p1", "p2", "p3", "p4", "p5"];
    expect(runTieredDraw(ranked, players, "abc", "spread_fairly")).toEqual(
      runTieredDraw(ranked, players, "abc", "spread_fairly"),
    );
    expect(runTieredDraw(ranked, players, "abc", "spread_fairly")).not.toEqual(
      runTieredDraw(ranked, players, "xyz", "spread_fairly"),
    );
  });

  it("the remainder is the WEAKEST teams, untiered (48 / 5 → ranks 46-48)", () => {
    const a = runTieredDraw(ranked, ["p1", "p2", "p3", "p4", "p5"], "s", "to_pot");
    const pot = a.filter((x) => x.participantId === null);
    expect(pot.map((x) => rankOf(x.teamId)).sort((x, y) => x - y)).toEqual([46, 47, 48]);
    expect(pot.every((x) => x.tier === null)).toBe(true);
  });

  it("spread_fairly hands the extras to players instead of the pot", () => {
    const a = runTieredDraw(ranked, ["p1", "p2", "p3", "p4", "p5"], "s", "spread_fairly");
    expect(a.filter((x) => x.participantId === null)).toHaveLength(0);
    const counts = new Map<string | null, number>();
    a.forEach((x) => counts.set(x.participantId, (counts.get(x.participantId) ?? 0) + 1));
    expect([...counts.values()].sort((x, y) => x - y)).toEqual([9, 9, 10, 10, 10]);
  });
});
