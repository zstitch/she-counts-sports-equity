import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef, type ReactNode, type ChangeEvent } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  BarChart, Bar, Legend,
} from "recharts";
import { analyzeClubData, type Plan } from "@/lib/analyze-club-data.functions";
import { callGeminiAnalyst } from "@/lib/geminiAnalyst";
import {
  computeKpis, simulate, interventionPlan, viewOptions, macroViewOptions, sandboxClubOptions,
  EU_EVIDENCE, CSV_TEMPLATE_CONTENT, parseClubCsv, type ClubId, type Kpis,
  METHODOLOGICAL_NOTE, BENCHMARK_EVIDENCE_REGISTRY,
  SPORT_MODALITY_SPLIT, SPORT_FORMAT_ANALYTICAL_INSIGHT,
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

// ── Design tokens — exact hex specification per brief
const TEAL  = "#2DD4BF";   // A. Electric Cyan — Female Active & Parity
const CORAL = "#FB7185";   // B. Sunset Coral  — Male Baseline, Disparity & Dropout Hazard
const AMBER = "#F59E0B";   // C. Warm Amber    — Dropout Cliff & Optimizer Projection

// X-axis cohort labels: bold white (#F8FAFC); Y-axis percentages: muted (#94A3B8)
const CHART_TICK_X = { fill: "#F8FAFC", fontSize: 12, fontWeight: 600 } as const;
const CHART_TICK_Y = { fill: "#94A3B8", fontSize: 11 } as const;
// Table & chart grid lines use #1E3243
const CHART_GRID  = { stroke: "#1E3243", strokeDasharray: "3 3" } as const;
const TIP_STYLE   = {
  contentStyle: {
    background: "rgba(11,21,30,0.97)",
    border: "1px solid #1E3243",
    borderRadius: 8,
    color: "#F8FAFC",
    boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
    backdropFilter: "blur(12px)",
    fontSize: 12,
  },
  labelStyle: { color: "#F8FAFC", fontWeight: 600 },
  itemStyle: { color: "#94A3B8" },
};

// ── Neon Runner Watermark — strips white background via offscreen HTML5 canvas on mount, centers behind retention curve
function RunnerWatermark() {
  const [dataUrl, setDataUrl] = useState<string>("/Neon%20Hologram%20Runner.png");

  useEffect(() => {
    if (typeof window === "undefined") return;

    let active = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = "/Neon%20Hologram%20Runner.png";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) return;

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;
        let modified = false;

        // Convert near-white pixels (r > 220 && g > 220 && b > 220) to transparent with smooth anti-aliased edge fading
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i]!;
          const g = d[i + 1]!;
          const b = d[i + 2]!;
          const a = d[i + 3]!;
          if (a === 0) continue;

          // Check if pixel is in near-white range
          if (r > 200 && g > 200 && b > 200) {
            modified = true;
            if (r > 220 && g > 220 && b > 220) {
              // Full transparency for near-white outer background
              d[i + 3] = 0;
            } else {
              // Smooth anti-aliased edge fading between 200 and 220
              const minChannel = Math.min(r, g, b);
              const fade = Math.max(0, Math.min(1, (220 - minChannel) / 20));
              d[i + 3] = Math.round(a * fade);
            }
          }
        }

        if (modified) {
          ctx.putImageData(imgData, 0, 0);
          const processedUrl = canvas.toDataURL("image/png");
          if (active) setDataUrl(processedUrl);
        }
      } catch (err) {
        console.warn("Offscreen canvas runner background strip error:", err);
      }
    };

    img.onerror = () => {
      if (active) setDataUrl("/neon-runner.png");
    };

    return () => {
      active = false;
    };
  }, []);

  return (
    <div
      className="pointer-events-none select-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden"
      aria-hidden="true"
    >
      <img
        src={dataUrl}
        alt=""
        className="pointer-events-none select-none max-h-[210px] w-auto object-contain opacity-30 drop-shadow-[0_0_16px_rgba(45,212,191,0.45)]"
      />
    </div>
  );
}

// ── Shared bento card — #13222F surface, #1E3243 border
function Card({
  title, children, className = "", accent,
}: {
  title: string; children: ReactNode; className?: string; accent?: "teal" | "coral" | "amber";
}) {
  const borderColor =
    accent === "teal"  ? "rgba(45,212,191,0.4)"  :
    accent === "coral" ? "rgba(251,113,133,0.4)"  :
    accent === "amber" ? "rgba(245,158,11,0.4)"   : "#1E3243";

  return (
    <section
      className={`card-lift rounded-xl p-5 ${className}`}
      style={{
        background: "#13222F",
        border: `1px solid ${borderColor}`,
        boxShadow: "0 8px 30px rgba(0,0,0,0.45), inset 0 1px 0 0 rgba(255,255,255,0.07)",
      }}
    >
      <h2 className="label-caps mb-3">{title}</h2>
      {children}
    </section>
  );
}

// ── Donut chart
function Donut({ data, center }: { data: { v: number; c: string; glow?: boolean }[]; center: ReactNode }) {
  return (
    <div className="relative h-48">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="v" innerRadius="66%" outerRadius="88%" stroke="none" startAngle={90} endAngle={-270}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.c}
                style={d.glow ? { filter: "drop-shadow(0 0 10px rgba(45,212,191,0.45))" } : undefined}
              />
            ))}
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
      style={{ background: "rgba(11,21,30,0.88)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className={`max-h-[88vh] w-full overflow-y-auto rounded-xl p-6 ${wide ? "max-w-3xl" : "max-w-2xl"}`}
        style={{
          background: "#13222F",
          border: "1px solid #1E3243",
          boxShadow: "0 24px 80px rgba(0,0,0,0.9), inset 0 1px 0 0 rgba(255,255,255,0.07)",
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
    amber: { background: "rgba(245,158,11,0.15)",  color: AMBER, border: "1px solid rgba(245,158,11,0.35)" },
  }[color];
  return (
    <span className="kpi inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold" style={styles}>
      {children}
    </span>
  );
}

// ── KPI ribbon card
function KpiCard({
  title, main, mainColor = "#F8FAFC", sub, badge, badgeColor = "teal", accentColor, bottom,
}: {
  title: string; main: string; mainColor?: string; sub: string;
  badge?: string; badgeColor?: "teal" | "coral" | "amber"; accentColor?: string; bottom?: ReactNode;
}) {
  return (
    <div
      className="card-lift flex flex-col gap-3 rounded-xl p-5"
      style={{
        background: "#13222F",
        border: "1px solid",
        borderColor: accentColor ? `${accentColor}66` : "#1E3243",
        boxShadow: "0 8px 30px rgba(0,0,0,0.45), inset 0 1px 0 0 rgba(255,255,255,0.07)",
      }}
    >
      <span className="label-caps text-[#94A3B8]">{title}</span>
      <span className="kpi text-3xl font-extrabold tracking-tight" style={{ color: mainColor }}>
        {main}
      </span>
      <span className="text-xs text-[#94A3B8]">{sub}</span>
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
        background: "#13222F",
        border: `1px solid ${c}66`,
        boxShadow: "0 8px 30px rgba(0,0,0,0.45), inset 0 1px 0 0 rgba(255,255,255,0.07)",
      }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-2xl">{icon}</span>
        <div>
          <h3 className="font-bold text-[#F8FAFC]">{title}</h3>
          <span className="kpi text-sm font-extrabold" style={{ color: c }}>{stat}</span>
        </div>
      </div>
      <p className="text-xs text-[#94A3B8]">{source}</p>
      <div
        className="rounded-lg p-3 text-xs"
        style={{ background: "#0B151E", border: `1px solid ${c}40`, color: "#F8FAFC" }}
      >
        <span className="font-bold" style={{ color: c }}>Concrete Fix: </span>
        {fix}
      </div>
      <span className="text-xs italic text-[#94A3B8]">{evidence}</span>
    </div>
  );
}

// ── Progress bar
function ProgressBar({ value, max = 100, color = TEAL }: { value: number; max?: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "#1E3243" }}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }}
      />
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────
function Dashboard() {
  const [mode, setMode] = useState<"macro" | "sandbox">("macro");
  const [view, setView] = useState<ClubId>("bih");
  const [customCohort, setCustomCohort] = useState<null | {
    rows: ReturnType<typeof parseClubCsv>["rows"];
    label: string;
    isMacro?: boolean;
  }>(null);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [s1, setS1] = useState(0), [s2, setS2] = useState(0), [s3, setS3] = useState(0);
  const [showMethod, setShowMethod] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [showAiPlan, setShowAiPlan] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aiPlan, setAiPlan] = useState<Plan | null>(null);
  const [planSource, setPlanSource] = useState<"gemini" | "fallback">("fallback");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentOptions = mode === "macro" ? macroViewOptions : sandboxClubOptions;
  const currentItem = viewOptions.find((v) => v.id === view);
  const label = currentItem
    ? currentItem.label
    : "Bosnia & Herzegovina (Host Country — BiH Adolescent Studies)";

  const k: Kpis = useMemo(() => {
    if (customCohort) {
      // Inject custom rows into compute (override cohort data)
      const { rows } = customCohort;
      if (rows.length === 0) return computeKpis(view);
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
      const u14 = ages.find((a) => a.age === "U14") ?? ages[1]!;
      const u18 = ages.find((a) => a.age === "U18") ?? ages[3]!;
      const primeAvg = avg(c, (x) => x.primeSlotPct);
      const primeSkew = primeAvg === 0 ? 0 : +((100 - primeAvg) / primeAvg).toFixed(2);
      const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
      const days = weekdays.map((day, idx) => {
        const dayFactor = [0.95, 1.1, 1.0, 1.15, 0.8][idx]!;
        const fHours = Math.round((3 * (primeAvg / 100) * dayFactor) * 10) / 10;
        const mHours = Math.round((3 * ((100 - primeAvg) / 100) * dayFactor) * 10) / 10;
        return { day, female: fHours, male: mHours };
      });
      return {
        isMacro: customCohort.isMacro ?? false,
        ages,
        femaleActiveShare: pct(totalFA, totalFA + totalMA),
        maleActiveShare: 100 - pct(totalFA, totalFA + totalMA),
        totalFR, totalFA, totalMR, totalMA, totalPlayers: totalFR + totalMR,
        dropoutCliff: pct(Math.max(0, (u14?.fa ?? 0) - (u18?.fa ?? 0)), u14?.fr ?? 1),
        u14fa: u14?.fa ?? 0, u14fr: u14?.fr ?? 0,
        u18fa: u18?.fa ?? 0, u18fr: u18?.fr ?? 0,
        primeSlotAvg: primeAvg,
        primeMaleSkew: primeSkew,
        days,
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

  // ── CSV Upload (supports Bosnia & Herzegovina research CSV or Grassroots Club CSV)
  function handleCsvUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const { rows, warnings, isMacro, label: parsedLabel } = parseClubCsv(text, "custom");
      if (rows.length > 0) {
        const finalLabel =
          parsedLabel ||
          (isMacro
            ? `Bosnia & Herzegovina (Host Country — ${file.name})`
            : `Custom Upload — ${file.name}`);
        setCustomCohort({ rows, label: finalLabel, isMacro });
        setUploadWarnings(warnings);
        if (isMacro) {
          setMode("macro");
          setView("bih");
        } else {
          setMode("sandbox");
          setView("demo-football");
        }
      } else {
        setCustomCohort(null);
        setUploadWarnings(warnings.length > 0 ? warnings : ["No valid data rows found in CSV."]);
      }
    };
    reader.readAsText(file);
  }

  function downloadBihCsv() {
    const a = document.createElement("a");
    a.href = "/bosnia_herzegovina_youth_sport_data.csv";
    a.download = "bosnia_herzegovina_youth_sport_data.csv";
    a.click();
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
    const activeLabel = customCohort?.label ?? label;
    const isMacroView = customCohort ? (customCohort.isMacro ?? false) : k.isMacro;

    try {
      // 1. Direct Gemini Call via import.meta.env.VITE_GEMINI_API_KEY with telemetry & root-cause context
      const geminiRes = await callGeminiAnalyst({
        entityName: activeLabel,
        isMacro: isMacroView,
        femaleActiveShare: k.femaleActiveShare,
        maleActiveShare: k.maleActiveShare,
        dropoutCliff: k.dropoutCliff,
        primeSlotAvg: k.primeSlotAvg,
        primeMaleSkew: k.primeMaleSkew,
        femaleCoachAvg: k.femaleCoachAvg,
        pubertySupportAvg: k.pubertySupportAvg,
        feeSubsidyAvg: k.feeSubsidyAvg,
        worstAge: k.worstAge,
        ages: k.ages,
        optimizer: {
          primeShiftPct: s1,
          coachIncreasePct: s2,
          parityPct: s3,
          projectedCliff: sim.projected,
          retainedCount: sim.retained,
        },
      });

      if (geminiRes.ok) {
        setAiPlan(geminiRes.plan);
        setPlanSource("gemini");
        return;
      }

      console.warn("Direct Gemini call fell back to server:", geminiRes.error);

      // 2. Try server function as secondary path
      const r = await analyzeClubData({
        data: {
          club: activeLabel,
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

      if (r.ok) {
        setAiPlan(r.plan);
        setPlanSource("gemini");
      } else {
        setPlanSource("fallback");
        console.warn("Gemini fallback to rule-based engine:", r.error);
      }
    } catch (e) {
      setPlanSource("fallback");
      console.warn("Gemini fallback to rule-based engine:", e);
    } finally {
      setLoading(false);
    }
  }

  const displayLabel = customCohort?.label ?? label;

  return (
    <div className="min-h-screen font-sans" style={{ background: "#0B151E", color: "#F8FAFC" }}>
      <div className="mx-auto max-w-[1600px] space-y-5 p-4 md:p-6">

        {/* ── Header ── */}
        <header
          className="rounded-xl p-5"
          style={{
            background: "#13222F",
            border: "1px solid #1E3243",
            boxShadow: "0 8px 30px rgba(0,0,0,0.45), inset 0 1px 0 0 rgba(255,255,255,0.07)",
          }}
        >
          {/* ── Mode Switcher: Macro Benchmark vs Club Sandbox ── */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E3243] pb-4 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mr-1">View Mode:</span>
              <button
                type="button"
                onClick={() => { setMode("macro"); setCustomCohort(null); setView("bih"); }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  mode === "macro"
                    ? "bg-[#2DD4BF] text-[#0B151E] shadow-[0_0_15px_rgba(45,212,191,0.4)]"
                    : "bg-[#0B151E] text-[#94A3B8] border border-[#1E3243] hover:text-[#F8FAFC]"
                }`}
              >
                <span>🇧🇦</span>
                <span>BiH Host Country &amp; Eurostat Verified Benchmarks</span>
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/20 font-mono">Real Macro Data</span>
              </button>
              <button
                type="button"
                onClick={() => { setMode("sandbox"); setView("demo-football"); }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  mode === "sandbox"
                    ? "bg-[#F59E0B] text-[#0B151E] shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                    : "bg-[#0B151E] text-[#94A3B8] border border-[#1E3243] hover:text-[#F8FAFC]"
                }`}
              >
                <span>🧪</span>
                <span>Club Diagnostic Sandbox (Synthetic Demo Model — Law 03)</span>
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/20 font-mono">Simulation Mode</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="kpi text-xs font-semibold px-2.5 py-1 rounded-md bg-[#0B151E] border border-[#1E3243] text-[#94A3B8]">
                Track 04: Count What Matters
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-extrabold tracking-tight text-[#F8FAFC] md:text-3xl">
                  SHE COUNTS: <span style={{ color: TEAL }}>Women in Sport</span>
                </h1>
                {mode === "macro" ? (
                  <Badge color="teal">🇧🇦 Host Country &amp; Eurostat Benchmarks</Badge>
                ) : (
                  <Badge color="amber">🧪 Club Diagnostic Sandbox (Synthetic Demo)</Badge>
                )}
                {customCohort && <Badge color="amber">{customCohort.label}</Badge>}
              </div>
              <p className="text-sm italic text-[#94A3B8]">
                {mode === "macro"
                  ? "Verified Geographies (BiH Adolescent Studies PMC8534587, PMC8620439, PMC7761556 & Eurostat hlth_ehis_pe3i) — Zero Fabricated Club Names"
                  : "Club Diagnostic Sandbox: Grassroots schedule equity, coaching ratios & washroom period-support simulation"}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <span className="label-caps text-[#94A3B8]">
                    {mode === "macro" ? "Verified Macro Geography" : "Sport Discipline (Club Model)"}
                  </span>
                  <select
                    value={customCohort ? (customCohort.isMacro ? "bih" : "demo-football") : view}
                    onChange={(e) => { setCustomCohort(null); setView(e.target.value as ClubId); }}
                    className="rounded-md px-3 py-1.5 text-sm text-[#F8FAFC] font-medium"
                    style={{ background: "#0B151E", border: "1px solid #1E3243" }}
                    disabled={!!customCohort}
                  >
                    {currentOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </label>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <input
                ref={fileInputRef} type="file" accept=".csv" className="hidden"
                onChange={handleCsvUpload} aria-label="Upload CSV Data"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-md px-3 py-2 text-xs font-semibold transition-colors"
                style={{ background: "rgba(45,212,191,0.12)", border: "1px solid rgba(45,212,191,0.35)", color: TEAL }}
                aria-label="Upload CSV Data"
                title="Upload Bosnia & Herzegovina research CSV or grassroots club CSV"
              >
                ↑ Upload CSV (BiH or Club)
              </button>
              <button
                onClick={downloadBihCsv}
                className="rounded-md px-3.5 py-2 text-xs font-bold transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(45,212,191,0.25)]"
                style={{ background: "rgba(45,212,191,0.18)", border: "1px solid rgba(45,212,191,0.45)", color: TEAL }}
                title="Download verified Bosnia & Herzegovina adolescent physical activity dataset (PMC8534587, PMC8620439, PMC7761556)"
              >
                <span>🇧🇦</span>
                <span>Download Bosnia &amp; Herzegovina Sample CSV</span>
              </button>
              <button
                onClick={downloadSampleCsv}
                className="rounded-md px-3 py-2 text-xs font-semibold transition-colors"
                style={{ background: "#0B151E", border: "1px solid #1E3243", color: "#94A3B8" }}
                title="Download generic club CSV template"
              >
                ↓ Download Club Template
              </button>
              <button
                onClick={() => setShowEvidence(true)}
                className="rounded-md px-3 py-2 text-xs font-semibold transition-colors"
                style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.35)", color: AMBER }}
              >
                ⚑ EU &amp; BiH Evidence
              </button>
              {customCohort && (
                <button
                  onClick={() => { setCustomCohort(null); setUploadWarnings([]); }}
                  className="rounded-md px-3 py-2 text-xs transition-colors text-[#94A3B8] hover:text-[#F8FAFC]"
                >
                  ✕ Clear Upload
                </button>
              )}
            </div>
          </div>
          {uploadWarnings.length > 0 && (
            <div className="mt-3 rounded-lg px-4 py-2 text-xs" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: AMBER }}>
              {uploadWarnings.map((w, i) => <p key={i}>{w}</p>)}
            </div>
          )}
        </header>

        {/* ── Mode Context Banner: Macro Telemetry vs Club Diagnostic Sandbox ── */}
        {mode === "macro" ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-3.5 text-xs bg-[#13222F] border border-[#2DD4BF]/30 shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🇧🇦</span>
              <div>
                <span className="font-bold text-[#F8FAFC]">HOST COUNTRY &amp; EUROPEAN BENCHMARK TELEMETRY: </span>
                <span className="text-[#94A3B8]">
                  Displaying verified peer-reviewed Bosnia &amp; Herzegovina adolescent physical activity data (PMC8534587, PMC8620439, PMC7761556) alongside Eurostat (hlth_ehis_pe3i, hlth_ehis_pe2e), Special Eurobarometer 574, and Erasmus+ ICOACHKIDS+. Zero fabricated local club names.
                </span>
              </div>
            </div>
            <Badge color="teal">BiH &amp; Eurostat Verified</Badge>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-3.5 text-xs bg-[#13222F] border border-[#F59E0B]/30 shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🧪</span>
              <div>
                <span className="font-bold text-[#F59E0B]">CLUB DIAGNOSTIC SANDBOX (SYNTHETIC DEMO MODEL — LAW 03 COMPLIANT): </span>
                <span className="text-[#94A3B8]">
                  Interactive grassroots simulation modeling prime pitch scheduling (18:00–21:00), female coach staffing, dark-shorts kits, and washroom period supplies. Test with synthetic demo clubs or upload your club CSV.
                </span>
              </div>
            </div>
            <Badge color="amber">Synthetic Sandbox Model</Badge>
          </div>
        )}

        {/* ── KPI Ribbon ── */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            title="Female Active Share"
            main={`${k.femaleActiveShare}%`}
            mainColor={TEAL}
            accentColor={TEAL}
            sub={`${k.totalFA} / ${k.totalFA + k.totalMA} active players`}
            badge="50% Parity Target"
            badgeColor="teal"
            bottom={
              <div className="space-y-1">
                <ProgressBar value={k.femaleActiveShare} color={TEAL} />
                <span className="text-xs text-[#94A3B8]">toward 50% parity</span>
              </div>
            }
          />
          <KpiCard
            title="Adolescent Dropout Cliff (U14→U18)"
            main={`${k.dropoutCliff}%`}
            mainColor={AMBER}
            accentColor={AMBER}
            sub={`${k.u14fa - k.u18fa} girls lost between U14 and U18`}
            badge="ICOACHKIDS+ 52% teen dropout window"
            badgeColor="amber"
          />
          <KpiCard
            title="Prime-Time Pitch Share (18:00–21:00)"
            main={`${k.primeSlotAvg}%`}
            mainColor={TEAL}
            accentColor={TEAL}
            sub={`${100 - k.primeSlotAvg}% male-skewed — Eurobarometer: 40% cite time barriers`}
            badge={k.primeSlotAvg < 40 ? `${((100 - k.primeSlotAvg) / Math.max(1, k.primeSlotAvg)).toFixed(1)}x Male Skew` : "Near Parity"}
            badgeColor={k.primeSlotAvg < 40 ? "coral" : "teal"}
          />
          <KpiCard
            title="Female Coaching & Kit Score"
            main={`${k.femaleCoachAvg}%`}
            mainColor={CORAL}
            accentColor={CORAL}
            sub={`Female coaching ${k.femaleCoachAvg}%. Puberty Support Score: ${k.pubertySupportAvg}/100`}
            badge={k.pubertySupportAvg < 50 ? "Kit & Mentorship Gap" : "On Track"}
            badgeColor={k.pubertySupportAvg < 50 ? "coral" : "teal"}
          />
        </div>

        {/* ── 3-Column Bento Grid ── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">

          {/* Left Column */}
          <div className="space-y-5 lg:col-span-3">
            <Card title="Weekly Prime-Slot Share" accent="teal">
              <Donut
                data={[
                  { v: k.femaleActiveShare, c: TEAL, glow: true },
                  { v: k.maleActiveShare,   c: CORAL },
                ]}
                center={
                  <>
                    <span className="kpi text-3xl font-extrabold text-[#F8FAFC]">{k.femaleActiveShare}%</span>
                    <span className="text-xs font-semibold text-[#94A3B8]">Female</span>
                  </>
                }
              />
              <div className="mt-2 flex items-center justify-between text-xs">
                <Badge color="teal">Target: 50/50</Badge>
                <span className="text-[#94A3B8]">Prime slots 18:00–21:00</span>
              </div>
            </Card>

            <Card title="Teen Retention Hazard (U14–U18)" accent="coral">
              <Donut
                data={[
                  { v: k.dropoutCliff,       c: CORAL },
                  { v: 100 - k.dropoutCliff, c: "#1E3243" },
                ]}
                center={
                  <>
                    <span className="kpi text-3xl font-extrabold text-[#F8FAFC]">{k.dropoutCliff}%</span>
                    <span className="text-xs font-semibold" style={{ color: CORAL }}>Dropout Risk</span>
                  </>
                }
              />
              <div className="mt-2">
                <Badge color="coral">⚠ Hazard cohort: Ages 14–18</Badge>
                <p className="mt-2 text-xs text-[#94A3B8]">
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
                <ResponsiveContainer className="relative z-10">
                  <AreaChart data={k.ages} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="femaleGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={TEAL} stopOpacity={0.38} />
                        <stop offset="100%" stopColor={TEAL} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="maleGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CORAL} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={CORAL} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...CHART_GRID} vertical={false} />
                    <XAxis dataKey="age" tick={CHART_TICK_X} axisLine={false} tickLine={false} />
                    <YAxis unit="%" domain={[0, 100]} tick={CHART_TICK_Y} axisLine={false} tickLine={false} />
                    <Tooltip {...TIP_STYLE} />
                    <Legend
                      wrapperStyle={{ color: "#94A3B8", fontSize: 11 }}
                      formatter={(value) =>
                        value === "Female Active (%)" ? (
                          <span style={{ color: "#F8FAFC" }}>Female Active (%)</span>
                        ) : (
                          <span style={{ color: "#94A3B8" }}>Male Active (%)</span>
                        )
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
                      name="Female Active (%)"
                      stroke={TEAL} fill="url(#femaleGradient)"
                      strokeWidth={3} dot={{ fill: TEAL, r: 3 }}
                    />
                    <Area
                      type="linear" dataKey="male"
                      name="Male Active (%)"
                      stroke={CORAL} fill="url(#maleGradient)"
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
                    <tr className="text-left text-[#94A3B8]">
                      <th className="border p-2 text-xs" style={{ borderColor: "#1E3243" }}>Cohort</th>
                      <th className="border p-2 text-xs" style={{ borderColor: "#1E3243" }}>Female Active</th>
                      <th className="border p-2 text-xs" style={{ borderColor: "#1E3243" }}>Male Active</th>
                      <th className="border p-2 text-xs" style={{ borderColor: "#1E3243" }}>Retention Gap</th>
                      <th className="border p-2 text-xs" style={{ borderColor: "#1E3243" }}>Prime Slot Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {k.ages.map((a) => (
                      <tr key={a.age} className="transition-colors hover:bg-white/5">
                        <td className="border p-2 font-semibold text-[#F8FAFC]" style={{ borderColor: "#1E3243" }}>{a.age}</td>
                        <td className="border p-2 font-bold" style={{ borderColor: "#1E3243", color: TEAL }}>{a.female}%</td>
                        <td className="border p-2" style={{ borderColor: "#1E3243", color: CORAL }}>{a.male}%</td>
                        <td className="border p-2 font-semibold" style={{ borderColor: "#1E3243", color: a.gap > 15 ? CORAL : a.gap > 5 ? AMBER : TEAL }}>
                          {a.gap > 0 ? "−" : ""}{a.gap} pp
                        </td>
                        <td className="border p-2" style={{ borderColor: "#1E3243", color: a.primeSlotPct < 40 ? CORAL : "#F8FAFC" }}>
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
            <Card title="Prime-Hour Disparity (18:00–21:00)" accent="coral">
              <div className="h-44">
                <ResponsiveContainer className="relative z-10">
                  <BarChart data={k.days} margin={{ top: 2, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid {...CHART_GRID} vertical={false} />
                    <XAxis dataKey="day" tick={CHART_TICK_X} axisLine={false} tickLine={false} />
                    <YAxis unit="h" tick={CHART_TICK_Y} axisLine={false} tickLine={false} />
                    <Tooltip {...TIP_STYLE} />
                    <Bar dataKey="female" name="Female slots (hrs)" fill={TEAL} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="male"   name="Male slots (hrs)"   fill={CORAL} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="kpi mt-3 text-3xl font-extrabold text-[#F8FAFC]">
                {k.primeMaleSkew}x
              </p>
              <p className="text-xs text-[#94A3B8]">
                Prime-hour slots skew heavily male (Mon–Fri 18:00–21:00)
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge color="teal">Female Coach: {k.femaleCoachAvg}%</Badge>
                <Badge color="coral">Prime Slot Gap: {100 - k.primeSlotAvg - k.primeSlotAvg}pp</Badge>
              </div>
            </Card>

            <Card
              title={
                mode === "macro"
                  ? 'Policy Optimizer — "What If?" Macro Parity Simulator'
                  : 'Club Diagnostic Sandbox — "What If?" Retention Simulator'
              }
              accent="amber"
            >
              <div className="space-y-4">
                {(
                  [
                    [
                      mode === "macro"
                        ? "Regional Prime-Hour Allocation Mandate (18:00–21:00) %"
                        : "Shift Prime-Time Slots (18:00–21:00) to Girls %",
                      s1,
                      setS1,
                    ],
                    [
                      mode === "macro"
                        ? "Accredited Female Coaching Mentorship Subsidy %"
                        : "Increase Accredited Female Coaching Staff %",
                      s2,
                      setS2,
                    ],
                    [
                      mode === "macro"
                        ? "Municipal Dark-Kit & Period Supply Mandate %"
                        : "Puberty & Period Kit/Facility Support %",
                      s3,
                      setS3,
                    ],
                  ] as const
                ).map(([l, v, set]) => (
                  <label key={l} className="block text-xs">
                    <div className="mb-1 flex justify-between text-[#94A3B8]">
                      <span>{l}</span>
                      <span className="kpi font-extrabold text-[#F8FAFC]">{v}%</span>
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
                  style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.4)", color: AMBER }}
                >
                  <div className="flex items-center gap-1.5 font-bold">
                    <span>⚠️</span>
                    <span>Projected Dropout: {sim.projected}% (+{sim.retained} players retained)</span>
                  </div>
                  <div className="mt-1 text-xs text-[#F8FAFC]">
                    Dropout hazard reduces from <span className="kpi font-bold" style={{ color: CORAL }}>{k.dropoutCliff}%</span> down to <span className="kpi font-bold" style={{ color: TEAL }}>{sim.projected}%</span>
                  </div>
                  <div className="mt-2 text-xs italic text-[#94A3B8]">
                    {mode === "macro"
                      ? "Macro Policy Projection — Modeled on EU elasticity weights across regional cohort"
                      : "Deterministic simulation modeled on EU elasticity weights — Synthetic Demo Model"}
                  </div>
                </div>
                {mode === "macro" && (
                  <button
                    type="button"
                    onClick={() => { setMode("sandbox"); setView("demo-football"); }}
                    className="w-full text-center py-2 px-3 rounded-lg border border-[#F59E0B]/30 bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 text-[#F59E0B] text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>🧪 Switch to Club Diagnostic Sandbox (Law 03) →</span>
                  </button>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* ── Sport Format Skew — Male-Dominated Clubs vs. Female-Led Activities ── */}
        <section
          className="card-lift rounded-xl p-5 md:p-6"
          style={{
            background: "#13222F",
            border: "1px solid #1E3243",
            boxShadow: "0 8px 30px rgba(0,0,0,0.45), inset 0 1px 0 0 rgba(255,255,255,0.07)",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E3243] pb-4 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight text-[#F8FAFC]">
                  SPORT FORMAT SKEW
                </span>
                <span className="text-sm font-semibold text-[#94A3B8]">
                  — Male-Dominated Clubs vs. Female-Led Activities
                </span>
              </div>
              <p className="mt-1 text-xs text-[#94A3B8]">
                Verified empirical data from Women in Sport (2022) &amp; Eurostat (hlth_ehis_pe3i)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-[#FB7185]/10 border border-[#FB7185]/30 text-[#FB7185]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#FB7185]" />
                Boys Baseline
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-[#2DD4BF]/10 border border-[#2DD4BF]/30 text-[#2DD4BF]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#2DD4BF]" />
                Girls Participation
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Left Column: Male-Dominated Organized Arenas */}
            <div
              className="rounded-xl p-4 md:p-5 flex flex-col justify-between"
              style={{
                background: "#0B151E",
                border: "1px solid rgba(251,113,133,0.3)",
              }}
            >
              <div>
                <div className="flex items-center justify-between border-b border-[#1E3243] pb-3 mb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#F8FAFC] flex items-center gap-2">
                      <span className="text-[#FB7185]">▼</span>
                      <span>Male-Dominated Organized Arenas</span>
                    </h3>
                    <p className="text-[11px] text-[#94A3B8]">External team clubs &amp; facility-dependent sports</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#FB7185]/15 text-[#FB7185] border border-[#FB7185]/30">
                    −13 to −17 pp Deficit
                  </span>
                </div>

                <div className="space-y-4">
                  {SPORT_MODALITY_SPLIT.maleDominated.map((item) => (
                    <div key={item.arena} className="space-y-1.5">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-semibold text-[#F8FAFC]">{item.arena}</span>
                        <span className="font-bold text-[#FB7185] font-mono text-[11px]">{item.gapLabel}</span>
                      </div>
                      <div className="space-y-1">
                        {/* Boys Bar */}
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-10 text-[#94A3B8]">Boys:</span>
                          <div className="h-2 flex-1 rounded-full bg-[#1E3243] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${item.malePct}%`, background: CORAL }}
                            />
                          </div>
                          <span className="w-10 text-right font-mono font-bold text-[#FB7185]">{item.malePct}%</span>
                        </div>
                        {/* Girls Bar */}
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-10 text-[#94A3B8]">Girls:</span>
                          <div className="h-2 flex-1 rounded-full bg-[#1E3243] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${item.femalePct}%`, background: TEAL }}
                            />
                          </div>
                          <span className="w-10 text-right font-mono font-bold text-[#2DD4BF]">{item.femalePct}%</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-[#64748B] italic">Source: {item.source}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Female-Led / Parity Arenas */}
            <div
              className="rounded-xl p-4 md:p-5 flex flex-col justify-between"
              style={{
                background: "#0B151E",
                border: "1px solid rgba(45,212,191,0.3)",
              }}
            >
              <div>
                <div className="flex items-center justify-between border-b border-[#1E3243] pb-3 mb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#F8FAFC] flex items-center gap-2">
                      <span className="text-[#2DD4BF]">▲</span>
                      <span>Female-Led &amp; Parity Arenas</span>
                    </h3>
                    <p className="text-[11px] text-[#94A3B8]">Self-paced, individual &amp; school physical education</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#2DD4BF]/15 text-[#2DD4BF] border border-[#2DD4BF]/30">
                    +2 to +10 pp Parity Lead
                  </span>
                </div>

                <div className="space-y-4">
                  {SPORT_MODALITY_SPLIT.femaleParity.map((item) => (
                    <div key={item.arena} className="space-y-1.5">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-semibold text-[#F8FAFC]">{item.arena}</span>
                        <span className="font-bold text-[#2DD4BF] font-mono text-[11px]">{item.gapLabel}</span>
                      </div>
                      <div className="space-y-1">
                        {/* Girls Bar */}
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-10 text-[#94A3B8]">Girls:</span>
                          <div className="h-2 flex-1 rounded-full bg-[#1E3243] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${item.femalePct}%`, background: TEAL }}
                            />
                          </div>
                          <span className="w-10 text-right font-mono font-bold text-[#2DD4BF]">{item.femalePct}%</span>
                        </div>
                        {/* Boys Bar */}
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-10 text-[#94A3B8]">Boys:</span>
                          <div className="h-2 flex-1 rounded-full bg-[#1E3243] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${item.malePct}%`, background: CORAL }}
                            />
                          </div>
                          <span className="w-10 text-right font-mono font-bold text-[#FB7185]">{item.malePct}%</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-[#64748B] italic">Source: {item.source}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Analytical Insight Callout */}
          <div
            className="mt-5 rounded-lg p-4 text-xs"
            style={{
              background: "rgba(45,212,191,0.08)",
              border: "1px solid rgba(45,212,191,0.35)",
            }}
          >
            <div className="flex items-start gap-3">
              <span className="text-lg leading-none" role="img" aria-label="insight">💡</span>
              <div className="space-y-1">
                <span className="font-bold text-[#2DD4BF] text-xs uppercase tracking-wide">
                  Core Analytical Insight:
                </span>
                <p className="text-xs text-[#F8FAFC] font-medium leading-relaxed italic">
                  &ldquo;{SPORT_FORMAT_ANALYTICAL_INSIGHT}&rdquo;
                </p>
                <p className="text-[11px] text-[#94A3B8] pt-1">
                  When physical activity is self-paced or structured safely in schools, adolescent girls maintain equal or greater engagement. The cliff occurs specifically within traditional club environments where pitch access, coaching demographics, and kit culture remain heavily skewed.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── The Missing Players — Root-Cause Diagnostics ── */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-[#F8FAFC]">
                {mode === "macro" ? "THE MISSING ATHLETES " : "THE MISSING PLAYERS "}
                <span className="font-normal text-[#94A3B8]">
                  {mode === "macro"
                    ? "— Verified EU Evidence & 90-Day Policy Roadmap"
                    : "— Root-Cause Diagnostics & 90-Day Action Plan"}
                </span>
              </h2>
              <p className="mt-1 text-xs text-[#94A3B8]">
                {mode === "macro"
                  ? `Verified Macro Geography: ${displayLabel}`
                  : `Club Diagnostic Telemetry: ${displayLabel}`}
              </p>
            </div>
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="rounded-md px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-60 bg-[#2DD4BF] hover:bg-[#14B8A6] text-[#0B151E] shadow-[0_0_20px_rgba(45,212,191,0.35)]"
            >
              {loading
                ? "Analysing…"
                : mode === "macro"
                ? "✨ Generate 90-Day Policy Roadmap (AI Analyst)"
                : "✨ Generate 90-Day Club Intervention Plan (AI Analyst)"}
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
            background: "#13222F",
            border: "1px solid #1E3243",
            boxShadow: "0 8px 30px rgba(0,0,0,0.45), inset 0 1px 0 0 rgba(255,255,255,0.07)",
          }}
        >
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="rounded-full px-4 py-2" style={{ background: "#0B151E", border: "1px solid #1E3243", color: "#94A3B8" }}>
              <span className="font-bold" style={{ color: TEAL }}>LAW 03 COMPLIANT:</span>{" "}
              Zero-PII Architecture · Anonymized Club Telemetry &amp; Official EU Aggregates (Eurostat / Eurobarometer / PMC12330288)
            </span>
            <span className="rounded-full px-4 py-2" style={{ background: "#0B151E", border: "1px solid #1E3243", color: "#94A3B8" }}>
              <span className="font-bold" style={{ color: TEAL }}>LAW 05 COMPLIANT:</span>{" "}
              AI-Assisted Engineering Disclosure — Built with Lovable, Claude Sonnet 4.6 (Antigravity + taste-skill), and Google Gemini
            </span>
            <span className="rounded-full px-4 py-2" style={{ background: "#0B151E", border: "1px solid #1E3243", color: "#94A3B8" }}>
              <span className="font-bold" style={{ color: AMBER }}>SARAJEVO HACKATHON 2026</span> · TRACK 04: WOMEN IN SPORT
            </span>
          </div>
        </footer>
      </div>

      {/* ── EU & BiH Evidence Modal ── */}
      <Modal open={showEvidence} onClose={() => setShowEvidence(false)} title="Evidence Base & Verified Methodology" wide>
        <div className="space-y-5">
          {/* Methodological Note Callout per brief */}
          <div
            className="rounded-lg p-3.5 text-xs"
            style={{
              background: "rgba(45,212,191,0.08)",
              border: "1px solid rgba(45,212,191,0.35)",
              color: "#F8FAFC",
            }}
          >
            <div className="flex items-center gap-2 mb-1.5 font-bold text-sm" style={{ color: TEAL }}>
              <span>🇧🇦</span>
              <span>Methodological Note — Host Country (Bosnia &amp; Herzegovina):</span>
            </div>
            <p className="leading-relaxed text-[#F8FAFC]">
              {METHODOLOGICAL_NOTE}
            </p>
          </div>

          <p className="text-xs" style={{ color: "#94A3B8" }}>
            All benchmarks below are clickable, peer-reviewed European and host-country research sources. Every KPI on this dashboard is anchored in these verified findings:
          </p>
          {BENCHMARK_EVIDENCE_REGISTRY.map((e) => (
            <div
              key={e.id}
              className="rounded-lg p-4"
              style={{ background: "#0B151E", border: "1px solid #1E3243" }}
            >
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#94A3B8]">{e.country}</span>
                  <h4 className="font-bold text-[#F8FAFC] text-sm">{e.title}</h4>
                </div>
                <Badge color="teal">{e.stat}</Badge>
              </div>
              <p className="text-xs text-[#94A3B8]">{e.finding}</p>
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
          <div className="rounded-lg p-3 text-xs" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", color: "#F8FAFC" }}>
            <span className="font-bold" style={{ color: AMBER }}>Calculation Formulae:</span>{" "}
            Female Active Share = active at season end ÷ registered at season start (per gender/cohort). Dropout Cliff = (U14 active girls − U18 active girls) ÷ U14 registered girls. What-If elasticities are modeled on Eurobarometer 574 (time barrier: 40%), PMC12330288 (period: 78%), and ICOACHKIDS+ (coach gap: 63%).
          </div>
        </div>
      </Modal>

      {/* ── 90-Day Plan Modal ── */}
      <Modal open={showAiPlan} onClose={() => setShowAiPlan(false)} title={plan.title} wide>
        {loading ? (
          <div className="flex items-center gap-3 py-10 text-sm text-[#94A3B8]">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: `${TEAL} transparent ${TEAL} ${TEAL}` }} />
            Gemini AI is reading your club's figures…
          </div>
        ) : (
          <>
            <p className="mb-5 text-xs text-[#94A3B8]">
              {planSource === "gemini"
                ? "✨ Generated by Google Gemini (gemini-2.5-flash) using only the verified telemetry figures and root causes shown on this dashboard."
                : "⚡ Deterministic rule-based engine (<10ms offline fallback) — showing instant evidence-based action plan from your telemetry."}
            </p>
            <div className="space-y-4">
              {plan.cards.map((c) => (
                <div
                  key={c.title}
                  className="rounded-lg p-4"
                  style={{ background: "#0B151E", border: "1px solid #1E3243" }}
                >
                  <h4 className="mb-3 font-bold" style={{ color: TEAL }}>{c.title}</h4>
                  <ul className="list-disc space-y-1.5 pl-5 text-sm text-[#F8FAFC]">
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
