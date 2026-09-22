import { csvCell } from "./challenges.service";
import { RateLimiter, clientKey } from "./rate-limit";

describe("RateLimiter", () => {
  it("allows up to the limit per window, then 429s, then resets", () => {
    const rl = new RateLimiter(2, 1000);
    rl.hit("a", 0);
    rl.hit("a", 10);
    expect(() => rl.hit("a", 20)).toThrow(expect.objectContaining({ status: 429 }));
    rl.hit("b", 20); // independent key
    rl.hit("a", 1001); // new window
  });

  it("keys on the first forwarded hop", () => {
    expect(clientKey({ headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" }, ip: "10.0.0.1" })).toBe("1.2.3.4");
    expect(clientKey({ headers: {}, ip: "9.9.9.9" })).toBe("9.9.9.9");
  });
});

describe("csvCell", () => {
  it("neutralises formula-leading text and quotes as needed", () => {
    expect(csvCell("Thandi")).toBe("Thandi");
    expect(csvCell("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("+27")).toBe(`"'+27"`);
    expect(csvCell("-1")).toBe(`"'-1"`);
    expect(csvCell("@me")).toBe(`"'@me"`);
    expect(csvCell("a,b")).toBe(`"a,b"`);
    expect(csvCell("")).toBe("");
  });
});
