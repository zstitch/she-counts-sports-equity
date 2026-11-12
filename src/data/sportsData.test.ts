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
  it("computes verified Eurostat macro benchmarks correctly", () => {
    const eu = computeKpis("eu27");
    expect(eu.isMacro).toBe(true);
    expect(eu.femaleActiveShare).toBe(35);
    expect(eu.dropoutCliff).toBe(52); // matches ICOACHKIDS+ EU benchmark
    expect(eu.femaleActiveShare + eu.maleActiveShare).toBe(100);

    const hr = computeKpis("croatia");
    expect(hr.isMacro).toBe(true);
    expect(hr.dropoutCliff).toBeGreaterThan(0);

    const rs = computeKpis("serbia");
    expect(rs.isMacro).toBe(true);
    expect(rs.dropoutCliff).toBeGreaterThan(0);

    const si = computeKpis("slovenia");
    expect(si.isMacro).toBe(true);
    expect(si.dropoutCliff).toBeGreaterThan(0);
  });
  it("computes club diagnostic sandbox models correctly", () => {
    const club = computeKpis("demo-football");
    expect(club.isMacro).toBe(false);
    expect(club.femaleActiveShare + club.maleActiveShare).toBe(100);
    expect(club.primeSlotAvg).toBeGreaterThan(0);
  });
});
