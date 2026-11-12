import { describe, it, expect } from "vitest";
import { buildPrompt, callGeminiAnalyst, type TelemetryContext } from "./geminiAnalyst";
import { computeKpis, interventionPlan } from "@/data/sportsData";

describe("geminiAnalyst", () => {
  const mockContext: TelemetryContext = {
    entityName: "Bosnia & Herzegovina (Host Country — BiH Adolescent Studies)",
    isMacro: true,
    femaleActiveShare: 35,
    maleActiveShare: 65,
    dropoutCliff: 51,
    primeSlotAvg: 31,
    primeMaleSkew: 2.22,
    femaleCoachAvg: 15,
    pubertySupportAvg: 28,
    ages: [
      { age: "U12", female: 82, male: 90, gap: 8, primeSlotPct: 32 },
      { age: "U14", female: 78, male: 85, gap: 7, primeSlotPct: 32 },
      { age: "U16", female: 44, male: 56, gap: 12, primeSlotPct: 30 },
      { age: "U18", female: 27, male: 41, gap: 14, primeSlotPct: 30 },
      { age: "Uni19+", female: 21, male: 31, gap: 10, primeSlotPct: 30 },
    ],
    worstAge: { age: "U18", gap: 14, female: 27, male: 41 },
    optimizer: {
      primeShiftPct: 20,
      coachIncreasePct: 15,
      parityPct: 30,
      projectedCliff: 38,
      retainedCount: 13,
    },
  };

  it("builds an evidence-grounded prompt with telemetry and root-cause citations", () => {
    const prompt = buildPrompt(mockContext);
    expect(prompt).toContain("Bosnia & Herzegovina (Host Country");
    expect(prompt).toContain("Female Active Share: 35%");
    expect(prompt).toContain("Adolescent Dropout Cliff (U14→U18): 51%");
    expect(prompt).toContain("Prime-Time Pitch Share (18:00–21:00): 31%");
    expect(prompt).toContain("PMC12330288");
    expect(prompt).toContain("Eurobarometer 574");
    expect(prompt).toContain("30-Day Quick Wins");
    expect(prompt).toContain("60-Day Structural Shifts");
    expect(prompt).toContain("90-Day Retention Audit");
  });

  it("fails gracefully without throwing when API key is missing", async () => {
    const res = await callGeminiAnalyst(mockContext, "");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("No Gemini API key configured");
    }
  });

  it("rule-based fallback generates full 3-card plan instantly (<10ms offline)", () => {
    const k = computeKpis("bih");
    const fallback = interventionPlan(k, "Bosnia & Herzegovina");
    expect(fallback.title).toContain("90-Day Policy Roadmap — Bosnia & Herzegovina");
    expect(fallback.cards.length).toBe(3);
    expect(fallback.cards[0]!.title).toBe("30-Day Quick Wins");
    expect(fallback.cards[1]!.title).toBe("60-Day Structural Shifts");
    expect(fallback.cards[2]!.title).toBe("90-Day Retention Audit");
    expect(fallback.cards[0]!.actions.length).toBeGreaterThanOrEqual(2);
    expect(fallback.cards[0]!.kpis.length).toBeGreaterThanOrEqual(2);
  });
});
