/**
 * sportsData.ts — SHE COUNTS relational engine
 * Zero PII. Deterministic TypeScript. All KPIs computed below.
 * Anchored in real EU sports-participation research (see EU_EVIDENCE below).
 */

export type ClubId = "all" | "sarajevo-fc" | "ius-sports" | "bosna-bb";
export const AGE_COHORTS = ["U12", "U14", "U16", "U18", "Uni19+"] as const;
export type AgeCohort = (typeof AGE_COHORTS)[number];

export interface Club {
  id: Exclude<ClubId, "all">;
  name: string;
  sport: string;
}

export const clubs: Club[] = [
  { id: "sarajevo-fc", name: "Sarajevo Youth FC", sport: "Football" },
  { id: "ius-sports",  name: "IUS University Sports", sport: "Multi-Sport" },
  { id: "bosna-bb",    name: "Bosna Youth", sport: "Basketball" },
];

export const viewOptions: { id: ClubId; label: string }[] = [
  { id: "all",          label: "All Grassroots Clubs (BiH & EU Benchmark Aggregate)" },
  { id: "sarajevo-fc",  label: "Sarajevo Youth FC — Football" },
  { id: "ius-sports",   label: "IUS University Sports — Multi-Sport" },
  { id: "bosna-bb",     label: "Bosna Youth — Basketball" },
];

// ── EU Research Evidence Registry ──────────────────────────────────────────
export const EU_EVIDENCE = [
  {
    id: "eurostat-pe3i",
    title: "Eurostat (hlth_ehis_pe3i & hlth_ehis_pe2e)",
    finding: "42% of EU women vs. 47% of EU men engage in regular leisure physical activity. An 18-percentage-point drop exists between the top income quintile (55%) and bottom quintile (37%).",
    url: "https://ec.europa.eu/eurostat/databrowser/view/hlth_ehis_pe3i/default/table",
    stat: "−18 pp income gap",
  },
  {
    id: "eurobarometer-574",
    title: "Special Eurobarometer 574 — Sport & Physical Activity (2026)",
    finding: "41% of women report never exercising or playing sport (vs. 36% of men). The #1 barrier across Europe is lack of time / incompatible scheduling (40%), compounded by financial strain.",
    url: "https://europa.eu/eurobarometer/",
    stat: "40% cite time barriers",
  },
  {
    id: "icoachkids-dropout",
    title: "Erasmus+ ICOACHKIDS+ European Youth Sport Dropout Study",
    finding: "52% of all youth sport dropouts occur between ages 14 and 18 — even though 70% of girls who drop out still consider themselves 'sporty'.",
    url: "https://icoachkids.org/the-hub/inclusion/understanding-youth-sport-dropout-what-it-is-and-why-it-matters",
    stat: "52% dropout ages 14–18",
  },
  {
    id: "pmc-puberty",
    title: "Puberty, Menstruation & Coaching Barriers (PMC12330288 / UN Women)",
    finding: "78% of teenage girls avoid sport during their period. 71.7% have received zero menstrual education related to exercise. 68% fear body/leakage judgment (especially in light/white kits). 63% lack female coaches or role models.",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12330288/",
    stat: "78% period avoidance",
  },
] as const;

// ── Relational Data Schema ──────────────────────────────────────────────────
export interface CohortRow {
  clubId: Club["id"];
  age: AgeCohort;
  femaleRegistered: number;
  femaleActive: number;
  maleRegistered: number;
  maleActive: number;
  /** % of prime 18:00–21:00 training hours allocated to female squads */
  primeSlotPct: number;
  /** % of accredited female coaching staff */
  femaleCoachPct: number;
  /**
   * 0–100 composite: dark-shorts kit policy (0/50), period supplies (0/25),
   * coach menstrual-cycle literacy (0/25)
   */
  pubertySupportScore: number;
  /** % of low-income equipment/travel scholarships allocated to girls */
  feeSubsidyPct: number;
}

function makeRow(
  clubId: Club["id"],
  age: AgeCohort,
  femaleRegistered: number,
  femaleActive: number,
  maleRegistered: number,
  maleActive: number,
  primeSlotPct: number,
  femaleCoachPct: number,
  pubertySupportScore: number,
  feeSubsidyPct: number
): CohortRow {
  return { clubId, age, femaleRegistered, femaleActive, maleRegistered, maleActive, primeSlotPct, femaleCoachPct, pubertySupportScore, feeSubsidyPct };
}

export const cohort: CohortRow[] = [
  // Sarajevo Youth FC — Football (heavy male prime-slot skew, low puberty support)
  makeRow("sarajevo-fc", "U12",   58, 51, 138, 128, 28, 8,  20, 22),
  makeRow("sarajevo-fc", "U14",   53, 37, 133, 119, 26, 8,  20, 22),
  makeRow("sarajevo-fc", "U16",   46, 20, 128, 109, 24, 8,  20, 22),
  makeRow("sarajevo-fc", "U18",   38, 10, 118,  93, 24, 8,  20, 22),
  makeRow("sarajevo-fc", "Uni19+",28,  7, 108,  81, 24, 8,  20, 22),

  // IUS University Sports — Multi-Sport (best female coaching, best puberty support)
  makeRow("ius-sports",  "U12",   62, 57,  88,  82, 44, 35, 72, 48),
  makeRow("ius-sports",  "U14",   58, 48,  84,  76, 42, 35, 72, 48),
  makeRow("ius-sports",  "U16",   52, 34,  80,  70, 40, 35, 72, 48),
  makeRow("ius-sports",  "U18",   44, 21,  74,  63, 40, 35, 72, 48),
  makeRow("ius-sports",  "Uni19+",52, 38,  68,  58, 40, 35, 72, 48),

  // Bosna Youth — Basketball (medium support, moderate prime-slot gap)
  makeRow("bosna-bb",    "U12",   48, 43,  68,  62, 36, 22, 45, 35),
  makeRow("bosna-bb",    "U14",   44, 33,  65,  59, 34, 22, 45, 35),
  makeRow("bosna-bb",    "U16",   40, 21,  62,  54, 32, 22, 45, 35),
  makeRow("bosna-bb",    "U18",   34,  12, 58,  48, 32, 22, 45, 35),
  makeRow("bosna-bb",    "Uni19+",26,   8, 52,  41, 32, 22, 45, 35),
];

// ── Helpers ─────────────────────────────────────────────────────────────────
const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));
const inView = (id: ClubId) => (r: { clubId: string }) => id === "all" || r.clubId === id;
const sum = <T,>(arr: T[], f: (t: T) => number) => arr.reduce((s, t) => s + f(t), 0);
const avg = <T,>(arr: T[], f: (t: T) => number) =>
  arr.length === 0 ? 0 : Math.round(sum(arr, f) / arr.length);

// ── KPI Engine ───────────────────────────────────────────────────────────────
export function computeKpis(id: ClubId) {
  const c = cohort.filter(inView(id));

  // Per-cohort retention matrix
  const ages = AGE_COHORTS.map((age) => {
    const r = c.filter((x) => x.age === age);
    const fr = sum(r, (x) => x.femaleRegistered);
    const fa = sum(r, (x) => x.femaleActive);
    const mr = sum(r, (x) => x.maleRegistered);
    const ma = sum(r, (x) => x.maleActive);
    const primeSlot = avg(r, (x) => x.primeSlotPct);
    const femRetPct = pct(fa, fr);
    const malRetPct = pct(ma, mr);
    return {
      age, fr, fa, mr, ma,
      female: femRetPct,
      male: malRetPct,
      gap: malRetPct - femRetPct,
      primeSlotPct: primeSlot,
    };
  });

  // Top-level KPIs
  const totalFR = sum(c, (x) => x.femaleRegistered);
  const totalFA = sum(c, (x) => x.femaleActive);
  const totalMR = sum(c, (x) => x.maleRegistered);
  const totalMA = sum(c, (x) => x.maleActive);
  const totalPlayers = totalFR + totalMR;
  const femaleActiveShare = pct(totalFA, totalFA + totalMA);

  // Adolescent dropout cliff: girls who were U14-active but lost by U18
  const u14 = ages.find((a) => a.age === "U14")!;
  const u18 = ages.find((a) => a.age === "U18")!;
  const dropoutCliff = pct(Math.max(0, u14.fa - u18.fa), u14.fr);

  // Prime-slot allocation (avg across clubs/cohorts)
  const primeSlotAvg = avg(c, (x) => x.primeSlotPct);
  const primeMaleSkew = primeSlotAvg === 0 ? 0 : +((100 - primeSlotAvg) / primeSlotAvg).toFixed(2);

  // Female coaching & puberty readiness
  const femaleCoachAvg = avg(c, (x) => x.femaleCoachPct);
  const pubertySupportAvg = avg(c, (x) => x.pubertySupportScore);
  const feeSubsidyAvg = avg(c, (x) => x.feeSubsidyPct);

  // Worst retention-gap cohort
  const worstAge = [...ages].sort((a, b) => b.gap - a.gap)[0]!;

  // Teen hazard (U14–U18 girls still active)
  const teenFA = sum(
    c.filter((x) => x.age === "U14" || x.age === "U16" || x.age === "U18"),
    (x) => x.femaleActive
  );
  const teenFR = sum(
    c.filter((x) => x.age === "U14" || x.age === "U16" || x.age === "U18"),
    (x) => x.femaleRegistered
  );

  return {
    ages,
    femaleActiveShare,
    maleActiveShare: 100 - femaleActiveShare,
    totalFR, totalFA, totalMR, totalMA, totalPlayers,
    dropoutCliff,
    u14fa: u14.fa, u14fr: u14.fr,
    u18fa: u18.fa, u18fr: u18.fr,
    primeSlotAvg,
    primeMaleSkew,
    femaleCoachAvg,
    pubertySupportAvg,
    feeSubsidyAvg,
    worstAge,
    teenFA, teenFR,
    teenRetentionPct: pct(teenFA, teenFR),
  };
}

export type Kpis = ReturnType<typeof computeKpis>;

/** What-if model: each lever reduces hazard by weighted, diminishing elasticity. Hypothetical. */
export function simulate(k: Kpis, primeShift: number, coachInc: number, pubertySupport: number) {
  // Elasticities modeled on Eurobarometer 574 (time barrier: 40%), PMC12330288 (period: 78%), ICOACHKIDS+ coach gap (63%)
  const reduction =
    1 -
    (1 - 0.0038 * primeShift) *
    (1 - 0.0028 * coachInc) *
    (1 - 0.0024 * pubertySupport);
  const projected = Math.max(0, Math.round(k.dropoutCliff * (1 - reduction) * 10) / 10);
  const retained = Math.round(((k.dropoutCliff - projected) / 100) * k.u14fr);
  return { projected, retained, reduction: Math.round(reduction * 1000) / 10 };
}

/** Deterministic 90-day action plan — renders in <300ms, works fully offline. */
export function interventionPlan(k: Kpis, label: string) {
  return {
    title: `90-Day Club Intervention Plan — ${label}`,
    cards: [
      {
        title: "30-Day Quick Wins",
        badge: "Near-Zero Budget",
        actions: [
          `Replace white/light shorts with dark navy/black kits for all U12–U18 girls' squads — addresses the 78% period-avoidance finding (PMC12330288) and 68% kit-stigma fear.`,
          `Place free period-supply packs in all venue washrooms (cost: ~€15/month per venue). Current Puberty Support Score: ${k.pubertySupportAvg}/100.`,
          `Contact all ${k.teenFR - k.teenFA} lapsed U14–U18 girls (of ${k.teenFR} registered) with a short exit survey within 30 days.`,
        ],
        kpis: [
          { metric: "Puberty Support Score", target: `≥ 50/100 (now ${k.pubertySupportAvg}/100)` },
          { metric: "Survey response rate", target: "≥ 60% of lapsed U14–U18 girls contacted" },
        ],
      },
      {
        title: "60-Day Structural Shifts",
        badge: "Scheduling & Coaching",
        actions: [
          `Mandate 50/50 rotation of 18:00–20:00 prime-hour slots between boys' and girls' squads. Current female prime-slot share: ${k.primeSlotAvg}% (target: ≥ 50%). Addresses Eurobarometer 574 — 40% time/schedule barrier.`,
          `Fast-track ${Math.max(1, Math.ceil((k.femaleCoachAvg / 100) * 20 + 1))} senior Uni 19+ female players into paid assistant coaching badges. Current female coach share: ${k.femaleCoachAvg}%. Addresses 63% role-model deficit (PMC12330288).`,
          `Launch a ${k.worstAge.age} bridge squad targeting the ${k.worstAge.gap}-point retention gap identified in the cohort matrix.`,
        ],
        kpis: [
          { metric: "Prime-slot female share", target: `≥ 45% (now ${k.primeSlotAvg}%)` },
          { metric: "Female coach share", target: `≥ ${Math.min(50, k.femaleCoachAvg + 10)}% (now ${k.femaleCoachAvg}%)` },
        ],
      },
      {
        title: "90-Day Retention Audit",
        badge: "Measure & Publish",
        actions: [
          `Re-measure U14→U18 adolescent dropout cliff (now ${k.dropoutCliff}%) and publish an anonymized progress report to Erasmus+ evaluators.`,
          `Ring-fence 40% of equipment/travel grants for U14–U18 girls. Current fee-subsidy share: ${k.feeSubsidyAvg}%. Addresses Eurostat 18pp socioeconomic gap (hlth_ehis_pe3i).`,
          `Run a full Eurobarometer-aligned participation survey across all cohorts; share findings with the EU Sport & Physical Activity network.`,
        ],
        kpis: [
          { metric: "Female participation share", target: `≥ ${Math.min(50, k.femaleActiveShare + 8)}% (now ${k.femaleActiveShare}%)` },
          { metric: "Adolescent dropout cliff", target: `≤ ${Math.max(0, k.dropoutCliff - 8)}% (now ${k.dropoutCliff}%)` },
          { metric: "Fee subsidy for girls", target: `≥ 40% (now ${k.feeSubsidyAvg}%)` },
        ],
      },
    ],
  };
}

// ── CSV Template ─────────────────────────────────────────────────────────────
export const CSV_TEMPLATE_CONTENT = `cohort,female_registered,female_active,male_registered,male_active,prime_slot_pct,female_coach_pct,puberty_support_score,fee_subsidy_pct
U12,58,51,138,128,28,8,20,22
U14,53,37,133,119,26,8,20,22
U16,46,20,128,109,24,8,20,22
U18,38,10,118,93,24,8,20,22
Uni19+,28,7,108,81,24,8,20,22
`;

/** Parse a CSV upload into CohortRow[] (strips PII columns per Law 03). */
export function parseClubCsv(
  text: string,
  clubId: string = "custom"
): { rows: CohortRow[]; warnings: string[] } {
  const PII_COLUMNS = ["name", "email", "phone", "student_id"];
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { rows: [], warnings: ["CSV has no data rows."] };

  const headers = lines[0]!.toLowerCase().split(",").map((h) => h.trim());
  const warnings: string[] = [];

  // Strip PII
  const piiFound = headers.filter((h) => PII_COLUMNS.includes(h));
  if (piiFound.length > 0) {
    warnings.push(`PII columns stripped (Law 03): ${piiFound.join(", ")}`);
  }

  const rows: CohortRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i]!.split(",").map((v) => v.trim());
    const get = (col: string) => {
      const idx = headers.indexOf(col);
      return idx >= 0 ? vals[idx] ?? "" : "";
    };
    const cohortRaw = get("cohort").toUpperCase().replace(/\s+/g, "");
    const ageMap: Record<string, AgeCohort> = {
      U12: "U12", U14: "U14", U16: "U16", U18: "U18",
      UNI19: "Uni19+", "UNI19+": "Uni19+", "UNI 19+": "Uni19+",
    };
    const age = ageMap[cohortRaw];
    if (!age) { warnings.push(`Row ${i + 1}: unrecognised cohort "${get("cohort")}" — skipped.`); continue; }

    const n = (col: string, fallback = 0) => {
      const v = parseFloat(get(col));
      return isNaN(v) ? fallback : v;
    };
    rows.push(
      makeRow(
        clubId as Club["id"],
        age,
        n("female_registered"), n("female_active"),
        n("male_registered"),   n("male_active"),
        n("prime_slot_pct"),    n("female_coach_pct"),
        n("puberty_support_score"), n("fee_subsidy_pct")
      )
    );
  }
  return { rows, warnings };
}
