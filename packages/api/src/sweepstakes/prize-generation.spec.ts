import { generatePrizes, prizeTotal, PRIZE_TEMPLATE } from "./prize-generation";

describe("generatePrizes", () => {
  const pots = [200000, 199999, 1, 123457, 1000000, 50000, 7]; // minor units

  it.each(pots)("reconciles exactly to the pot (%i)", (pot) => {
    const prizes = generatePrizes(pot, 12);
    expect(prizeTotal(prizes, 12)).toBe(pot);
  });

  it("produces the full template (12 categories)", () => {
    const prizes = generatePrizes(200000, 12);
    expect(prizes).toHaveLength(PRIZE_TEMPLATE.length);
    expect(prizes.every((p) => p.enabled)).toBe(true);
  });

  it("makes the Winner the largest single prize", () => {
    const prizes = generatePrizes(200000, 12);
    const winner = prizes.find((p) => p.ruleType === "winner")!;
    const maxOther = Math.max(
      ...prizes.filter((p) => p.ruleType !== "winner").map((p) => p.amount),
    );
    expect(winner.amount).toBeGreaterThan(maxOther);
  });

  it("marks per-group prizes and counts them × groupCount", () => {
    const prizes = generatePrizes(200000, 12);
    const groupTop = prizes.find((p) => p.ruleType === "group_top")!;
    expect(groupTop.perGroup).toBe(true);
    // its pot contribution is the per-group amount times 12
    expect(prizeTotal([groupTop], 12)).toBe(groupTop.amount * 12);
  });

  it("excludes disabled prizes from the total", () => {
    const prizes = generatePrizes(200000, 12);
    const full = prizeTotal(prizes, 12);
    prizes.find((p) => p.ruleType === "biggest_loss")!.enabled = false;
    expect(prizeTotal(prizes, 12)).toBeLessThan(full);
  });

  it("reconciles for any group count", () => {
    for (const g of [1, 4, 8, 12, 16]) {
      expect(prizeTotal(generatePrizes(333333, g), g)).toBe(333333);
    }
  });
});
