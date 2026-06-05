import { runDraw } from "./draw";

const teams = Array.from({ length: 48 }, (_, i) => `t${i}`);

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
