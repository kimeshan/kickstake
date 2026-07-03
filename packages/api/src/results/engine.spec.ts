import {
  groupStandings,
  groupDecided,
  computeOutcomes,
  buildPrizeRows,
  computeWinnings,
  type EngineMatch,
  type EngineTeam,
} from "./engine";

const finished = (
  home: string,
  away: string,
  hs: number,
  as: number,
  extra: Partial<EngineMatch> = {},
): EngineMatch => ({
  stage: "group",
  groupLabel: "A",
  homeTeamId: home,
  awayTeamId: away,
  homeScore: hs,
  awayScore: as,
  winnerTeamId: hs > as ? home : hs < as ? away : null,
  status: "finished",
  ...extra,
});

const ko = (
  stage: EngineMatch["stage"],
  home: string | null,
  away: string | null,
  winner: string | null = null,
): EngineMatch => ({
  stage,
  groupLabel: null,
  homeTeamId: home,
  awayTeamId: away,
  homeScore: winner ? 1 : null,
  awayScore: winner ? 0 : null,
  winnerTeamId: winner,
  status: winner ? "finished" : "scheduled",
});

describe("groupStandings", () => {
  it("orders by points, then goal difference, then goals for", () => {
    const table = groupStandings(
      ["a", "b", "c", "d"],
      [
        finished("a", "b", 3, 0), // a beats b heavily
        finished("c", "d", 1, 0), // c edges d
        finished("a", "c", 1, 1),
        finished("b", "d", 2, 2),
      ],
    );
    // d (GD −1) edges b (GD −3) despite level points.
    expect(table.map((r) => r.teamId)).toEqual(["a", "c", "d", "b"]);
    expect(table[0]).toMatchObject({ points: 4, goalDifference: 3, position: 1 });
  });

  it("breaks exact ties on head-to-head result", () => {
    // a and b end level on points/GD/GF overall, but b beat a directly.
    const table = groupStandings(
      ["a", "b", "c"],
      [
        finished("b", "a", 1, 0),
        finished("a", "c", 2, 1),
        finished("c", "b", 2, 1),
      ],
    );
    // All three have 3 pts, GD 0, GF 2..3 — c has GF 3, so c first; then b over a (h2h).
    expect(table.map((r) => r.teamId)).toEqual(["c", "b", "a"]);
  });
});

describe("groupDecided", () => {
  const ms = [
    finished("a", "b", 1, 0),
    finished("c", "d", 0, 0),
    finished("a", "c", 2, 0),
    finished("b", "d", 1, 1),
    finished("a", "d", 3, 0),
  ];
  it("is false until every pairing is finished", () => {
    expect(groupDecided(4, ms)).toBe(false);
    expect(groupDecided(4, [...ms, finished("b", "c", 1, 0)])).toBe(true);
  });
});

describe("computeOutcomes", () => {
  const teams: EngineTeam[] = [
    { id: "a1", groupLabel: "A" },
    { id: "a2", groupLabel: "A" },
    { id: "b1", groupLabel: "B" },
    { id: "b2", groupLabel: "B" },
  ];

  it("decides group prizes when the group finishes, leaves others contended", () => {
    const outcomes = computeOutcomes(teams, [finished("a1", "a2", 2, 0)]);
    const topA = outcomes.find((o) => o.ruleType === "group_top" && o.groupLabel === "A")!;
    const bottomA = outcomes.find((o) => o.ruleType === "group_bottom" && o.groupLabel === "A")!;
    const topB = outcomes.find((o) => o.ruleType === "group_top" && o.groupLabel === "B")!;
    expect(topA).toMatchObject({ decided: true, winningTeamId: "a1" });
    expect(bottomA).toMatchObject({ decided: true, winningTeamId: "a2" });
    expect(topB.decided).toBe(false);
    expect(topB.contenders).toEqual(["b1", "b2"]);
  });

  it("tracks knockout elimination and decides winner/runner-up from the final", () => {
    const outcomes = computeOutcomes(teams, [
      ko("semi_final", "a1", "b1", "a1"),
      ko("semi_final", "a2", "b2", "b2"),
      ko("final", "a1", "b2", "b2"),
      ko("third_place", "b1", "a2", "a2"),
    ]);
    expect(outcomes.find((o) => o.ruleType === "winner")).toMatchObject({
      decided: true,
      winningTeamId: "b2",
    });
    expect(outcomes.find((o) => o.ruleType === "runner_up")).toMatchObject({
      decided: true,
      winningTeamId: "a1",
    });
    expect(outcomes.find((o) => o.ruleType === "third_place")).toMatchObject({
      decided: true,
      winningTeamId: "a2",
    });
  });

  it("keeps semi-final losers alive for third place only", () => {
    const outcomes = computeOutcomes(teams, [
      ko("semi_final", "a1", "b1", "a1"),
      ko("semi_final", "a2", "b2", "b2"),
      ko("final", "a1", "b2"),
    ]);
    const winner = outcomes.find((o) => o.ruleType === "winner")!;
    const third = outcomes.find((o) => o.ruleType === "third_place")!;
    expect(winner.decided).toBe(false);
    expect(winner.contenders.sort()).toEqual(["a1", "b2"]);
    expect(third.contenders.sort()).toEqual(["a2", "b1"]);
  });

  it("eliminates teams missing from a fully-populated first knockout round", () => {
    const outcomes = computeOutcomes(teams, [
      ko("semi_final", "a1", "b1"),
      ko("semi_final", "a2", "b2"),
    ]);
    const winner = outcomes.find((o) => o.ruleType === "winner")!;
    expect(winner.contenders.sort()).toEqual(["a1", "a2", "b1", "b2"]);

    const withMissing = computeOutcomes(
      [...teams, { id: "c1", groupLabel: "C" }],
      [ko("semi_final", "a1", "b1"), ko("semi_final", "a2", "b2")],
    );
    expect(withMissing.find((o) => o.ruleType === "winner")!.contenders).not.toContain("c1");
  });
});

describe("stat outcomes (leaders + end-of-tournament decisions)", () => {
  const teams: EngineTeam[] = [
    { id: "a1", groupLabel: "A" },
    { id: "a2", groupLabel: "A" },
    { id: "b1", groupLabel: "B" },
    { id: "b2", groupLabel: "B" },
  ];
  const byRule = (outcomes: ReturnType<typeof computeOutcomes>, rule: string) =>
    outcomes.find((o) => o.ruleType === rule);

  it("tracks least-conceded and biggest-loss leaders while running", () => {
    const outcomes = computeOutcomes(teams, [
      finished("a1", "a2", 3, 0), // a2 concedes 3, loses by 3
      finished("b1", "b2", 1, 1), // clean-ish, no loss
    ]);
    expect(byRule(outcomes, "least_conceded")).toMatchObject({
      decided: false,
      leader: { statKey: "conceded", statValue: 0, teamId: "a1" },
    });
    expect(byRule(outcomes, "biggest_loss")).toMatchObject({
      decided: false,
      leader: { statKey: "lossMargin", statValue: 3, teamId: "a2" },
    });
  });

  it("decides stat prizes when the tournament completes and the top is unique", () => {
    const outcomes = computeOutcomes(teams, [
      finished("a1", "a2", 3, 0),
      finished("b1", "b2", 2, 1),
      ko("final", "a1", "b1", "a1"),
    ]);
    expect(byRule(outcomes, "least_conceded")).toMatchObject({
      decided: true,
      winningTeamId: "a1", // conceded 0 across both games
    });
    expect(byRule(outcomes, "biggest_loss")).toMatchObject({
      decided: true,
      winningTeamId: "a2",
    });
  });

  it("leaves tied stat prizes undecided even at completion", () => {
    const outcomes = computeOutcomes(teams, [
      finished("a1", "a2", 2, 0),
      finished("b1", "b2", 2, 0), // a2 and b2 both lost by 2
      ko("final", "a1", "b1", "a1"),
    ]);
    expect(byRule(outcomes, "biggest_loss")!.decided).toBe(false);
  });

  it("surfaces the golden boot leader from scorers, decides only when complete", () => {
    const scorers = [
      { playerName: "Ana", teamId: "a1", goals: 5 },
      { playerName: "Bo", teamId: "b1", goals: 3 },
    ];
    const running = computeOutcomes(teams, [finished("a1", "a2", 1, 0)], scorers);
    expect(byRule(running, "golden_boot")).toMatchObject({
      decided: false,
      leader: { playerName: "Ana", teamId: "a1", statKey: "goals", statValue: 5 },
    });

    const done = computeOutcomes(teams, [ko("final", "a1", "b1", "a1")], scorers);
    expect(byRule(done, "golden_boot")).toMatchObject({
      decided: true,
      winningTeamId: "a1",
    });

    const noData = computeOutcomes(teams, [finished("a1", "a2", 1, 0)]);
    expect(byRule(noData, "golden_boot")).toBeUndefined();
  });
});

describe("prize rows + winnings", () => {
  const teams: EngineTeam[] = [
    { id: "a1", groupLabel: "A" },
    { id: "a2", groupLabel: "A" },
  ];
  const categories = [
    { id: "cat-top", ruleType: "group_top", label: "Top", amount: 500, perGroup: true, enabled: true },
    { id: "cat-win", ruleType: "winner", label: "Winner", amount: 1000, perGroup: false, enabled: true },
    { id: "cat-boot", ruleType: "golden_boot", label: "Boot", amount: 300, perGroup: false, enabled: true },
    { id: "cat-off", ruleType: "runner_up", label: "Off", amount: 99, perGroup: false, enabled: false },
  ];

  it("expands per-group rules, flags stats rules non-computable, drops disabled", () => {
    const outcomes = computeOutcomes(teams, [finished("a1", "a2", 1, 0)]);
    const rows = buildPrizeRows(categories, outcomes);
    expect(rows.filter((r) => r.categoryId === "cat-top")).toHaveLength(1);
    expect(rows.find((r) => r.categoryId === "cat-boot")).toMatchObject({
      computable: false,
      decided: false,
    });
    expect(rows.some((r) => r.categoryId === "cat-off")).toBe(false);
  });

  it("credits decided money to owners, in-play money to contender owners, rest to pot", () => {
    const outcomes = computeOutcomes(teams, [finished("a1", "a2", 1, 0)]);
    const rows = buildPrizeRows(categories, outcomes);
    // Alice owns a1 (group winner + winner contender); a2 is pot-owned.
    const ownership = new Map<string, string | null>([
      ["a1", "alice"],
      ["a2", null],
    ]);
    const { entries, potWon } = computeWinnings(["alice", "bob"], ownership, rows);
    const alice = entries.find((e) => e.participantId === "alice")!;
    const bob = entries.find((e) => e.participantId === "bob")!;
    expect(alice.won).toBe(500); // group top A
    expect(alice.inPlay).toBe(1000); // winner still undecided
    expect(bob.won).toBe(0);
    expect(bob.inPlay).toBe(0);
    expect(potWon).toBe(0);
  });

  it("sends prizes won by pot-owned teams to the pot", () => {
    const outcomes = computeOutcomes(teams, [finished("a2", "a1", 1, 0)]);
    const rows = buildPrizeRows(categories, outcomes);
    const ownership = new Map<string, string | null>([
      ["a1", "alice"],
      ["a2", null],
    ]);
    const { potWon } = computeWinnings(["alice"], ownership, rows);
    expect(potWon).toBe(500);
  });
});
