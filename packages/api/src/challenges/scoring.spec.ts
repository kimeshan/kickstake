import { ACTIVITY_MINUTES_V1, scoringRules, summarise, weekResult } from "./scoring";

describe("activity-minutes-v1 ladder", () => {
  // [minutes, level, medal] — just below and at every boundary.
  const cases: [number, number, string][] = [
    [0, 0, "none"],
    [149, 0, "none"],
    [150, 1, "bronze"],
    [199, 1, "bronze"],
    [200, 2, "bronze"],
    [249, 2, "bronze"],
    [250, 3, "bronze"],
    [299, 3, "bronze"],
    [300, 4, "silver"],
    [349, 4, "silver"],
    [350, 5, "silver"],
    [399, 5, "silver"],
    [400, 6, "silver"],
    [449, 6, "silver"],
    [450, 7, "silver"],
    [499, 7, "silver"],
    [500, 8, "gold"],
    [599, 8, "gold"],
    [600, 9, "gold"],
    [799, 9, "gold"],
    [800, 10, "gold"],
    [999, 10, "gold"],
    [1000, 11, "platinum"],
    [1001, 11, "platinum"],
    [10080, 11, "platinum"],
  ];
  it.each(cases)("%i min → level %i (%s)", (minutes, level, medal) => {
    const r = weekResult(minutes)!;
    expect(r.level).toBe(level);
    expect(r.medal).toBe(medal);
    expect(r.minutes).toBe(minutes);
  });

  it("null (not entered) has no result — distinct from an explicit 0", () => {
    expect(weekResult(null)).toBeNull();
    expect(weekResult(0)).toMatchObject({ level: 0, medal: "none", baselinePercent: 0 });
  });

  it("reports the next threshold: 230 min → 20 min to Level 3", () => {
    expect(weekResult(230)).toMatchObject({
      level: 2,
      nextLevel: 3,
      nextThreshold: 250,
      minutesToNext: 20,
      reachedBaseline: true,
      baselinePercent: 100,
    });
    expect(weekResult(75)).toMatchObject({ nextLevel: 1, minutesToNext: 75, baselinePercent: 50 });
  });

  it("Platinum is the top — no invented tiers above 1,000", () => {
    const r = weekResult(1500)!;
    expect(r).toMatchObject({ level: 11, nextLevel: null, nextThreshold: null, minutesToNext: null });
  });

  it("rejects unknown scoring versions", () => {
    expect(scoringRules("activity-minutes-v1")).toBe(ACTIVITY_MINUTES_V1);
    expect(() => scoringRules("v999")).toThrow();
  });
});

describe("summarise", () => {
  it("returns nulls when nothing is entered", () => {
    expect(summarise([null, null, null, null])).toEqual({
      totalMinutes: null,
      bestWeek: null,
      successfulWeeks: 0,
      bestStreak: 0,
      weekCount: 4,
      enteredWeeks: 0,
    });
  });

  it("totals entered weeks and counts 150+ weeks out of four", () => {
    expect(summarise([150, 0, 400, null])).toMatchObject({
      totalMinutes: 550,
      bestWeek: 400,
      successfulWeeks: 2,
      bestStreak: 1,
      enteredWeeks: 3,
    });
  });

  it("a missing or sub-150 week breaks the streak", () => {
    expect(summarise([200, 200, null, 300]).bestStreak).toBe(2);
    expect(summarise([200, 149, 200, 200]).bestStreak).toBe(2);
    expect(summarise([150, 150, 150, 150])).toMatchObject({ bestStreak: 4, successfulWeeks: 4 });
  });

  it("future blank weeks don't erase an achieved streak", () => {
    expect(summarise([180, 220, null, null]).bestStreak).toBe(2);
  });

  it("corrections can lower derived results", () => {
    expect(summarise([200, 200, 200, null]).bestStreak).toBe(3);
    expect(summarise([200, 100, 200, null])).toMatchObject({ bestStreak: 1, successfulWeeks: 2 });
  });
});
