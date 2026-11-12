/**
 * geminiAnalyst.ts — Client & Server Gemini AI Analyst Integration
 * 
 * Calls Google Gemini (gemini-2.5-flash with gemini-3.8-flash fallback) using
 * import.meta.env.VITE_GEMINI_API_KEY to generate a tailored 90-Day Policy Roadmap
 * or Club Intervention Plan based on verified telemetry and root causes.
 */

export interface PlanCard {
  title: string;
  actions: string[];
  kpis: { metric: string; target: string }[];
}

export interface Plan {
  title: string;
  cards: PlanCard[];
}

export interface TelemetryContext {
  entityName: string;
  isMacro: boolean;
  femaleActiveShare: number;
  maleActiveShare: number;
  dropoutCliff: number;
  primeSlotAvg: number;
  primeMaleSkew: number;
  femaleCoachAvg: number;
  pubertySupportAvg: number;
  feeSubsidyAvg?: number;
  worstAge?: { age: string; gap: number; female: number; male: number };
  ages: Array<{
    age: string;
    female: number;
    male: number;
    gap: number;
    primeSlotPct: number;
  }>;
  optimizer?: {
    primeShiftPct: number;
    coachIncreasePct: number;
    parityPct: number;
    projectedCliff: number;
    retainedCount: number;
  };
}

const CARD_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    actions: { type: "ARRAY", items: { type: "STRING" } },
    kpis: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          metric: { type: "STRING" },
          target: { type: "STRING" },
        },
        required: ["metric", "target"],
      },
    },
  },
  required: ["title", "actions", "kpis"],
};

export function getGeminiApiKey(): string {
  // 1. Client-side Vite environment variable
  const viteKey = typeof import.meta !== "undefined" && import.meta.env
    ? (import.meta.env["VITE_GEMINI_API_KEY"] as string | undefined)
    : undefined;
  if (viteKey && viteKey !== "PASTE_HER_GEMINI_KEY_HERE" && viteKey !== "your_gemini_api_key_here") {
    return viteKey;
  }

  // 2. Server-side / Node process environment variable
  if (typeof process !== "undefined" && process.env) {
    const procKey = process.env["VITE_GEMINI_API_KEY"] || process.env["GEMINI_API_KEY"];
    if (procKey && procKey !== "PASTE_HER_GEMINI_KEY_HERE" && procKey !== "your_gemini_api_key_here") {
      return procKey;
    }
  }

  return "";
}

/** Construct rich, evidence-grounded prompt incorporating root causes and What-If scenarios. */
export function buildPrompt(ctx: TelemetryContext): string {
  const isMacro = ctx.isMacro;
  const role = isMacro
    ? "European & Balkan Sports Policy Analyst for Track 04: Count What Matters"
    : "Grassroots Sports Equity & Retention Specialist for Track 04";

  const goal = isMacro
    ? `Write a 90-Day Policy Roadmap for ${ctx.entityName}`
    : `Write a 90-Day Club Intervention Plan for ${ctx.entityName}`;

  return `You are a high-level ${role}.
${goal}.

STRUCTURE REQUIREMENTS:
Return exactly 3 cards formatted as JSON:
1. Card 1: "30-Day Quick Wins" (Immediate low-cost policy & kit interventions)
2. Card 2: "60-Day Structural Shifts" (Prime-time pitch equity & coach mentorship reallocation)
3. Card 3: "90-Day Retention Audit" (Long-term retention audit, scholarship ring-fencing & Erasmus+ monitoring)

Each card MUST contain:
- "title": string (the card name above)
- "actions": string[] (2-4 concrete, highly specific actionable points)
- "kpis": { metric: string, target: string }[] (2-3 measurable numeric targets with baseline from JSON)

TELEMETRY BASELINE FIGURES (STRICT: DO NOT INVENT EXTERNAL METRICS):
- Entity: ${ctx.entityName} (${isMacro ? "Verified Regional Macro Telemetry" : "Club Diagnostic Model"})
- Female Active Share: ${ctx.femaleActiveShare}% (Target: 50% parity; Male Share: ${ctx.maleActiveShare}%)
- Adolescent Dropout Cliff (U14→U18): ${ctx.dropoutCliff}%
- Prime-Time Pitch Share (18:00–21:00): ${ctx.primeSlotAvg}% (Male skew: ${ctx.primeMaleSkew}x)
- Female Coaching Share: ${ctx.femaleCoachAvg}%
- Puberty & Menstrual Readiness Score: ${ctx.pubertySupportAvg}/100
${ctx.worstAge ? `- Worst Retention Hazard Cohort: ${ctx.worstAge.age} with a ${ctx.worstAge.gap} percentage point gap (Female ${ctx.worstAge.female}% vs Male ${ctx.worstAge.male}%)` : ""}
- Age Cohort Breakdown:
${ctx.ages.map((a) => `  * ${a.age}: Female ${a.female}%, Male ${a.male}%, Gap: ${a.gap}pp, Prime Slot: ${a.primeSlotPct}%`).join("\n")}

ROOT-CAUSE DRIVERS TO ADDRESS:
1. Biological & Kit Stigma (PMC12330288): 78% avoid sport during menstruation, 68% fear light/white kit leakage, 71.7% lack menstrual cycle literacy. Concrete remedy: Dark-kit policies & free period supplies in sports venues.
2. Scheduling & Safe Transit Barrier (Eurobarometer 574): 40% cite scheduling/time as #1 barrier. Prime hours 18:00–21:00 skew ${ctx.primeMaleSkew}x male. Concrete remedy: Mandate 50/50 rotation of prime hours.
3. Coaching Mentorship & Role-Model Gap (Eurostat & PMC12330288): 63% lack female coaches/role models. Concrete remedy: Fast-track senior university female athletes into paid coaching badges.

${ctx.optimizer ? `WHAT-IF SIMULATION TARGETS:
- Prime-Slot Shift: +${ctx.optimizer.primeShiftPct}%
- Female Coaching Staff Increase: +${ctx.optimizer.coachIncreasePct}%
- Period Kit / Facility Support: +${ctx.optimizer.parityPct}%
- Projected Dropout Cliff Reduction: from ${ctx.dropoutCliff}% to ${ctx.optimizer.projectedCliff}% (+${ctx.optimizer.retainedCount} athletes retained)` : ""}

RULES:
- Plain, direct, professional tone. No filler or generic buzzwords.
- Explicitly cite baseline figures from above when establishing action targets.
`;
}

/** Calls Gemini API with fallback across model endpoints. */
export async function callGeminiAnalyst(
  ctx: TelemetryContext,
  apiKeyOverride?: string
): Promise<{ ok: true; plan: Plan } | { ok: false; error: string }> {
  const apiKey = apiKeyOverride !== undefined ? apiKeyOverride : getGeminiApiKey();
  if (!apiKey) {
    return { ok: false, error: "No Gemini API key configured" };
  }

  const prompt = buildPrompt(ctx);
  const modelsToTry = [
    "gemini-2.5-flash",
    "gemini-3.8-flash",
    "gemini-flash-latest",
  ];

  let lastError = "Request failed";

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                cards: { type: "ARRAY", items: CARD_SCHEMA },
              },
              required: ["cards"],
            },
          },
        }),
      });

      if (res.status === 404) {
        lastError = `Model ${model} not found (404), attempting next model`;
        continue;
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        lastError = `Gemini returned HTTP ${res.status}: ${JSON.stringify(errJson)}`;
        continue;
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        lastError = "Empty response content from Gemini";
        continue;
      }

      const parsed = JSON.parse(rawText) as { cards: PlanCard[] };
      if (!Array.isArray(parsed.cards) || parsed.cards.length === 0) {
        lastError = "Invalid cards format in Gemini output";
        continue;
      }

      const planTitle = ctx.isMacro
        ? `90-Day Policy Roadmap — ${ctx.entityName}`
        : `90-Day Club Intervention Plan — ${ctx.entityName}`;

      return {
        ok: true,
        plan: {
          title: planTitle,
          cards: parsed.cards,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = `Network/fetch error with ${model}: ${msg}`;
    }
  }

  return { ok: false, error: lastError };
}
