import { describe, it, expect } from "vitest";
import { computeKpis, simulate, parseClubCsv, macroViewOptions } from "./sportsData";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("kpis", () => {
  it("defaults to Bosnia & Herzegovina (Host Country) as #1 macro option", () => {
    expect(macroViewOptions[0]!.id).toBe("bih");
    expect(macroViewOptions[0]!.label).toContain("Bosnia & Herzegovina (Host Country");

    const bihDefault = computeKpis();
    expect(bihDefault.isMacro).toBe(true);
    expect(bihDefault.dropoutCliff).toBe(51);
    expect(bihDefault.femaleActiveShare + bihDefault.maleActiveShare).toBe(100);

    const bihExplicit = computeKpis("bih");
    expect(bihExplicit.isMacro).toBe(true);
    // U16 is 44% (Sekulić et al. PMC8534587), U18 is 27% (PMC8620439)
    const u16 = bihExplicit.ages.find((a) => a.age === "U16")!;
    const u18 = bihExplicit.ages.find((a) => a.age === "U18")!;
    expect(u16.female).toBe(44);
    expect(u18.female).toBe(27);
    expect(u16.gap).toBe(12); // 12.0 pt gap cited in Sekulić et al.
    expect(u18.gap).toBe(14); // 14.0 pt gap cited in BiH Late Adolescence Study
  });

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
  it("parses bosnia_herzegovina_youth_sport_data.csv cleanly without NaN or blank states", () => {
    const csvPath = resolve(__dirname, "../../public/bosnia_herzegovina_youth_sport_data.csv");
    const content = readFileSync(csvPath, "utf-8");
    const res = parseClubCsv(content, "custom");

    expect(res.isMacro).toBe(true);
    expect(res.rows.length).toBe(5);
    expect(res.countryCode).toBe("BA");

    // Verify all rows have valid numbers, no NaN
    for (const r of res.rows) {
      expect(Number.isFinite(r.femaleRegistered)).toBe(true);
      expect(Number.isFinite(r.femaleActive)).toBe(true);
      expect(Number.isFinite(r.maleRegistered)).toBe(true);
      expect(Number.isFinite(r.maleActive)).toBe(true);
      expect(r.femaleActive).toBeGreaterThan(0);
    }

    // Check exact peer-reviewed percentages: 44% at U16, 27% at U18, 21% at Uni19+
    const u16 = res.rows.find((r) => r.age === "U16")!;
    const u18 = res.rows.find((r) => r.age === "U18")!;
    const uni = res.rows.find((r) => r.age === "Uni19+")!;

    expect(Math.round((u16.femaleActive / u16.femaleRegistered) * 100)).toBe(44);
    expect(Math.round((u18.femaleActive / u18.femaleRegistered) * 100)).toBe(27);
    expect(Math.round((uni.femaleActive / uni.femaleRegistered) * 100)).toBe(21);
  });
});
