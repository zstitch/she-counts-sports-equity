import { describe, it, expect } from "vitest";
import { computeKpis, simulate } from "./sportsData";

describe("kpis", () => {
  it("zero sliders keep hazard unchanged", () => {
    const k = computeKpis("all");
    expect(simulate(k, 0, 0, 0).projected).toBe(k.dropoutCliff);
  });
  it("shares sum to 100", () => {
    const k = computeKpis("bosna-bb");
    expect(k.femaleActiveShare + k.maleActiveShare).toBe(100);
  });
  it("femaleCoachAvg is a number between 0 and 100", () => {
    const k = computeKpis("sarajevo-fc");
    expect(k.femaleCoachAvg).toBeGreaterThanOrEqual(0);
    expect(k.femaleCoachAvg).toBeLessThanOrEqual(100);
  });
  it("dropoutCliff is non-negative", () => {
    const k = computeKpis("ius-sports");
    expect(k.dropoutCliff).toBeGreaterThanOrEqual(0);
  });
});
