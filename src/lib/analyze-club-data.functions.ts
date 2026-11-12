import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const payloadSchema = z.object({
  club: z.string().max(200),
  femaleParticipationPct: z.number(),
  teenDropoutRiskPct: z.number(),
  primeHourRatio: z.number(),
  femaleCoachPct: z.number(),
  cohortRetention: z.array(z.object({ age: z.string(), femalePct: z.number(), malePct: z.number(), gapPt: z.number(), girlsActive: z.number(), girlsRegistered: z.number() })).max(10),
  optimizer: z.object({ primeShiftPct: z.number(), coachIncreasePct: z.number(), parityPct: z.number() }),
});
export type ClubPayload = z.infer<typeof payloadSchema>;

export interface PlanCard { title: string; actions: string[]; kpis: { metric: string; target: string }[] }
export interface Plan { title: string; cards: PlanCard[] }

const cardSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    actions: { type: "ARRAY", items: { type: "STRING" } },
    kpis: { type: "ARRAY", items: { type: "OBJECT", properties: { metric: { type: "STRING" }, target: { type: "STRING" } }, required: ["metric", "target"] } },
  },
  required: ["title", "actions", "kpis"],
};

// analyze-club-data: sends only pre-calculated metrics to Gemini; returns a 3-card plan.
export const analyzeClubData = createServerFn({ method: "POST" })
  .validator((d: unknown) => payloadSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; plan: Plan } | { ok: false; error: string }> => {
    const key =
      process.env["VITE_GEMINI_API_KEY"] ||
      process.env["GEMINI_API_KEY"];
    if (!key) return { ok: false, error: "VITE_GEMINI_API_KEY is not configured" };
    const prompt = `You are a sports-equity analyst. Using ONLY the figures in the JSON below, write a 90-Day Club Intervention Plan as exactly 3 cards titled "30-Day Quick Wins", "60-Day Structural Shifts", "90-Day Retention Audit". Each card: 2-4 concrete actions and 2-3 measurable target KPIs (metric + numeric target relative to a baseline from the JSON).
STRICT RULES: Never invent statistics, names, or sources. Every number you write must either appear in the JSON or be a target explicitly derived from a JSON value (state the baseline). Cite the JSON figure you rely on in each action.
JSON:
${JSON.stringify(data)}`;

    const models = ["gemini-2.5-flash", "gemini-3.8-flash", "gemini-flash-latest"];
    for (const model of models) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: { type: "OBJECT", properties: { cards: { type: "ARRAY", items: cardSchema } }, required: ["cards"] },
            },
          }),
        });
        if (res.status === 404) continue;
        if (!res.ok) continue;
        const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        const text = j.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) continue;
        const parsed = JSON.parse(text) as { cards: PlanCard[] };
        if (!Array.isArray(parsed.cards) || parsed.cards.length !== 3) continue;
        return { ok: true, plan: { title: `90-Day Plan — ${data.club}`, cards: parsed.cards } };
      } catch (e) {
        console.error(`Gemini model ${model} failed`, e);
      }
    }
    return { ok: false, error: "Gemini request failed on all model endpoints" };
  });
