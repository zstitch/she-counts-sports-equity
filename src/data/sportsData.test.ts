import { describe, it, expect } from "vitest";
import {
  computeKpis,
  simulate,
  parseClubCsv,
  macroViewOptions,
  sandboxClubOptions,
  SPORT_MODALITY_SPLIT,
  SPORT_FORMAT_ANALYTICAL_INSIGHT,
} from "./sportsData";
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

  it("includes all 5 sport models in sandboxClubOptions", () => {
    const ids = sandboxClubOptions.map((o) => o.id);
    expect(ids).toContain("demo-football");
    expect(ids).toContain("demo-basketball");
    expect(ids).toContain("demo-tennis");
    expect(ids).toContain("demo-swimming");
    expect(ids).toContain("demo-volleyball");

    const football = sandboxClubOptions.find((o) => o.id === "demo-football")!;
    expect(football.label).toContain("Football");

    const tennis = sandboxClubOptions.find((o) => o.id === "demo-tennis")!;
    expect(tennis.label).toContain("Tennis");

    const swimming = sandboxClubOptions.find((o) => o.id === "demo-swimming")!;
    expect(swimming.label).toContain("Swimming");
  });

  it("computes sport-specific metrics demonstrating male-dominated vs female-led differentials", () => {
    const football = computeKpis("demo-football");
    const tennis = computeKpis("demo-tennis");
    const swimming = computeKpis("demo-swimming");
    const volleyball = computeKpis("demo-volleyball");

    // Male-dominated team football has higher dropout hazard and lower prime slot share
    expect(football.dropoutCliff).toBeGreaterThan(tennis.dropoutCliff);
    expect(football.dropoutCliff).toBeGreaterThan(swimming.dropoutCliff);
    expect(football.primeSlotAvg).toBeLessThan(tennis.primeSlotAvg);
    expect(football.primeSlotAvg).toBeLessThan(swimming.primeSlotAvg);

    // Swimming (female-led model) has highest coach parity and lane equity
    expect(swimming.femaleCoachAvg).toBe(45);
    expect(swimming.primeSlotAvg).toBeGreaterThanOrEqual(50);
    expect(swimming.dropoutCliff).toBeLessThanOrEqual(25);

    // Tennis (individual parity model) shows balanced prime slots and lower drop-off
    expect(tennis.primeSlotAvg).toBeGreaterThanOrEqual(45);
    expect(tennis.dropoutCliff).toBeLessThan(30);

    // Volleyball shows balanced court access
    expect(volleyball.primeSlotAvg).toBeGreaterThanOrEqual(45);
  });

  it("contains verified modality split data and analytical insight", () => {
    expect(SPORT_MODALITY_SPLIT.maleDominated.length).toBeGreaterThanOrEqual(3);
    expect(SPORT_MODALITY_SPLIT.femaleParity.length).toBeGreaterThanOrEqual(2);

    const team = SPORT_MODALITY_SPLIT.maleDominated.find((m) => m.arena.includes("Team Sports"))!;
    expect(team.malePct).toBe(71.0);
    expect(team.femalePct).toBe(55.0);
    expect(team.gapPp).toBe(-16.0);

    const individual = SPORT_MODALITY_SPLIT.femaleParity.find((m) => m.arena.includes("Individual"))!;
    expect(individual.femalePct).toBe(45.0);
    expect(individual.malePct).toBe(43.0);
    expect(individual.gapPp).toBe(2.0);

    expect(SPORT_FORMAT_ANALYTICAL_INSIGHT).toContain("Girls don't quit physical activity");
  });

  it("parses club CSV with sport column and assigns custom sport label", () => {
    const csvWithSport = `sport,cohort,female_registered,female_active,male_registered,male_active,prime_slot_pct,female_coach_pct,puberty_support_pct,fee_subsidy_pct
Handball,U12,40,36,40,38,40,30,50,40
Handball,U14,35,28,40,36,40,30,50,40
Handball,U16,30,20,40,34,40,30,50,40
Handball,U18,25,12,38,30,40,30,50,40
Handball,Uni19+,20,8,35,25,40,30,50,40`;

    const res = parseClubCsv(csvWithSport, "custom");
    expect(res.isMacro).toBe(false);
    expect(res.rows.length).toBe(5);
    expect(res.label).toBe("Handball (Custom Uploaded Club CSV)");
  });
});
