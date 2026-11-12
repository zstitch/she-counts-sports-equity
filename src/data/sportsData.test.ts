import { describe, it, expect } from "vitest";
import { computeKpis, simulate } from "./sportsData";
describe("kpis", () => {
  it("zero sliders keep hazard unchanged", () => {
    const k = computeKpis("all");
    expect(simulate(k, 0, 0, 0).projected).toBe(k.dropoutRisk);
  });
  it("shares sum to 100", () => { const k = computeKpis("bosna-bb"); expect(k.femaleShare + k.maleShare).toBe(100); });
});
