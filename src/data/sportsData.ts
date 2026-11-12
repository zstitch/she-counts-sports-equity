// Synthetic, anonymized club datasets (zero PII). All KPIs computed below.
export type ClubId = "all" | "sarajevo-fc" | "bosna-bb" | "ilidza-vb" | "centar-tennis";
export const AGE_GROUPS = ["U10", "U12", "U14", "U16", "U18", "Senior"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export interface Club { id: Exclude<ClubId, "all">; name: string; sport: string }
export const clubs: Club[] = [
  { id: "sarajevo-fc", name: "Sarajevo Youth FC", sport: "Football" },
  { id: "bosna-bb", name: "Bosna Youth", sport: "Basketball" },
  { id: "ilidza-vb", name: "Ilidža Club", sport: "Volleyball" },
  { id: "centar-tennis", name: "Centar Tennis Academy", sport: "Youth Tennis" },
];
export const viewOptions: { id: ClubId; label: string }[] = [
  { id: "all", label: "All Grassroots Clubs" },
  ...clubs.map((c) => ({ id: c.id as ClubId, label: `${c.name} — ${c.sport}` })),
];

// cohort: registered at start of season and still active at end, per age group
interface CohortRow { clubId: Club["id"]; age: AgeGroup; femaleRegistered: number; femaleActive: number; maleRegistered: number; maleActive: number }
export const cohort: CohortRow[] = [
  ...row("sarajevo-fc", [[60, 52, 140, 130], [55, 39, 135, 121], [48, 23, 130, 111], [40, 12, 120, 98], [34, 9, 110, 85], [30, 7, 100, 73]]),
  ...row("bosna-bb", [[50, 45, 70, 64], [46, 35, 68, 61], [42, 23, 66, 56], [38, 14, 62, 51], [32, 10, 58, 46], [28, 8, 52, 39]]),
  ...row("ilidza-vb", [[70, 62, 40, 37], [66, 51, 38, 34], [60, 33, 36, 31], [52, 19, 34, 28], [44, 13, 30, 23], [38, 10, 28, 21]]),
  // Winter indoor-court squeeze + individual-sport injury dropout, spiking at U16
  ...row("centar-tennis", [[40, 36, 50, 46], [44, 34, 48, 42], [42, 28, 46, 38], [36, 13, 42, 33], [34, 15, 36, 26], [28, 12, 32, 22]]),
];
function row(clubId: Club["id"], v: number[][]): CohortRow[] {
  return v.map(([fr, fa, mr, ma], i) => ({ clubId, age: AGE_GROUPS[i]!, femaleRegistered: fr!, femaleActive: fa!, maleRegistered: mr!, maleActive: ma! }));
}

// participation: weekly session-hours booked, all slots
export const participation = [
  { clubId: "sarajevo-fc", femaleHours: 14, maleHours: 38 },
  { clubId: "bosna-bb", femaleHours: 12, maleHours: 22 },
  { clubId: "ilidza-vb", femaleHours: 20, maleHours: 14 },
  { clubId: "centar-tennis", femaleHours: 12, maleHours: 23 },
] as const;

// primeHours: Mon–Fri 18:00–21:00 slot-hours per day
const days = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
export const primeHours: { clubId: Club["id"]; day: (typeof days)[number]; female: number; male: number }[] = [
  ...days.map((day, i) => ({ clubId: "sarajevo-fc" as const, day, female: [1, 1, 0.5, 1, 0.5][i]!, male: [2, 2, 2.5, 2, 2.5][i]! })),
  ...days.map((day, i) => ({ clubId: "bosna-bb" as const, day, female: [1, 1.5, 1, 1, 1][i]!, male: [2, 1.5, 2, 2, 2][i]! })),
  ...days.map((day, i) => ({ clubId: "ilidza-vb" as const, day, female: [1.5, 1.5, 2, 1.5, 1][i]!, male: [1.5, 1.5, 1, 1.5, 2][i]! })),
  ...days.map((day) => ({ clubId: "centar-tennis" as const, day, female: 1, male: 2 })),
];

// coaching: licensed coaches by gender
export const coaching = [
  { clubId: "sarajevo-fc", femaleCoaches: 1, maleCoaches: 11 },
  { clubId: "bosna-bb", femaleCoaches: 2, maleCoaches: 6 },
  { clubId: "ilidza-vb", femaleCoaches: 3, maleCoaches: 4 },
  { clubId: "centar-tennis", femaleCoaches: 2, maleCoaches: 7 },
] as const;

const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));
const inView = (id: ClubId) => (r: { clubId: string }) => id === "all" || r.clubId === id;
const sum = <T,>(arr: T[], f: (t: T) => number) => arr.reduce((s, t) => s + f(t), 0);

export function computeKpis(id: ClubId) {
  const c = cohort.filter(inView(id));
  const ages = AGE_GROUPS.map((age) => {
    const r = c.filter((x) => x.age === age);
    const fr = sum(r, (x) => x.femaleRegistered), fa = sum(r, (x) => x.femaleActive);
    const mr = sum(r, (x) => x.maleRegistered), ma = sum(r, (x) => x.maleActive);
    return { age, female: pct(fa, fr), male: pct(ma, mr), fr, fa, mr, ma, gap: pct(ma, mr) - pct(fa, fr) };
  });
  const p = participation.filter(inView(id));
  const ph = primeHours.filter(inView(id));
  const days = (["Mon", "Tue", "Wed", "Thu", "Fri"] as const).map((day) => {
    const r = ph.filter((x) => x.day === day);
    return { day, female: sum(r, (x) => x.female), male: sum(r, (x) => x.male) };
  });
  const primeF = sum(days, (d) => d.female), primeM = sum(days, (d) => d.male);
  const fh = sum(p, (x) => x.femaleHours) + primeF, mh = sum(p, (x) => x.maleHours) + primeM;
  const femaleShare = pct(fh, fh + mh);
  const teen = c.filter((x) => x.age === "U16" || x.age === "U18");
  const teenReg = sum(teen, (x) => x.femaleRegistered), teenAct = sum(teen, (x) => x.femaleActive);
  // Active dropout risk = (U14 active girls − U18 active girls) / U14 registered girls
  const u14 = ages[2]!;
  const dropoutRisk = pct(Math.max(0, u14.fa - ages[4]!.fa), u14.fr);
  const co = coaching.filter(inView(id));
  const fc = sum(co, (x) => x.femaleCoaches), mc = sum(co, (x) => x.maleCoaches);
  const worstAge = [...ages].sort((a, b) => b.gap - a.gap)[0]!;
  const sportRep = clubs.filter((cl) => id === "all" || cl.id === id).map((cl) => {
    const r = cohort.filter((x) => x.clubId === cl.id);
    const f = sum(r, (x) => x.femaleRegistered), m = sum(r, (x) => x.maleRegistered);
    return { sport: cl.sport, club: cl.name, female: f, total: f + m, share: pct(f, f + m) };
  }).sort((a, b) => a.share - b.share)[0]!;
  return {
    ages, days, femaleShare, maleShare: 100 - femaleShare,
    primeF, primeM, primeRatio: primeF === 0 ? 0 : +(primeM / primeF).toFixed(2),
    dropoutRisk, teenReg, teenAct, teenFemaleActive: pct(teenAct, teenReg),
    femaleCoaches: fc, totalCoaches: fc + mc, coachShare: pct(fc, fc + mc),
    worstAge, sportRep,
  };
}
export type Kpis = ReturnType<typeof computeKpis>;

/** What-if model: each lever reduces hazard by a weighted, diminishing elasticity. Hypothetical. */
export function simulate(k: Kpis, primeShift: number, coachInc: number, parity: number) {
  const reduction = 1 - (1 - 0.0035 * primeShift) * (1 - 0.0025 * coachInc) * (1 - 0.002 * parity);
  const projected = Math.round(k.dropoutRisk * (1 - reduction) * 10) / 10;
  const retained = Math.round(((k.dropoutRisk - projected) / 100) * k.ages[2]!.fr);
  return { projected, retained };
}

export function interventionPlan(k: Kpis, label: string) {
  return {
    title: `90-Day Club Intervention Plan — ${label}`,
    cards: [
      { title: "30-Day Quick Wins", actions: [
        `Contact all ${k.teenReg - k.teenAct} lapsed girls in U16–U18 (of ${k.teenReg} registered) with a short exit survey.`,
        `Reserve at least 2 prime-time slots/week for girls (current ratio ${k.primeRatio}x male).`,
      ], kpis: [{ metric: "Prime-hour ratio (M:F)", target: `≤ ${Math.max(1, +(k.primeRatio - 0.3).toFixed(2))}x (now ${k.primeRatio}x)` }] },
      { title: "60-Day Structural Shifts", actions: [
        `Recruit ${Math.max(1, Math.ceil(k.totalCoaches * 0.4) - k.femaleCoaches)} female assistant coaches (now ${k.femaleCoaches}/${k.totalCoaches}).`,
        `Launch a ${k.worstAge.age} bridge squad targeting the ${k.worstAge.gap}-pt retention gap.`,
      ], kpis: [{ metric: "Female coach share", target: `≥ ${Math.min(50, k.coachShare + 10)}% (now ${k.coachShare}%)` }] },
      { title: "90-Day Retention Audit", actions: [
        `Re-measure prime-hour share and teen retention for ${k.sportRep?.club ?? "clubs"}.`,
        `Publish an anonymized progress report.`,
      ], kpis: [
        { metric: "Female participation share", target: `≥ ${Math.min(50, k.femaleShare + 10)}% (now ${k.femaleShare}%)` },
        { metric: "Active dropout risk", target: `≤ ${Math.max(0, k.dropoutRisk - 5)}% (now ${k.dropoutRisk}%)` },
      ] },
    ],
  };
}
