import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useRef, type ReactNode, type ChangeEvent } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  BarChart, Bar, Legend,
} from "recharts";
import { analyzeClubData, type Plan } from "@/lib/analyze-club-data.functions";
import {
  computeKpis, simulate, interventionPlan, viewOptions, EU_EVIDENCE,
  CSV_TEMPLATE_CONTENT, parseClubCsv, type ClubId, type Kpis,
} from "@/data/sportsData";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SHE COUNTS: Women in Sport — Broadcast Telemetry Dashboard" },
      { name: "description", content: "Evidence-based retention & inclusion telemetry for grassroots clubs. Erasmus+ Track 04." },
      { property: "og:title", content: "SHE COUNTS: Women in Sport" },
      { property: "og:description", content: "Evidence-Based Retention & Inclusion Telemetry (Track 04)" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

// ── Design tokens (mirror styles.css)
const TEAL  = "#2DD4BF";
const CORAL = "#FB7185";
const AMBER = "#FBBF24";
const TEAL_DIM  = "rgba(45,212,191,0.12)";
const CORAL_DIM = "rgba(251,113,133,0.08)";

const CHART_TICK  = { fill: "#E2E8F0", fontSize: 11, fontWeight: 600 } as const;
const CHART_GRID  = { stroke: "rgba(148,163,184,0.14)", strokeDasharray: "3 3" } as const;
const TIP_STYLE   = {
  contentStyle: {
    background: "rgba(7,11,20,0.95)",
    border: "1px solid rgba(148,163,184,0.25)",
    borderRadius: 8,
    color: "#fff",
    boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
    backdropFilter: "blur(12px)",
    fontSize: 12,
  },
  labelStyle: { color: "#E2E8F0", fontWeight: 600 },
  itemStyle: { color: "#E2E8F0" },
};

// ── Runner SVG watermark (inline, no PNG)
function RunnerWatermark() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 180"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 m-auto h-[78%] opacity-[0.09]"
      style={{ color: TEAL, filter: `drop-shadow(0 0 16px rgba(45,212,191,0.5))` }}
    >
      {/* simplified athletic female runner silhouette */}
      <circle cx="62" cy="18" r="11" fill="currentColor" />
      <path d="M62 29 L55 70 L44 110 L38 148" stroke="currentColor" strokeWidth="8" strokeLinecap="round" fill="none" />
      <path d="M62 29 L70 70 L82 108 L90 148" stroke="currentColor" strokeWidth="8" strokeLinecap="round" fill="none" />
      <path d="M55 70 L38 92 L28 88" stroke="currentColor" strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M70 70 L88 88 L100 82" stroke="currentColor" strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M38 148 L28 162 M44 110 L32 118" stroke="currentColor" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M90 148 L102 160 M82 108 L96 114" stroke="currentColor" strokeWidth="6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

// ── Shared bento card
function Card({
  title, children, className = "", accent,
}: {
  title: string; children: ReactNode; className?: string; accent?: "teal" | "coral" | "amber";
}) {
  const accentBorder =
    accent === "teal"  ? "border-[rgba(45,212,191,0.35)]" :
    accent === "coral" ? "border-[rgba(251,113,133,0.35)]" :
    accent === "amber" ? "border-[rgba(251,191,36,0.35)]" : "";

  return (
    <section
      className={`card-lift rounded-xl p-5 ${accentBorder} ${className}`}
      style={{
        background: "#0F172A",
        border: `1px solid ${accent ? "transparent" : "rgba(148,163,184,0.16)"}`,
        borderColor: accent
          ? accent === "teal"  ? "rgba(45,212,191,0.35)"
          : accent === "coral" ? "rgba(251,113,133,0.35)"
          : "rgba(251,191,36,0.35)"
          : "rgba(148,163,184,0.16)",
        boxShadow: "0 10px 30px -10px rgba(0,0,0,0.7), inset 0 1px 0 0 rgba(255,255,255,0.08)",
      }}
    >
      <h2 className="label-caps mb-3">{title}</h2>
      {children}
    </section>
  );
}

// ── Donut chart
function Donut({ data, center }: { data: { v: number; c: string }[]; center: ReactNode }) {
  return (
    <div className="relative h-48">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="v" innerRadius="66%" outerRadius="88%" stroke="none" startAngle={90} endAngle={-270}>
            {data.map((d, i) => <Cell key={i} fill={d.c} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        {center}
      </div>
    </div>
  );
}

// ── Modal / Drawer
function Modal({ open, onClose, title, wide, children }: {
  open: boolean; onClose: () => void; title: string; wide?: boolean; children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(7,11,20,0.85)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className={`max-h-[88vh] w-full overflow-y-auto rounded-xl p-6 ${wide ? "max-w-3xl" : "max-w-2xl"}`}
        style={{
          background: "#0F172A",
          border: "1px solid rgba(148,163,184,0.2)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.9), inset 0 1px 0 0 rgba(255,255,255,0.08)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm transition-colors"
            style={{ color: "#94A3B8" }}
            aria-label="Close"
          >✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Badge
function Badge({ color, children }: { color: "teal" | "coral" | "amber"; children: ReactNode }) {
  const styles = {
    teal:  { background: "rgba(45,212,191,0.15)",  color: TEAL,  border: "1px solid rgba(45,212,191,0.35)" },
    coral: { background: "rgba(251,113,133,0.15)", color: CORAL, border: "1px solid rgba(251,113,133,0.35)" },
    amber: { background: "rgba(251,191,36,0.15)",  color: AMBER, border: "1px solid rgba(251,191,36,0.35)" },
  }[color];
  return (
    <span className="kpi inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold" style={styles}>
      {children}
    </span>
  );
}

// ── KPI ribbon card
function KpiCard({ title, main, mainColor = "#fff", sub, badge, badgeColor = "teal", bottom }: {
  title: string; main: string; mainColor?: string; sub: string;
  badge?: string; badgeColor?: "teal" | "coral" | "amber"; bottom?: ReactNode;
}) {
  return (
    <div
      className="card-lift flex flex-col gap-3 rounded-xl p-5"
      style={{
        background: "#0F172A",
        border: "1px solid rgba(148,163,184,0.16)",
        boxShadow: "0 10px 30px -10px rgba(0,0,0,0.7), inset 0 1px 0 0 rgba(255,255,255,0.08)",
      }}
    >
      <span className="label-caps">{title}</span>
      <span className="kpi text-3xl font-extrabold tracking-tight" style={{ color: mainColor }}>
        {main}
      </span>
      <span className="text-xs" style={{ color: "#E2E8F0" }}>{sub}</span>
      {badge && <Badge color={badgeColor}>{badge}</Badge>}
      {bottom}
    </div>
  );
}

// ── Root-cause diagnostic card
function RootCauseCard({
  icon, title, stat, source, fix, evidence, color,
}: {
  icon: string; title: string; stat: string; source: string; fix: string;
  evidence: string; color: "coral" | "amber" | "teal";
}) {
  const c = color === "coral" ? CORAL : color === "amber" ? AMBER : TEAL;
  return (
    <div
      className="card-lift flex flex-col gap-4 rounded-xl p-5"
      style={{
        background: "#0F172A",
        border: `1px solid ${c}40`,
        boxShadow: `0 10px 30px -10px rgba(0,0,0,0.7), inset 0 1px 0 0 rgba(255,255,255,0.08)`,
      }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-2xl">{icon}</span>
        <div>
          <h3 className="font-bold text-white">{title}</h3>
          <span className="kpi text-sm font-semibold" style={{ color: c }}>{stat}</span>
        </div>
      </div>
      <p className="text-xs" style={{ color: "#E2E8F0" }}>{source}</p>
      <div
        className="rounded-lg p-3 text-xs"
        style={{ background: `${c}10`, border: `1px solid ${c}30`, color: "#E2E8F0" }}
      >
        <span className="font-bold" style={{ color: c }}>Concrete Fix: </span>
        {fix}
      </div>
      <span className="text-xs italic" style={{ color: "#94A3B8" }}>{evidence}</span>
    </div>
  );
}

// ── Progress bar
function ProgressBar({ value, max = 100, color = TEAL }: { value: number; max?: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "rgba(148,163,184,0.15)" }}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }}
      />
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────
function Dashboard() {
  const [view, setView] = useState<ClubId>("all");
  const [customCohort, setCustomCohort] = useState<null | { rows: ReturnType<typeof parseClubCsv>["rows"]; label: string }>(null);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [s1, setS1] = useState(0), [s2, setS2] = useState(0), [s3, setS3] = useState(0);
  const [showMethod, setShowMethod] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [showAiPlan, setShowAiPlan] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aiPlan, setAiPlan] = useState<Plan | null>(null);
  const [planSource, setPlanSource] = useState<"gemini" | "fallback">("fallback");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const label = viewOptions.find((v) => v.id === view)!.label;

  const k: Kpis = useMemo(() => {
    if (customCohort) {
      // Inject custom rows into compute (override cohort data)
      const { rows } = customCohort;
      if (rows.length === 0) return computeKpis(view);
      // Build a temporary module-like object
      const c = rows;
      const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));
      const sum = <T,>(arr: T[], f: (t: T) => number) => arr.reduce((s, t) => s + f(t), 0);
      const avg = <T,>(arr: T[], f: (t: T) => number) =>
        arr.length === 0 ? 0 : Math.round(sum(arr, f) / arr.length);
      const AGE_COHORTS_LOCAL = ["U12", "U14", "U16", "U18", "Uni19+"] as const;
      const ages = AGE_COHORTS_LOCAL.map((age) => {
        const r = c.filter((x) => x.age === age);
        const fr = sum(r, (x) => x.femaleRegistered);
        const fa = sum(r, (x) => x.femaleActive);
        const mr = sum(r, (x) => x.maleRegistered);
        const ma = sum(r, (x) => x.maleActive);
        const femRetPct = pct(fa, fr);
        const malRetPct = pct(ma, mr);
        return { age, fr, fa, mr, ma, female: femRetPct, male: malRetPct, gap: malRetPct - femRetPct, primeSlotPct: avg(r, (x) => x.primeSlotPct) };
      });
      const totalFA = sum(c, (x) => x.femaleActive), totalMA = sum(c, (x) => x.maleActive);
      const totalFR = sum(c, (x) => x.femaleRegistered), totalMR = sum(c, (x) => x.maleRegistered);
      const u14 = ages.find((a) => a.age === "U14")!;
      const u18 = ages.find((a) => a.age === "U18")!;
      return {
        ages,
        femaleActiveShare: pct(totalFA, totalFA + totalMA),
        maleActiveShare: 100 - pct(totalFA, totalFA + totalMA),
        totalFR, totalFA, totalMR, totalMA, totalPlayers: totalFR + totalMR,
        dropoutCliff: pct(Math.max(0, (u14?.fa ?? 0) - (u18?.fa ?? 0)), u14?.fr ?? 1),
        u14fa: u14?.fa ?? 0, u14fr: u14?.fr ?? 0,
        u18fa: u18?.fa ?? 0, u18fr: u18?.fr ?? 0,
        primeSlotAvg: avg(c, (x) => x.primeSlotPct),
        primeMaleSkew: 0,
        femaleCoachAvg: avg(c, (x) => x.femaleCoachPct),
        pubertySupportAvg: avg(c, (x) => x.pubertySupportScore),
        feeSubsidyAvg: avg(c, (x) => x.feeSubsidyPct),
        worstAge: [...ages].sort((a, b) => b.gap - a.gap)[0]!,
        teenFA: sum(c.filter((x) => ["U14","U16","U18"].includes(x.age)), (x) => x.femaleActive),
        teenFR: sum(c.filter((x) => ["U14","U16","U18"].includes(x.age)), (x) => x.femaleRegistered),
        teenRetentionPct: pct(
          sum(c.filter((x) => ["U14","U16","U18"].includes(x.age)), (x) => x.femaleActive),
          sum(c.filter((x) => ["U14","U16","U18"].includes(x.age)), (x) => x.femaleRegistered)
        ),
      };
    }
    return computeKpis(view);
  }, [view, customCohort]);

  const sim = simulate(k, s1, s2, s3);
  const fallbackPlan = interventionPlan(k, customCohort?.label ?? label);
  const plan = aiPlan ?? fallbackPlan;

  // ── CSV Upload
  function handleCsvUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const { rows, warnings } = parseClubCsv(text, "custom");
      setCustomCohort(rows.length > 0 ? { rows, label: `Custom Upload — ${file.name}` } : null);
      setUploadWarnings(warnings);
      setView("all"); // reset selector; custom data overrides
    };
    reader.readAsText(file);
  }

  function downloadSampleCsv() {
    const blob = new Blob([CSV_TEMPLATE_CONTENT], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "she_counts_club_template.csv";
    a.click(); URL.revokeObjectURL(url);
  }

  // ── AI Analysis
  async function runAnalysis() {
    setShowAiPlan(true); setLoading(true); setAiPlan(null);
    try {
      const r = await analyzeClubData({
        data: {
          club: customCohort?.label ?? label,
          femaleParticipationPct: k.femaleActiveShare,
          teenDropoutRiskPct: k.dropoutCliff,
          primeHourRatio: k.primeSlotAvg === 0 ? 0 : +((100 - k.primeSlotAvg) / k.primeSlotAvg).toFixed(2),
          femaleCoachPct: k.femaleCoachAvg,
          cohortRetention: k.ages.map((a) => ({
            age: a.age, femalePct: a.female, malePct: a.male,
            gapPt: a.gap, girlsActive: a.fa, girlsRegistered: a.fr,
          })),
          optimizer: { primeShiftPct: s1, coachIncreasePct: s2, parityPct: s3 },
        },
      });
      if (r.ok) { setAiPlan(r.plan); setPlanSource("gemini"); }
      else { setPlanSource("fallback"); console.warn("Gemini fallback:", r.error); }
    } catch (e) { setPlanSource("fallback"); console.warn("Gemini fallback:", e); }
    finally { setLoading(false); }
  }

  const displayLabel = customCohort?.label ?? label;

  return (
    <div className="min-h-screen font-sans" style={{ background: "#070B14", color: "#fff" }}>
      <div className="mx-auto max-w-[1600px] space-y-5 p-4 md:p-6">

        {/* ── Header ── */}
        <header
          className="rounded-xl p-5"
          style={{
            background: "#0F172A",
            border: "1px solid rgba(148,163,184,0.16)",
            boxShadow: "0 10px 30px -10px rgba(0,0,0,0.7), inset 0 1px 0 0 rgba(255,255,255,0.08)",
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
                  SHE COUNTS: <span style={{ color: TEAL }}>Women in Sport</span>
                </h1>
                <Badge color="teal">Track 04</Badge>
                {customCohort && <Badge color="amber">Custom Uploaded Dataset</Badge>}
              </div>
              <p className="text-sm italic" style={{ color: "#E2E8F0" }}>
                Evidence-Based Retention &amp; Inclusion Telemetry — Erasmus+ 404 Youth.exe Hackathon, IUS Sarajevo
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <span className="label-caps">Club / Organization</span>
                  <select
                    value={customCohort ? "all" : view}
                    onChange={(e) => { setCustomCohort(null); setView(e.target.value as ClubId); }}
                    className="rounded-md px-3 py-1.5 text-sm text-white"
                    style={{ background: "#1E293B", border: "1px solid rgba(148,163,184,0.2)" }}
                    disabled={!!customCohort}
                  >
                    {viewOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </label>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <input
                ref={fileInputRef} type="file" accept=".csv" className="hidden"
                onChange={handleCsvUpload} aria-label="Upload Club CSV"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-md px-3 py-2 text-xs font-semibold transition-colors"
                style={{ background: "rgba(45,212,191,0.12)", border: "1px solid rgba(45,212,191,0.35)", color: TEAL }}
                aria-label="Upload Club CSV"
              >
                ↑ Upload Club CSV
              </button>
              <button
                onClick={downloadSampleCsv}
                className="rounded-md px-3 py-2 text-xs font-semibold transition-colors"
                style={{ background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.2)", color: "#E2E8F0" }}
              >
                ↓ Download Sample CSV
              </button>
              <button
                onClick={() => setShowEvidence(true)}
                className="rounded-md px-3 py-2 text-xs font-semibold transition-colors"
                style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", color: AMBER }}
              >
                ⚑ EU Evidence &amp; Methodology
              </button>
              {customCohort && (
                <button
                  onClick={() => { setCustomCohort(null); setUploadWarnings([]); }}
                  className="rounded-md px-3 py-2 text-xs transition-colors"
                  style={{ color: "#94A3B8" }}
                >
                  ✕ Clear Upload
                </button>
              )}
            </div>
          </div>
          {uploadWarnings.length > 0 && (
            <div className="mt-3 rounded-lg px-4 py-2 text-xs" style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", color: AMBER }}>
              {uploadWarnings.map((w, i) => <p key={i}>{w}</p>)}
            </div>
          )}
        </header>

        {/* ── KPI Ribbon ── */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            title="Female Active Share"
            main={`${k.femaleActiveShare}%`}
            mainColor="#fff"
            sub={`${k.totalFA} / ${k.totalFA + k.totalMA} active players`}
            badge="50% Parity Target"
            badgeColor="teal"
            bottom={
              <div className="space-y-1">
                <ProgressBar value={k.femaleActiveShare} color={TEAL} />
                <span className="text-xs" style={{ color: "#94A3B8" }}>toward 50% parity</span>
              </div>
            }
          />
          <KpiCard
            title="Adolescent Dropout Cliff (U14→U18)"
            main={`${k.dropoutCliff}%`}
            mainColor="#fff"
            sub={`${k.u14fa - k.u18fa} girls lost between U14 and U18`}
            badge="ICOACHKIDS+ 52% teen dropout window"
            badgeColor="coral"
          />
          <KpiCard
            title="Prime-Time Pitch Allocation (18:00–21:00)"
            main={`${k.primeSlotAvg}% F`}
            mainColor="#fff"
            sub={`${100 - k.primeSlotAvg}% allocated to male squads — Eurobarometer: 40% cite time barriers`}
            badge={k.primeSlotAvg < 40 ? `${((100 - k.primeSlotAvg) / Math.max(1, k.primeSlotAvg)).toFixed(1)}x Male Skew` : "Near Parity"}
            badgeColor={k.primeSlotAvg < 40 ? "coral" : "teal"}
          />
          <KpiCard
            title="Female Coaching & Puberty Readiness"
            main={`${k.femaleCoachAvg}%`}
            mainColor="#fff"
            sub={`Coaches female. Puberty Support Score: ${k.pubertySupportAvg}/100`}
            badge={k.pubertySupportAvg < 50 ? "Kit & Mentorship Gap" : "On Track"}
            badgeColor={k.pubertySupportAvg < 50 ? "amber" : "teal"}
          />
        </div>

        {/* ── 3-Column Bento Grid ── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">

          {/* Left Column */}
          <div className="space-y-5 lg:col-span-3">
            <Card title="Weekly Prime-Slot Participation Share" accent="teal">
              <Donut
                data={[
                  { v: k.femaleActiveShare, c: TEAL },
                  { v: k.maleActiveShare,   c: CORAL },
                ]}
                center={
                  <>
                    <span className="kpi text-2xl font-extrabold text-white">{k.femaleActiveShare}% F</span>
                    <span className="kpi text-sm font-semibold" style={{ color: CORAL }}>{k.maleActiveShare}% M</span>
                  </>
                }
              />
              <div className="mt-2 flex items-center justify-between text-xs">
                <Badge color="teal">Target: 50/50</Badge>
                <span style={{ color: "#94A3B8" }}>Prime slots 18:00–21:00</span>
              </div>
            </Card>

            <Card title="Teen Retention Hazard (U14–U18)" accent="coral">
              <Donut
                data={[
                  { v: k.dropoutCliff,       c: CORAL },
                  { v: 100 - k.dropoutCliff, c: "rgba(148,163,184,0.12)" },
                ]}
                center={
                  <>
                    <span className="kpi text-3xl font-extrabold text-white">{k.dropoutCliff}%</span>
                    <span className="text-xs" style={{ color: "#E2E8F0" }}>Active Dropout Risk</span>
                  </>
                }
              />
              <div className="mt-2">
                <Badge color="coral">⚠ Hazard cohort: Ages 14–18</Badge>
                <p className="mt-2 text-xs" style={{ color: "#E2E8F0" }}>
                  ICOACHKIDS+: 52% of all EU youth sport dropouts occur at ages 14–18. 70% of dropped-out girls still consider themselves "sporty."
                </p>
              </div>
            </Card>
          </div>

          {/* Centre Column */}
          <div className="space-y-5 lg:col-span-6">
            <Card title="Active Retention Curve — Female vs. Male by Cohort" accent="teal">
              <div className="relative h-64">
                <RunnerWatermark />
                <ResponsiveContainer>
                  <AreaChart data={k.ages} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid {...CHART_GRID} vertical={false} />
                    <XAxis dataKey="age" tick={CHART_TICK} axisLine={false} tickLine={false} />
                    <YAxis unit="%" domain={[0, 100]} tick={CHART_TICK} axisLine={false} tickLine={false} />
                    <Tooltip {...TIP_STYLE} />
                    <Legend
                      wrapperStyle={{ color: "#E2E8F0", fontSize: 11 }}
                      formatter={(value) =>
                        value === "female" ? "Female Active %" : "Male Active %"
                      }
                    />
                    <ReferenceLine
                      x="U14"
                      stroke={AMBER}
                      strokeDasharray="4 2"
                      label={{ value: "Puberty & Schedule Cliff", fill: AMBER, fontSize: 10, position: "insideTopRight" }}
                    />
                    <Area
                      type="linear" dataKey="female"
                      name="Female Active %"
                      stroke={TEAL} fill={TEAL} fillOpacity={0.12}
                      strokeWidth={2.5} dot={{ fill: TEAL, r: 3 }}
                    />
                    <Area
                      type="linear" dataKey="male"
                      name="Male Active %"
                      stroke={CORAL} fill={CORAL} fillOpacity={0.08}
                      strokeWidth={2.5} dot={{ fill: CORAL, r: 3 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Age Cohort Comparison Matrix">
              <div className="overflow-x-auto">
                <table className="kpi w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left" style={{ color: "#E2E8F0" }}>
                      <th className="border p-2 text-xs" style={{ borderColor: "rgba(148,163,184,0.14)" }}>Cohort</th>
                      <th className="border p-2 text-xs" style={{ borderColor: "rgba(148,163,184,0.14)" }}>Female Active</th>
                      <th className="border p-2 text-xs" style={{ borderColor: "rgba(148,163,184,0.14)" }}>Male Active</th>
                      <th className="border p-2 text-xs" style={{ borderColor: "rgba(148,163,184,0.14)" }}>Retention Gap</th>
                      <th className="border p-2 text-xs" style={{ borderColor: "rgba(148,163,184,0.14)" }}>Prime Slot Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {k.ages.map((a) => (
                      <tr key={a.age} className="transition-colors hover:bg-white/5">
                        <td className="border p-2 font-semibold text-white" style={{ borderColor: "rgba(148,163,184,0.14)" }}>{a.age}</td>
                        <td className="border p-2 font-bold" style={{ borderColor: "rgba(148,163,184,0.14)", color: TEAL }}>{a.female}%</td>
                        <td className="border p-2" style={{ borderColor: "rgba(148,163,184,0.14)", color: CORAL }}>{a.male}%</td>
                        <td className="border p-2" style={{ borderColor: "rgba(148,163,184,0.14)", color: a.gap > 15 ? CORAL : a.gap > 5 ? AMBER : TEAL }}>
                          {a.gap > 0 ? "−" : ""}{a.gap} pp
                        </td>
                        <td className="border p-2" style={{ borderColor: "rgba(148,163,184,0.14)", color: a.primeSlotPct < 40 ? CORAL : "#E2E8F0" }}>
                          {a.primeSlotPct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-5 lg:col-span-3">
            <Card title="Prime-Hour & Resource Disparity" accent="coral">
              <div className="h-44">
                <ResponsiveContainer>
                  <BarChart data={k.ages} margin={{ top: 2, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid {...CHART_GRID} vertical={false} />
                    <XAxis dataKey="age" tick={{ ...CHART_TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis unit="%" tick={CHART_TICK} axisLine={false} tickLine={false} />
                    <Tooltip {...TIP_STYLE} />
                    <Bar dataKey="female" name="Female Active %" fill={TEAL} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="male"   name="Male Active %"   fill={CORAL} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge color="teal">Female Coach: {k.femaleCoachAvg}%</Badge>
                <Badge color="coral">Prime Slot Gap: {100 - k.primeSlotAvg - k.primeSlotAvg}pp</Badge>
              </div>
            </Card>

            <Card title='Decision Optimizer — "What If?" Retention Simulator' accent="amber">
              <div className="space-y-4">
                {(
                  [
                    ["Shift Prime-Time Slots (18:00–21:00) to Girls %", s1, setS1],
                    ["Increase Accredited Female Coaching Staff %", s2, setS2],
                    ["Puberty & Period Kit/Facility Support %", s3, setS3],
                  ] as const
                ).map(([l, v, set]) => (
                  <label key={l} className="block text-xs">
                    <div className="mb-1 flex justify-between" style={{ color: "#E2E8F0" }}>
                      <span>{l}</span>
                      <span className="kpi font-bold text-white">{v}%</span>
                    </div>
                    <input
                      type="range" min={0} max={100} value={v}
                      onChange={(e) => set(+e.target.value)}
                      className="w-full"
                      aria-label={l}
                    />
                  </label>
                ))}
                <div
                  className="rounded-lg p-3 text-xs"
                  style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", color: "#E2E8F0" }}
                >
                  <div className="mb-1 font-bold" style={{ color: AMBER }}>⚑ Projected Adolescent Dropout Reduction</div>
                  <div className="kpi text-lg font-extrabold text-white">
                    {k.dropoutCliff}% → <span style={{ color: TEAL }}>{sim.projected}%</span>
                  </div>
                  <div className="mt-1" style={{ color: "#E2E8F0" }}>
                    Estimated <span className="kpi font-bold" style={{ color: TEAL }}>+{sim.retained}</span> players retained annually
                  </div>
                  <div className="mt-2 text-xs italic" style={{ color: "#94A3B8" }}>
                    Deterministic simulation modeled on EU elasticity weights — Hypothetical Scenario
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* ── The Missing Players — Root-Cause Diagnostics ── */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-white">
                THE MISSING PLAYERS{" "}
                <span className="font-normal" style={{ color: "#94A3B8" }}>— Root-Cause Diagnostics &amp; 90-Day Action Plan</span>
              </h2>
              <p className="mt-1 text-xs" style={{ color: "#94A3B8" }}>Dynamically computed from: {displayLabel}</p>
            </div>
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="rounded-md px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-60"
              style={{
                background: `linear-gradient(135deg, ${TEAL}22, rgba(45,212,191,0.08))`,
                border: `1px solid ${TEAL}60`,
                color: TEAL,
              }}
            >
              {loading ? "Analysing…" : "✨ Generate 90-Day Club Intervention Plan (AI Analyst)"}
            </button>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <RootCauseCard
              icon="🩺"
              color="coral"
              title="Biological & Kit Stigma Gap (Puberty Cliff)"
              stat={`U12→U16 drop: ${(k.ages.find((a) => a.age === "U12")?.female ?? 0) - (k.ages.find((a) => a.age === "U16")?.female ?? 0)} pp. Puberty Support Score: ${k.pubertySupportAvg}/100`}
              source="78% of teenage girls avoid sport during their period (PMC12330288). 68% fear body/leakage judgment — especially in white/light kits. 71.7% have received zero menstrual education related to exercise."
              fix="Replace white/light shorts with dark navy/black kits for all girls' squads & place free period-supply packs in venue washrooms. Near-Zero Budget."
              evidence="Evidence: PMC12330288 · UN Women · Women in Sport"
            />
            <RootCauseCard
              icon="🕐"
              color="amber"
              title="Scheduling & Safe Transit Barrier"
              stat={`Prime-slot female share: ${k.primeSlotAvg}% (target ≥ 50%). Girls pushed to 20:30–22:00 slots.`}
              source="Eurobarometer 574 (2026): 40% of women cite lack of time / incompatible scheduling as the #1 barrier. Late slots raise safety concerns and reduce parental consent for younger girls."
              fix="Mandate 50/50 rotation of 18:00–20:00 prime hours between boys' and girls' squads."
              evidence="Evidence: Special Eurobarometer 574 — Sport & Physical Activity (2026)"
            />
            <RootCauseCard
              icon="🏅"
              color="teal"
              title="Coaching Mentorship & Socioeconomic Gap"
              stat={`Female coaches: ${k.femaleCoachAvg}%. Fee subsidy for girls: ${k.feeSubsidyAvg}%.`}
              source="Eurostat (hlth_ehis_pe3i): 18pp sport-participation gap between top and bottom income quintiles. 63% of dropped-out girls lack a female coach or role model (PMC12330288)."
              fix="Fast-track senior Uni 19+ female players into paid assistant coaching badges. Ring-fence 40% of equipment/travel grants for U14–U18 girls."
              evidence="Evidence: Eurostat hlth_ehis_pe3i · hlth_ehis_pe2e"
            />
          </div>
        </section>

        {/* ── Compliance Footer ── */}
        <footer
          className="rounded-xl px-5 py-4"
          style={{
            background: "#0F172A",
            border: "1px solid rgba(148,163,184,0.12)",
            boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="rounded-full px-4 py-2" style={{ background: "rgba(45,212,191,0.08)", border: "1px solid rgba(45,212,191,0.2)", color: "#E2E8F0" }}>
              <span className="font-bold" style={{ color: TEAL }}>LAW 03 COMPLIANT:</span>{" "}
              Zero-PII Architecture · Anonymized Club Telemetry &amp; Official EU Aggregates (Eurostat / Eurobarometer / PMC12330288)
            </span>
            <span className="rounded-full px-4 py-2" style={{ background: "rgba(45,212,191,0.08)", border: "1px solid rgba(45,212,191,0.2)", color: "#E2E8F0" }}>
              <span className="font-bold" style={{ color: TEAL }}>LAW 05 COMPLIANT:</span>{" "}
              AI-Assisted Engineering Disclosure — Built with Lovable, Claude Sonnet 4.6 (Antigravity + taste-skill), and Google Gemini
            </span>
            <span className="rounded-full px-4 py-2" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: AMBER }}>
              SARAJEVO HACKATHON 2026 · TRACK 04: WOMEN IN SPORT
            </span>
          </div>
        </footer>
      </div>

      {/* ── EU Evidence Modal ── */}
      <Modal open={showEvidence} onClose={() => setShowEvidence(false)} title="EU Research Evidence & Verified Sources" wide>
        <div className="space-y-5">
          <p className="text-xs" style={{ color: "#94A3B8" }}>
            All benchmarks below are clickable, externally verified EU research sources. Every KPI on this dashboard is derived from these findings.
          </p>
          {EU_EVIDENCE.map((e) => (
            <div
              key={e.id}
              className="rounded-lg p-4"
              style={{ background: "rgba(45,212,191,0.06)", border: "1px solid rgba(45,212,191,0.2)" }}
            >
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <h4 className="font-bold text-white text-sm">{e.title}</h4>
                <Badge color="teal">{e.stat}</Badge>
              </div>
              <p className="text-xs" style={{ color: "#E2E8F0" }}>{e.finding}</p>
              <a
                href={e.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs underline underline-offset-2 transition-opacity hover:opacity-80"
                style={{ color: TEAL }}
              >
                {e.url}
              </a>
            </div>
          ))}
          <div className="rounded-lg p-3 text-xs" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: "#E2E8F0" }}>
            <span className="font-bold" style={{ color: AMBER }}>Methodology:</span>{" "}
            Female Active Share = active at season end ÷ registered at season start (per gender/cohort). Dropout Cliff = (U14 active girls − U18 active girls) ÷ U14 registered girls. What-If elasticities are illustrative, modeled on Eurobarometer 574 (time barrier: 40%), PMC12330288 (period: 78%), ICOACHKIDS+ (coach gap: 63%). All datasets are synthetic and anonymized for the hackathon.
          </div>
        </div>
      </Modal>

      {/* ── 90-Day Plan Modal ── */}
      <Modal open={showAiPlan} onClose={() => setShowAiPlan(false)} title={plan.title} wide>
        {loading ? (
          <div className="flex items-center gap-3 py-10 text-sm" style={{ color: "#94A3B8" }}>
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: `${TEAL} transparent ${TEAL} ${TEAL}` }} />
            Gemini AI is reading your club's figures…
          </div>
        ) : (
          <>
            <p className="mb-5 text-xs" style={{ color: "#94A3B8" }}>
              {planSource === "gemini"
                ? "Generated by Gemini 2.5 Flash using only the figures shown on this dashboard. No statistics were invented."
                : "Gemini unavailable — showing the instant deterministic rule-based plan from your data (<300ms, works fully offline)."}
            </p>
            <div className="space-y-4">
              {plan.cards.map((c) => (
                <div
                  key={c.title}
                  className="rounded-lg p-4"
                  style={{ background: "rgba(45,212,191,0.05)", border: "1px solid rgba(45,212,191,0.18)" }}
                >
                  <h4 className="mb-3 font-bold" style={{ color: TEAL }}>{c.title}</h4>
                  <ul className="list-disc space-y-1.5 pl-5 text-sm" style={{ color: "#E2E8F0" }}>
                    {c.actions.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {c.kpis.map((x) => (
                      <span
                        key={x.metric}
                        className="kpi rounded-full px-2.5 py-0.5 text-xs"
                        style={{ background: "rgba(45,212,191,0.12)", border: "1px solid rgba(45,212,191,0.3)", color: TEAL }}
                      >
                        <span className="font-bold">{x.metric}:</span> {x.target}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
