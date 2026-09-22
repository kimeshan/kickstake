import { INITIAL_CHALLENGE } from "./config";
import { addDays, challengeTiming, zonedToUtc } from "./timing";

const at = (iso: string) => challengeTiming(INITIAL_CHALLENGE, new Date(iso));

describe("challenge calendar (Africa/Johannesburg, UTC+2)", () => {
  it("lays out four Monday–Sunday weeks with Monday-noon reporting reminders", () => {
    const t = at("2026-09-22T09:00:00Z");
    expect(t.weeks.map((w) => [w.startDate, w.endDate])).toEqual([
      ["2026-09-21", "2026-09-27"],
      ["2026-09-28", "2026-10-04"],
      ["2026-10-05", "2026-10-11"],
      ["2026-10-12", "2026-10-18"],
    ]);
    expect(t.weeks[0].startsAt).toBe("2026-09-20T22:00:00.000Z");
    expect(t.weeks[0].endsAt).toBe("2026-09-27T22:00:00.000Z");
    expect(t.weeks[0].reportingDueAt).toBe("2026-09-28T10:00:00.000Z");
    expect(t.weeks[3].reportingDueAt).toBe("2026-10-19T10:00:00.000Z");
    expect(t.lastActivityDate).toBe("2026-10-18");
  });

  it("is upcoming before local Monday 00:00 and opens exactly at it", () => {
    expect(at("2026-09-20T21:59:59.999Z")).toMatchObject({ phase: "upcoming", currentWeek: null, defaultWeek: 1 });
    expect(at("2026-09-20T22:00:00.000Z")).toMatchObject({ phase: "active", currentWeek: 1 });
  });

  it("rolls weeks at local midnight, not UTC midnight (half-open intervals)", () => {
    // Sunday 23:59:59 SAST — still week 1.
    expect(at("2026-09-27T21:59:59Z").currentWeek).toBe(1);
    // Monday 00:00 SAST (Sunday 22:00 UTC) — week 2, week 1 elapsed.
    const t = at("2026-09-27T22:00:00Z");
    expect(t.currentWeek).toBe(2);
    expect(t.weeks.map((w) => w.status)).toEqual(["elapsed", "current", "future", "future"]);
  });

  it("moves to reporting after the last activity day, then finished at the cutoff", () => {
    expect(at("2026-10-18T21:59:59Z")).toMatchObject({ phase: "active", currentWeek: 4 });
    expect(at("2026-10-18T22:00:00Z")).toMatchObject({ phase: "reporting", currentWeek: null, defaultWeek: 4, beforeCutoff: true });
    expect(at("2026-10-19T09:59:59Z")).toMatchObject({ phase: "reporting", beforeCutoff: true });
    expect(at("2026-10-19T10:00:00Z")).toMatchObject({ phase: "finished", beforeCutoff: false, defaultWeek: 4 });
  });

  it("handles DST zones (Europe/London spring forward)", () => {
    expect(zonedToUtc("2026-03-29", "Europe/London").toISOString()).toBe("2026-03-29T00:00:00.000Z");
    expect(zonedToUtc("2026-03-30", "Europe/London").toISOString()).toBe("2026-03-29T23:00:00.000Z");
    expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
  });
});
