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

// ── Obsidian-Indigo, Electric Orchid-Violet & Championship Gold Telemetry Tokens ──
const VIOLET = "#C084FC";       // Electric Orchid-Violet (Female Active & Parity)
const VIOLET_HOVER = "#A855F7"; // Hover Orchid-Violet
const GOLD   = "#FBBF24";       // Championship Gold (Male Baseline & Dropout Cliff)
const EMERALD = "#34D399";      // Mint Emerald (Growth Deltas & Positive Status)
const CORAL  = "#FB7185";       // Soft Coral-Rose (Disparity & Hazard)
const SKY    = "#38BDF8";       // Electric Sky Blue (Prime-Hour Interventions)
const AMBER  = "#F59E0B";       // Warning Amber

// X-axis cohort labels: bold white (#F8FAFC); Y-axis percentages: muted (#64748B)
const CHART_TICK_X = { fill: "#F8FAFC", fontSize: 12, fontWeight: 600 } as const;
const CHART_TICK_Y = { fill: "#64748B", fontSize: 11 } as const;
// Table & chart grid lines use #262D4D
const CHART_GRID  = { stroke: "#262D4D", strokeDasharray: "3 3" } as const;
const TIP_STYLE   = {
  contentStyle: {
    background: "rgba(8,10,18,0.97)",
    border: "1px solid #262D4D",
    borderRadius: 8,
    color: "#F8FAFC",
    boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
    backdropFilter: "blur(12px)",
    fontSize: 12,
  },
  labelStyle: { color: "#F8FAFC", fontWeight: 600 },
  itemStyle: { color: "#CBD5E1" },
};

// ── Neon Runner Watermark — strips white background via offscreen HTML5 canvas on mount & tints to electric orchid-violet (#C084FC)
function RunnerWatermark() {
  const [dataUrl, setDataUrl] = useState<string>("/neon-runner.png");

  useEffect(() => {
    if (typeof window === "undefined") return;

    let active = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = "/neon-runner.png";

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

        // 1. Convert near-white pixels (r > 200 && g > 200 && b > 200) to transparent
        // 2. Tint foreground pixels to Electric Orchid-Violet (#C084FC: 192, 132, 252)
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i]!;
          const g = d[i + 1]!;
          const b = d[i + 2]!;
          const a = d[i + 3]!;
          if (a === 0) continue;

          if (r > 200 && g > 200 && b > 200) {
            if (r > 220 && g > 220 && b > 220) {
              d[i + 3] = 0;
            } else {
              const minChannel = Math.min(r, g, b);
              const fade = Math.max(0, Math.min(1, (220 - minChannel) / 20));
              d[i + 3] = Math.round(a * fade);
            }
          } else {
            // Foreground neon runner pixel: tint to electric orchid-violet (#C084FC)
            const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            d[i]     = Math.min(255, Math.round(192 * lum * 1.35));
            d[i + 1] = Math.min(255, Math.round(132 * lum * 1.35));
            d[i + 2] = Math.min(255, Math.round(252 * lum * 1.35));
          }
        }

        ctx.putImageData(imgData, 0, 0);
        const processedUrl = canvas.toDataURL("image/png");
        if (active) setDataUrl(processedUrl);
      } catch (err) {
        console.warn("Offscreen canvas runner background strip error:", err);
      }
    };

    img.onerror = () => {
      if (active) setDataUrl("/Neon%20Hologram%20Runner.png");
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
        className="pointer-events-none select-none max-h-[210px] w-auto object-contain opacity-30 drop-shadow-[0_0_16px_rgba(192,132,252,0.45)]"
      />
    </div>
  );
}

// ── Shared bento card — #111526 surface, #262D4D border ──
function Card({
  title, children, className = "", accent,
}: {
  title: string; children: ReactNode; className?: string; accent?: "violet" | "gold" | "emerald" | "coral" | "amber" | "teal" | undefined;
}) {
  const borderColor =
    accent === "violet" ? "rgba(192,132,252,0.45)" :
    accent === "gold"   ? "rgba(251,191,36,0.55)"  :
    accent === "emerald"? "rgba(52,211,153,0.45)"  :
    accent === "coral"  ? "rgba(251,113,133,0.45)" :
    accent === "amber"  ? "rgba(245,158,11,0.45)"  : "#262D4D";

  return (
    <section
      className={`card-lift rounded-xl p-5 ${className}`}
      style={{
        background: "#111526",
        border: `1px solid ${borderColor}`,
        boxShadow: "0 8px 30px rgba(0,0,0,0.5), inset 0 1px 0 0 rgba(255,255,255,0.06)",
      }}
    >
      <h2 className="label-caps mb-3">{title}</h2>
      {children}
    </section>
  );
}

// ── Donut chart ──
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
                style={d.glow ? { filter: "drop-shadow(0 0 10px rgba(192,132,252,0.45))" } : undefined}
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

// ── Modal / Drawer ──
function Modal({ open, onClose, title, wide, children }: {
  open: boolean; onClose: () => void; title: string; wide?: boolean; children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8"
      style={{
        background: "rgba(8,10,18,0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
      onClick={onClose}
    >
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl p-6 md:p-8 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
          wide ? "max-w-4xl lg:max-w-5xl xl:max-w-6xl" : "max-w-2xl"
        }`}
        style={{
          background: "#111526",
          border: "1px solid #262D4D",
          boxShadow: "0 24px 90px rgba(0,0,0,0.95), inset 0 1px 0 0 rgba(255,255,255,0.06)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h3 className="text-xl md:text-2xl font-bold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-base transition-colors text-[#64748B] hover:bg-white/5 hover:text-[#F8FAFC]"
            aria-label="Close"
          >✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Badge ──
function Badge({
  color = "violet",
  children,
  customStyle,
}: {
  color?: "violet" | "gold" | "emerald" | "coral" | "sky" | "amber" | "teal" | undefined;
  children: ReactNode;
  customStyle?: { background: string; color: string; border: string } | undefined;
}) {
  const styles = customStyle ?? {
    violet:  { background: "rgba(192,132,252,0.15)", color: VIOLET,  border: "1px solid rgba(192,132,252,0.35)" },
    gold:    { background: "rgba(251,191,36,0.15)",  color: GOLD,    border: "1px solid rgba(251,191,36,0.35)" },
    emerald: { background: "rgba(52,211,153,0.15)",  color: EMERALD, border: "1px solid rgba(52,211,153,0.35)" },
    coral:   { background: "rgba(251,113,133,0.15)", color: CORAL,   border: "1px solid rgba(251,113,133,0.35)" },
    sky:     { background: "rgba(56,189,248,0.15)",  color: SKY,     border: "1px solid rgba(56,189,248,0.35)" },
    amber:   { background: "rgba(245,158,11,0.15)",  color: AMBER,   border: "1px solid rgba(245,158,11,0.35)" },
    teal:    { background: "rgba(192,132,252,0.15)", color: VIOLET,  border: "1px solid rgba(192,132,252,0.35)" },
  }[color];
  return (
    <span className="kpi inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold" style={styles}>
      {children}
    </span>
  );
}

// ── KPI ribbon card ──
function KpiCard({
  title, main, mainColor = "#F8FAFC", sub, badge, badgeColor = "violet", customBadgeStyle, accentColor, bottom,
}: {
  title: string; main: string; mainColor?: string | undefined; sub: string;
  badge?: string | undefined; badgeColor?: "violet" | "gold" | "emerald" | "coral" | "sky" | "amber" | "teal" | undefined;
  customBadgeStyle?: { background: string; color: string; border: string } | undefined;
  accentColor?: string | undefined; bottom?: ReactNode | undefined;
}) {
  return (
    <div
      className="card-lift flex flex-col gap-3 rounded-xl p-5"
      style={{
        background: "#111526",
        border: "1px solid",
        borderColor: accentColor ? `${accentColor}80` : "#262D4D",
        boxShadow: accentColor
          ? `0 8px 30px rgba(0,0,0,0.5), 0 0 16px ${accentColor}25, inset 0 1px 0 0 rgba(255,255,255,0.06)`
          : "0 8px 30px rgba(0,0,0,0.5), inset 0 1px 0 0 rgba(255,255,255,0.06)",
      }}
    >
      <span className="label-caps text-[#64748B]">{title}</span>
      <span className="kpi text-3xl font-extrabold tracking-tight" style={{ color: mainColor }}>
        {main}
      </span>
      <span className="text-xs text-[#CBD5E1]">{sub}</span>
      {badge && <Badge color={badgeColor} customStyle={customBadgeStyle}>{badge}</Badge>}
      {bottom}
    </div>
  );
}

// ── Root-cause diagnostic card ──
function RootCauseCard({
  icon, title, stat, source, fix, evidence, color,
}: {
  icon: string; title: string; stat: string; source: string; fix: string;
  evidence: string; color: "coral" | "gold" | "violet" | "amber" | "teal";
}) {
  const c = color === "violet" ? VIOLET : color === "gold" ? GOLD : color === "coral" ? CORAL : color === "amber" ? AMBER : VIOLET;
  return (
    <div
      className="card-lift flex flex-col gap-4 rounded-xl p-5"
      style={{
        background: "#111526",
        border: `1px solid ${c}66`,
        boxShadow: "0 8px 30px rgba(0,0,0,0.5), inset 0 1px 0 0 rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-2xl">{icon}</span>
        <div>
          <h3 className="font-bold text-[#F8FAFC]">{title}</h3>
          <span className="kpi text-sm font-extrabold" style={{ color: c }}>{stat}</span>
        </div>
      </div>
      <p className="text-xs text-[#CBD5E1]">{source}</p>
      <div
        className="rounded-lg p-3 text-xs"
        style={{ background: "#080A12", border: `1px solid ${c}40`, color: "#F8FAFC" }}
      >
        <span className="font-bold" style={{ color: c }}>Concrete Fix: </span>
        {fix}
      </div>
      <span className="text-xs italic text-[#64748B]">{evidence}</span>
    </div>
  );
}

// ── Progress bar ──
function ProgressBar({ value, max = 100, color = VIOLET }: { value: number; max?: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#171C33] border border-[#262D4D]">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }}
      />
    </div>
  );
}

// ── Controlled telemetry range slider with zero lag and decorative active track ──
function ControlledTelemetrySlider({
  label,
  value,
  onChange,
  accentColor = VIOLET,
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
  accentColor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-[#CBD5E1]">{label}</span>
        <span className="kpi font-extrabold text-[#F8FAFC] tabular-nums">{value}%</span>
      </div>
      <div className="relative flex items-center h-6 w-full">
        {/* Decorative background track (pointer-events-none) */}
        <div className="pointer-events-none absolute inset-x-0 h-2 rounded-full bg-[#171C33] border border-[#262D4D]" />

        {/* Decorative active progress fill (pointer-events-none) */}
        <div
          className="pointer-events-none absolute left-0 h-2 rounded-full transition-none shadow-[0_0_8px_rgba(192,132,252,0.35)]"
          style={{
            width: `${value}%`,
            background: `linear-gradient(90deg, ${accentColor}cc 0%, ${accentColor} 100%)`,
          }}
        />

        {/* Decorative thumb circle (pointer-events-none) */}
        <div
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 rounded-full border-2 border-[#080A12] shadow-[0_0_10px_rgba(192,132,252,0.7)]"
          style={{
            left: `${value}%`,
            backgroundColor: accentColor,
          }}
        />

        {/* Real native range input on top (relative z-20 w-full h-6 opacity-0 cursor-pointer) */}
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="relative z-20 h-6 w-full cursor-pointer opacity-0"
          aria-label={label}
        />
      </div>
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
  const [isAfterMode, setIsAfterMode] = useState(false);
  const [s1, setS1] = useState(0), [s2, setS2] = useState(0), [s3, setS3] = useState(0);

  function applyAfterTarget() {
    setIsAfterMode(true);
    setS1(50);
    setS2(45);
    setS3(100);
  }

  function resetToBaseline() {
    setIsAfterMode(false);
    setS1(0);
    setS2(0);
    setS3(0);
  }
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
  const postPrimeSlot = Math.min(50, Math.round(k.primeSlotAvg + (50 - Math.min(50, k.primeSlotAvg)) * (s1 / 50)));
  const primeGain = Math.max(0, postPrimeSlot - k.primeSlotAvg);
  const postCoach = Math.min(100, Math.round(k.femaleCoachAvg + (45 - Math.min(45, k.femaleCoachAvg)) * (s2 / 45)));
  const postKit = Math.min(100, Math.round(k.pubertySupportAvg + (100 - Math.min(100, k.pubertySupportAvg)) * (s3 / 100)));
  const postComposite = Math.min(100, Math.round(postCoach * 0.4 + postKit * 0.6));
  const baseComposite = Math.round(k.femaleCoachAvg * 0.4 + k.pubertySupportAvg * 0.6);

  const chartData = useMemo(() => {
    return k.ages.map((a, idx) => {
      const proj = sim.projectedAges?.[idx]?.projectedFemale ?? a.female;
      return {
        ...a,
        projectedFemale: proj,
      };
    });
  }, [k.ages, sim.projectedAges]);
  const fallbackPlan = interventionPlan(k, customCohort?.label ?? label);
  const plan = aiPlan ?? fallbackPlan;

  // ── CSV Upload (supports Bosnia & Herzegovina research CSV or Grassroots Club CSV) ──
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

  // ── AI Analysis ──
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
    <div className="min-h-screen font-sans" style={{ background: "#080A12", color: "#F8FAFC" }}>
      <div className="mx-auto max-w-[1600px] space-y-5 p-4 md:p-6">

        {/* ── Top Control Strip & Single-Row Header Bar ── */}
        <header
          className="rounded-xl p-5"
          style={{
            background: "#111526",
            border: "1px solid #262D4D",
            boxShadow: "0 8px 30px rgba(0,0,0,0.5), inset 0 1px 0 0 rgba(255,255,255,0.06)",
          }}
        >
          {/* ── Top Control Strip (Full-Width Bar above Header) ── */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#262D4D] pb-3.5 mb-4">
            {/* Left: View Mode Toggle */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748B] mr-1">VIEW MODE:</span>
              <div className="flex items-center rounded-full bg-[#171C33] border border-[#262D4D] p-1">
                <button
                  type="button"
                  onClick={() => { setMode("macro"); setCustomCohort(null); setView("bih"); }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    mode === "macro"
                      ? "bg-[#F8FAFC] text-[#080A12] shadow-sm font-bold"
                      : "text-[#CBD5E1] hover:text-[#F8FAFC]"
                  }`}
                >
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${mode === "macro" ? "bg-[#080A12]" : "bg-[#C084FC]"}`} />
                  <span className="font-bold text-[10px] font-mono opacity-80">BA</span>
                  <span>BiH &amp; Eurostat Benchmarks</span>
                  <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded font-mono font-bold ${
                    mode === "macro" ? "bg-black/10 text-[#080A12]" : "bg-white/5 text-[#C084FC]"
                  }`}>Macro Data</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("sandbox"); setView("demo-football"); }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    mode === "sandbox"
                      ? "bg-[#F8FAFC] text-[#080A12] shadow-sm font-bold"
                      : "text-[#CBD5E1] hover:text-[#F8FAFC]"
                  }`}
                >
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${mode === "sandbox" ? "bg-[#080A12]" : "bg-[#FBBF24]"}`} />
                  <span>🧪 Club Diagnostic Sandbox</span>
                  <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded font-mono font-bold ${
                    mode === "sandbox" ? "bg-black/10 text-[#080A12]" : "bg-white/5 text-[#FBBF24]"
                  }`}>Simulation</span>
                </button>
              </div>
            </div>

            {/* Middle: Simulation State (Before vs. After) */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748B] hidden sm:inline mr-1">SIMULATION STATE:</span>
              <div className="flex items-center rounded-full bg-[#171C33] border border-[#262D4D] p-1">
                <button
                  type="button"
                  onClick={resetToBaseline}
                  className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    !isAfterMode
                      ? "bg-[#F8FAFC] text-[#080A12] shadow-sm font-bold"
                      : "text-[#CBD5E1] hover:text-[#F8FAFC]"
                  }`}
                  aria-pressed={!isAfterMode}
                >
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${!isAfterMode ? "bg-[#080A12]" : "bg-[#64748B]"}`} />
                  <span>Before: Baseline</span>
                </button>
                <button
                  type="button"
                  onClick={applyAfterTarget}
                  className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    isAfterMode
                      ? "bg-[#F8FAFC] text-[#080A12] shadow-sm font-bold"
                      : "text-[#CBD5E1] hover:text-[#F8FAFC]"
                  }`}
                  aria-pressed={isAfterMode}
                >
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${isAfterMode ? "bg-[#C084FC]" : "bg-[#64748B]"}`} />
                  <span>After: 90-Day Target</span>
                  <span className={`rounded px-1.5 py-0.2 text-[9px] uppercase tracking-wider font-mono font-bold ${
                    isAfterMode ? "bg-[#C084FC]/25 text-[#080A12]" : "bg-white/5 text-[#C084FC]"
                  }`}>
                    +Parity
                  </span>
                </button>
              </div>
            </div>

            {/* Far Right: Sarajevo Hackathon Event Tag (Always on Top Right) */}
            <div className="flex items-center gap-2 pl-3 border-l border-[#262D4D]">
              <div className="text-right leading-none">
                <span className="block text-[11px] font-extrabold tracking-wider text-[#F8FAFC]">SARAJEVO</span>
                <span className="block text-[8px] font-mono text-[#64748B]">HACKATHON 2026</span>
              </div>
              <span className="rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider font-mono bg-[#171C33] border border-[#262D4D] text-[#C084FC] whitespace-nowrap">
                ERASMUS+ · TRACK 04
              </span>
            </div>
          </div>

          {/* ── Main Header Row (Single Clean Horizontal Row) ── */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Left: Brand & Subtitle */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-extrabold tracking-tight text-[#F8FAFC] md:text-3xl">
                  SHE COUNTS: <span style={{ color: VIOLET }}>Women in Sport</span>
                </h1>
                {customCohort && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#FBBF24]/15 border border-[#FBBF24]/35 text-[#FBBF24] font-semibold">
                    {customCohort.label}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#64748B]">
                Track 04 · Verified BiH &amp; Eurostat Benchmarks (Zero-PII Architecture)
              </p>
            </div>

            {/* Center-Right Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Warm Championship Gold Geography / Sport Dropdown */}
              <select
                value={customCohort ? (customCohort.isMacro ? "bih" : "demo-football") : view}
                onChange={(e) => { setCustomCohort(null); setView(e.target.value as ClubId); }}
                className="rounded-lg px-3 py-1.5 text-xs font-bold transition-all border border-[#FBBF24]/70 bg-[#FBBF24]/10 text-[#FBBF24] outline-none cursor-pointer"
                disabled={!!customCohort}
              >
                {currentOptions.map((o) => (
                  <option key={o.id} value={o.id} className="bg-[#111526] text-[#F8FAFC]">
                    {o.label}
                  </option>
                ))}
              </select>

              {/* Compact High-Contrast Action Buttons */}
              <input
                ref={fileInputRef} type="file" accept=".csv" className="hidden"
                onChange={handleCsvUpload} aria-label="Upload CSV Data"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all bg-[#171C33] border border-[#262D4D] text-[#CBD5E1] hover:border-[#C084FC] hover:text-[#F8FAFC]"
                title="Upload Bosnia & Herzegovina research CSV or grassroots club CSV"
              >
                ↑ Upload CSV
              </button>
              <button
                onClick={downloadBihCsv}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all bg-[#171C33] border border-[#262D4D] text-[#CBD5E1] hover:border-[#C084FC] hover:text-[#F8FAFC]"
                title="Download verified Bosnia & Herzegovina adolescent physical activity dataset"
              >
                Sample CSV
              </button>
              <button
                onClick={downloadSampleCsv}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all bg-[#171C33] border border-[#262D4D] text-[#CBD5E1] hover:border-[#C084FC] hover:text-[#F8FAFC]"
                title="Download generic club CSV template"
              >
                Club Template
              </button>
              <button
                onClick={() => setShowEvidence(true)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all bg-[#171C33] border border-[#262D4D] text-[#CBD5E1] hover:border-[#C084FC] hover:text-[#F8FAFC]"
              >
                Evidence &amp; Sources
              </button>
              {customCohort && (
                <button
                  onClick={() => { setCustomCohort(null); setUploadWarnings([]); }}
                  className="rounded-lg px-2.5 py-1.5 text-xs transition-colors text-[#64748B] hover:text-[#F8FAFC]"
                >
                  ✕ Clear
                </button>
              )}

              {/* Gemini AI Analyst Button (Rightmost in Actions Section) */}
              <button
                onClick={runAnalysis}
                disabled={loading}
                className="rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all disabled:opacity-60 bg-[#C084FC] hover:bg-[#A855F7] text-[#080A12] shadow-[0_0_16px_rgba(192,132,252,0.4)] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                title="Generate 90-Day Policy Roadmap via Gemini AI"
              >
                {loading ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#080A12] border-t-transparent" />
                    <span>Analysing…</span>
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    <span>{mode === "macro" ? "Generate 90-Day Policy Roadmap (AI Analyst)" : "Generate 90-Day Club Plan (AI Analyst)"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
          {uploadWarnings.length > 0 && (
            <div className="mt-3 rounded-lg px-4 py-2 text-xs" style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", color: GOLD }}>
              {uploadWarnings.map((w, i) => <p key={i}>{w}</p>)}
            </div>
          )}
        </header>

        {/* ── Mode Context Banner: Macro Telemetry vs Club Diagnostic Sandbox ── */}
        {mode === "macro" ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-3.5 text-xs bg-[#111526] border border-[#262D4D] shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🇧🇦</span>
              <div>
                <span className="font-bold text-[#F8FAFC]">HOST COUNTRY &amp; EUROPEAN BENCHMARK TELEMETRY: </span>
                <span className="text-[#CBD5E1]">
                  Displaying verified peer-reviewed Bosnia &amp; Herzegovina adolescent physical activity data (PMC8534587, PMC8620439, PMC7761556) alongside Eurostat (hlth_ehis_pe3i, hlth_ehis_pe2e), Special Eurobarometer 574, and Erasmus+ ICOACHKIDS+. Zero fabricated local club names.
                </span>
              </div>
            </div>
            <Badge color="violet">BiH &amp; Eurostat Verified</Badge>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-3.5 text-xs bg-[#111526] border border-[#FBBF24]/40 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🧪</span>
              <div>
                <span className="font-bold text-[#FBBF24]">CLUB DIAGNOSTIC SANDBOX (SYNTHETIC DEMO MODEL — LAW 03 COMPLIANT): </span>
                <span className="text-[#CBD5E1]">
                  Interactive grassroots simulation modeling prime pitch scheduling (18:00–21:00), female coach staffing, dark-shorts kits, and washroom period supplies. Test with synthetic demo clubs or upload your club CSV.
                </span>
              </div>
            </div>
            <Badge color="gold">Synthetic Sandbox Model</Badge>
          </div>
        )}

        {/* ── Implemented Interventions Action Bar (Visible in AFTER Mode) ── */}
        {isAfterMode && (
          <div
            className="rounded-xl p-4 transition-all duration-300 animate-in fade-in slide-in-from-top-2"
            style={{
              background: "linear-gradient(135deg, rgba(192,132,252,0.12) 0%, rgba(17,21,38,0.95) 100%)",
              border: "1px solid rgba(192,132,252,0.45)",
              boxShadow: "0 0 25px rgba(192,132,252,0.15), 0 8px 30px rgba(0,0,0,0.5)",
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#C084FC]/25 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#C084FC] text-[#080A12] font-black text-xs shadow-[0_0_10px_rgba(192,132,252,0.6)]">
                  ✓
                </span>
                <span className="text-sm font-extrabold text-[#F8FAFC] tracking-tight">
                  ACTIVE 90-DAY POLICY INTERVENTIONS (PROJECTED PARITY RUNNING)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#34D399] font-mono">
                  +{sim.shareGain}% Active Share Growth | +{sim.retained} Retained Girls | −{sim.hazardDrop} pp Hazard Drop
                </span>
              </div>
            </div>

            {/* 4-Pill Grid with Distinct Accent Borders */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {/* Pill 1: Sky #38BDF8 */}
              <div
                className="rounded-lg p-3 bg-[#080A12] flex flex-col justify-between"
                style={{
                  border: "1px solid #262D4D",
                  borderTop: `2px solid ${SKY}`,
                  borderLeft: `2px solid ${SKY}`,
                }}
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold" style={{ color: SKY }}>
                    <span>1. 50/50 Prime-Hour Rotation</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: "rgba(56,189,248,0.15)", border: "1px solid rgba(56,189,248,0.35)", color: SKY }}>€0 Cost</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-[#F8FAFC]">18:00–20:00 Equal Pitch Allocation</p>
                  <p className="mt-1 text-[11px] text-[#CBD5E1]">Solves 37–40% Eurobarometer time/schedule barrier (€0 cost).</p>
                </div>
              </div>

              {/* Pill 2: Rose #FB7185 */}
              <div
                className="rounded-lg p-3 bg-[#080A12] flex flex-col justify-between"
                style={{
                  border: "1px solid #262D4D",
                  borderTop: `2px solid ${CORAL}`,
                  borderLeft: `2px solid ${CORAL}`,
                }}
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold" style={{ color: CORAL }}>
                    <span>2. Dark Shorts &amp; Washroom Packs</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: "rgba(251,113,133,0.15)", border: "1px solid rgba(251,113,133,0.35)", color: CORAL }}>Near-€0</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-[#F8FAFC]">Dark Shorts Policy &amp; Period Supplies</p>
                  <p className="mt-1 text-[11px] text-[#CBD5E1]">Solves 78% Women in Sport period/leakage avoidance (Near-€0 cost).</p>
                </div>
              </div>

              {/* Pill 3: Violet #C084FC */}
              <div
                className="rounded-lg p-3 bg-[#080A12] flex flex-col justify-between"
                style={{
                  border: "1px solid #262D4D",
                  borderTop: `2px solid ${VIOLET}`,
                  borderLeft: `2px solid ${VIOLET}`,
                }}
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold" style={{ color: VIOLET }}>
                    <span>3. Senior Female Athlete Mentors</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: "rgba(192,132,252,0.15)", border: "1px solid rgba(192,132,252,0.35)", color: VIOLET }}>Low Cost</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-[#F8FAFC]">Senior Athlete Assistant Mentors</p>
                  <p className="mt-1 text-[11px] text-[#CBD5E1]">Solves 63% lack of female role models (Low cost).</p>
                </div>
              </div>

              {/* Pill 4: Championship Gold #FBBF24 */}
              <div
                className="rounded-lg p-3 bg-[#080A12] flex flex-col justify-between"
                style={{
                  border: "1px solid #262D4D",
                  borderTop: `2px solid ${GOLD}`,
                  borderLeft: `2px solid ${GOLD}`,
                }}
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold" style={{ color: GOLD }}>
                    <span>4. 10-Min Injury Warmup Protocol</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.35)", color: GOLD }}>€0 Cost</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-[#F8FAFC]">ACL &amp; Joint Prevention Routine</p>
                  <p className="mt-1 text-[11px] text-[#CBD5E1]">Solves 15% Eurobarometer health/injury barrier (€0 cost).</p>
                </div>
              </div>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center justify-between text-[10px] text-[#64748B] italic gap-2">
              <span>*Projected growth modeled using barrier-reduction elasticity weights from Eurobarometer 574, Women in Sport (2022), and PMC12330288.</span>
              <button
                type="button"
                onClick={resetToBaseline}
                className="text-[#C084FC] hover:underline font-bold not-italic"
              >
                ← Return to Raw Baseline
              </button>
            </div>
          </div>
        )}

        {/* ── Hero KPI Cards ── */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            title="Female Active Share"
            main={isAfterMode ? `${sim.projectedShare}%` : `${k.femaleActiveShare}%`}
            mainColor={VIOLET}
            accentColor={isAfterMode ? VIOLET : undefined}
            sub={
              isAfterMode
                ? `${sim.currentActive} → ${sim.projectedActive} active players (+${sim.retained} newly engaged)`
                : `${k.totalFA} / ${k.totalFA + k.totalMA} active players`
            }
            badge={
              isAfterMode
                ? `+${sim.shareGain}% Growth (+${sim.retained} Active Girls)`
                : "50% Parity Target"
            }
            badgeColor={isAfterMode ? "emerald" : "violet"}
            bottom={
              <div className="space-y-1">
                <ProgressBar value={isAfterMode ? sim.projectedShare : k.femaleActiveShare} color={VIOLET} />
                <div className="flex justify-between text-xs text-[#64748B]">
                  <span>{isAfterMode ? `${k.femaleActiveShare}% baseline` : "toward 50% parity"}</span>
                  {isAfterMode && <span className="text-[#34D399] font-bold">Target Reached</span>}
                </div>
              </div>
            }
          />
          <KpiCard
            title="Adolescent Dropout Cliff (U14→U18)"
            main={isAfterMode ? `${sim.projected}%` : `${k.dropoutCliff}%`}
            mainColor={GOLD}
            accentColor={GOLD}
            sub={
              isAfterMode
                ? `Hazard drops from ${k.dropoutCliff}% to ${sim.projected}% (−${sim.hazardDrop} pp reduction)`
                : `${k.u14fa - k.u18fa} girls lost between U14 and U18`
            }
            badge={
              isAfterMode
                ? `−${sim.hazardDrop} pp Hazard Drop`
                : "ICOACHKIDS+: 52% teen dropout window"
            }
            badgeColor={isAfterMode ? "emerald" : "gold"}
          />
          <KpiCard
            title="Prime-Time Pitch Share (18:00–21:00)"
            main={isAfterMode ? `${postPrimeSlot}%` : `${k.primeSlotAvg}%`}
            mainColor={isAfterMode ? SKY : VIOLET}
            accentColor={isAfterMode ? SKY : undefined}
            sub={
              isAfterMode
                ? "50/50 evening allocation active (18:00–20:00 priority for girls' squads)"
                : `${100 - k.primeSlotAvg}% male-skewed — Eurobarometer: 40% cite time barriers`
            }
            badge={
              isAfterMode
                ? `50% Target Parity (+${primeGain} pp)`
                : (k.primeSlotAvg < 40
                  ? `${((100 - k.primeSlotAvg) / Math.max(1, k.primeSlotAvg)).toFixed(1)}x Male Skew`
                  : "Near Parity")
            }
            badgeColor={isAfterMode ? "sky" : (k.primeSlotAvg < 40 ? "coral" : "violet")}
          />
          <KpiCard
            title="Female Coaching & Kit Score"
            main={isAfterMode ? `${postComposite}%` : `${k.femaleCoachAvg}%`}
            mainColor={VIOLET}
            accentColor={isAfterMode ? VIOLET : undefined}
            sub={
              isAfterMode
                ? `${baseComposite}% → ${postComposite}% (45% female coaches, 100% dark kit & period packs)`
                : `Female coaching ${k.femaleCoachAvg}%. Puberty Support Score: ${k.pubertySupportAvg}/100`
            }
            badge={isAfterMode ? `Kit & Coaching Parity (${postComposite}%)` : (k.pubertySupportAvg < 50 ? "Kit & Mentorship Gap" : "On Track")}
            badgeColor={isAfterMode ? "emerald" : (k.pubertySupportAvg < 50 ? "coral" : "violet")}
          />
        </div>

        {/* ── 3-Column Bento Grid ── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">

          {/* Left + Centre Combined Container (spans 9 of 12 cols = 2 cols of 3-col split) */}
          <div className="space-y-5 lg:col-span-9">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-9">

              {/* Left Sub-Column (3 of 9 cols) */}
              <div className="space-y-5 lg:col-span-3">
                <Card title="Weekly Prime-Slot Share" accent="violet">
                  <Donut
                    data={[
                      { v: isAfterMode ? sim.projectedShare : k.femaleActiveShare, c: VIOLET, glow: true },
                      { v: isAfterMode ? +(100 - sim.projectedShare).toFixed(1) : k.maleActiveShare, c: GOLD },
                    ]}
                    center={
                      <>
                        <span className="kpi text-3xl font-extrabold text-[#F8FAFC]">
                          {isAfterMode ? `${sim.projectedShare}%` : `${k.femaleActiveShare}%`}
                        </span>
                        <span className="text-xs font-semibold text-[#CBD5E1]">
                          {isAfterMode ? "Female (Target)" : "Female"}
                        </span>
                      </>
                    }
                  />
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <Badge color={isAfterMode ? "emerald" : "violet"}>{isAfterMode ? "50/50 Parity Reached" : "Target: 50/50"}</Badge>
                    <span className="text-[#64748B]">Prime 18:00–21:00</span>
                  </div>
                </Card>

                <Card title="Teen Retention Hazard (U14–U18)" accent={isAfterMode ? "emerald" : "coral"}>
                  <Donut
                    data={[
                      { v: isAfterMode ? sim.projected : k.dropoutCliff, c: isAfterMode ? EMERALD : CORAL },
                      { v: isAfterMode ? +(100 - sim.projected).toFixed(1) : 100 - k.dropoutCliff, c: "#171C33" },
                    ]}
                    center={
                      <>
                        <span className="kpi text-3xl font-extrabold text-[#F8FAFC]">
                          {isAfterMode ? `${sim.projected}%` : `${k.dropoutCliff}%`}
                        </span>
                        <span className="text-xs font-semibold" style={{ color: isAfterMode ? EMERALD : CORAL }}>
                          {isAfterMode ? "Projected Hazard" : "Dropout Risk"}
                        </span>
                      </>
                    }
                  />
                  <div className="mt-2">
                    <Badge color={isAfterMode ? "emerald" : "coral"}>
                      {isAfterMode ? `−${sim.hazardDrop} pp Hazard Reduction` : "⚠ Hazard cohort: Ages 14–18"}
                    </Badge>
                    <p className="mt-2 text-xs text-[#64748B]">
                      ICOACHKIDS+: 52% of all EU youth sport dropouts occur at ages 14–18. 70% of dropped-out girls still consider themselves "sporty."
                    </p>
                  </div>
                </Card>
              </div>

              {/* Centre Sub-Column (6 of 9 cols) */}
              <div className="space-y-5 lg:col-span-6">
                <Card title="Active Retention Curve — Female vs. Male by Cohort" accent="violet">
                  <div className="relative h-64">
                    <RunnerWatermark />
                    <ResponsiveContainer className="relative z-10">
                      <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                        <defs>
                          <linearGradient id="femaleGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={VIOLET} stopOpacity={0.35} />
                            <stop offset="100%" stopColor={VIOLET} stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="maleGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={GOLD} stopOpacity={0.28} />
                            <stop offset="100%" stopColor={GOLD} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid {...CHART_GRID} vertical={false} />
                        <XAxis dataKey="age" tick={CHART_TICK_X} axisLine={false} tickLine={false} />
                        <YAxis unit="%" domain={[0, 100]} tick={CHART_TICK_Y} axisLine={false} tickLine={false} />
                        <Tooltip {...TIP_STYLE} />
                        <Legend
                          wrapperStyle={{ color: "#CBD5E1", fontSize: 11 }}
                          formatter={(value) => {
                            if (value === "Female Active — Post-Intervention (%)") {
                              return (
                                <span style={{ color: VIOLET, fontWeight: 700 }}>
                                  ✨ Female Active — Post-Intervention (%) [Solid Parity Lift]
                                </span>
                              );
                            }
                            if (value === "Female Baseline (%)" || value === "Before: Baseline Female (%)") {
                              return <span style={{ color: "#94A3B8", fontStyle: "italic" }}>Female Baseline (%) [Dashed]</span>;
                            }
                            if (value === "Female Active (%)") {
                              return <span style={{ color: VIOLET, fontWeight: 600 }}>Female Active (%)</span>;
                            }
                            return <span style={{ color: GOLD, fontWeight: 600 }}>Male Active (%)</span>;
                          }}
                        />
                        <ReferenceLine
                          x="U14"
                          stroke={AMBER}
                          strokeDasharray="4 2"
                          label={{ value: "Puberty & Schedule Cliff", fill: AMBER, fontSize: 10, position: "insideTopRight" }}
                        />
                        {isAfterMode ? (
                          <>
                            {/* Faint dashed line for Female Baseline (%) */}
                            <Area
                              type="linear"
                              dataKey="female"
                              name="Female Baseline (%)"
                              stroke="#94A3B8"
                              fill="none"
                              strokeWidth={2}
                              strokeDasharray="4 4"
                              opacity={0.45}
                            />
                            {/* Bright #C084FC solid line for Female Active — Post-Intervention (%) */}
                            <Area
                              type="linear"
                              dataKey="projectedFemale"
                              name="Female Active — Post-Intervention (%)"
                              stroke={VIOLET}
                              fill="url(#femaleGradient)"
                              strokeWidth={3}
                              dot={{ fill: VIOLET, r: 4, stroke: "#080A12", strokeWidth: 2 }}
                            />
                          </>
                        ) : (
                          <>
                            <Area
                              type="linear"
                              dataKey="female"
                              name="Female Active (%)"
                              stroke={VIOLET}
                              fill="url(#femaleGradient)"
                              strokeWidth={3}
                              dot={{ fill: VIOLET, r: 3 }}
                            />
                            {(s1 > 0 || s2 > 0 || s3 > 0) && (
                              <Area
                                type="linear"
                                dataKey="projectedFemale"
                                name="Female Active — Post-Intervention (%)"
                                stroke={VIOLET}
                                fill="none"
                                strokeWidth={2.5}
                                strokeDasharray="6 4"
                                dot={{ fill: VIOLET, r: 4, stroke: "#080A12", strokeWidth: 1.5 }}
                              />
                            )}
                          </>
                        )}
                        <Area
                          type="linear"
                          dataKey="male"
                          name="Male Active (%)"
                          stroke={GOLD}
                          fill="url(#maleGradient)"
                          strokeWidth={2.5}
                          dot={{ fill: GOLD, r: 3 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card title="Age Cohort Comparison Matrix">
                  <div className="overflow-x-auto">
                    <table className="kpi w-full border-collapse text-sm">
                      <thead>
                        <tr className="text-left text-[#64748B]">
                          <th className="border p-2 text-xs" style={{ borderColor: "#262D4D" }}>Cohort</th>
                          <th className="border p-2 text-xs" style={{ borderColor: "#262D4D" }}>Female Active</th>
                          <th className="border p-2 text-xs" style={{ borderColor: "#262D4D" }}>Male Active</th>
                          <th className="border p-2 text-xs" style={{ borderColor: "#262D4D" }}>Retention Gap</th>
                          <th className="border p-2 text-xs" style={{ borderColor: "#262D4D" }}>Prime Slot Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {k.ages.map((a, idx) => {
                          const proj = sim.projectedAges?.[idx]?.projectedFemale ?? a.female;
                          const fProj = Number(proj.toFixed(1));
                          const fFemale = Number(a.female.toFixed(1));
                          const fMale = Number(a.male.toFixed(1));
                          const fGain = Number((proj - a.female).toFixed(1));
                          const fBaseGap = Number(a.gap.toFixed(1));
                          const rawPostGap = a.male - proj;
                          const fPostGap = Number(Math.max(0, rawPostGap).toFixed(1));
                          const fPrime = Number(a.primeSlotPct.toFixed(1));
                          const displayGap = isAfterMode ? fPostGap : fBaseGap;

                          return (
                            <tr key={a.age} className="transition-colors hover:bg-white/5">
                              <td className="border p-2 font-semibold text-[#F8FAFC]" style={{ borderColor: "#262D4D" }}>{a.age}</td>
                              <td className="border p-2 font-bold" style={{ borderColor: "#262D4D", color: VIOLET }}>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span>{isAfterMode ? `${fProj}%` : `${fFemale}%`}</span>
                                  {isAfterMode && fGain > 0 && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-[#34D399]/20 text-[#34D399] border border-[#34D399]/40">
                                      +{fGain} pp
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="border p-2 font-semibold" style={{ borderColor: "#262D4D", color: GOLD }}>{fMale}%</td>
                              <td className="border p-2 font-semibold" style={{ borderColor: "#262D4D", color: displayGap > 15 ? CORAL : displayGap > 5 ? GOLD : EMERALD }}>
                                {isAfterMode ? (
                                  <div className="flex items-center gap-1">
                                    <span>{fPostGap > 0 ? "−" : ""}{fPostGap} pp</span>
                                    {fGain > 0 && (
                                      <span className="text-[10px] text-[#34D399] font-mono">
                                        ({fBaseGap > 0 ? "−" : ""}{fBaseGap} → {fPostGap > 0 ? "−" : ""}{fPostGap})
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span>{fBaseGap > 0 ? "−" : ""}{fBaseGap} pp</span>
                                )}
                              </td>
                              <td className="border p-2" style={{ borderColor: "#262D4D", color: fPrime < 40 ? CORAL : "#F8FAFC" }}>
                                {isAfterMode && s1 >= 50 ? "50%" : `${fPrime}%`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </div>

            {/* ── Expected Post-Intervention Impact Readout Bar (Aligned flush below Left & Centre Cards) ── */}
            <div
              className="rounded-xl p-4 space-y-3"
              style={{
                background: "#111526",
                border: "1px solid rgba(192,132,252,0.35)",
                boxShadow: "0 8px 30px rgba(0,0,0,0.5), inset 0 1px 0 0 rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex items-center justify-between border-b border-[#262D4D] pb-2.5">
                <div className="flex items-center gap-2 font-bold text-xs text-[#F8FAFC]">
                  <span style={{ color: VIOLET }}>📈</span>
                  <span className="tracking-wide uppercase">EXPECTED POST-INTERVENTION IMPACT (PARITY PROJECTION)</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    sim.retained > 0
                      ? "bg-[#34D399]/20 text-[#34D399] border border-[#34D399]/40"
                      : "bg-[#171C33] text-[#64748B]"
                  }`}
                >
                  {sim.retained > 0 ? `+${sim.retained} Retained Girls` : "Baseline (No Levers)"}
                </span>
              </div>

              {/* 3-Metric Growth Grid */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {/* Metric 1: Female Participation Growth */}
                <div
                  className="rounded-lg p-3"
                  style={{ background: "#080A12", border: "1px solid rgba(192,132,252,0.35)" }}
                >
                  <span className="text-[11px] font-semibold text-[#64748B] block">Female Participation Growth</span>
                  <div className="kpi mt-1 text-lg font-extrabold tabular-nums" style={{ color: VIOLET }}>
                    {sim.shareGain > 0 ? `+${Number(sim.shareGain.toFixed(1))}%` : "+0.0%"}
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#CBD5E1]">
                    {Number(sim.currentShare.toFixed(1))}% → {Number(sim.projectedShare.toFixed(1))}% Female Active Share
                  </p>
                </div>

                {/* Metric 2: Projected Active Female Athletes */}
                <div
                  className="rounded-lg p-3"
                  style={{ background: "#080A12", border: "1px solid #262D4D" }}
                >
                  <span className="text-[11px] font-semibold text-[#64748B] block">Projected Active Female Athletes</span>
                  <div className="kpi mt-1 text-lg font-extrabold text-[#F8FAFC] tabular-nums">
                    {sim.projectedActive}
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#CBD5E1]">
                    {sim.currentActive} → {sim.projectedActive} (+{sim.retained} retained &amp; newly engaged girls)
                  </p>
                </div>

                {/* Metric 3: Teen Dropout Hazard Drop */}
                <div
                  className="rounded-lg p-3"
                  style={{
                    background: "#080A12",
                    border: sim.hazardDrop > 0 ? "1px solid rgba(251,191,36,0.35)" : "1px solid #262D4D",
                  }}
                >
                  <span className="text-[11px] font-semibold text-[#64748B] block">Teen Dropout Hazard Drop</span>
                  <div
                    className="kpi mt-1 text-lg font-extrabold tabular-nums"
                    style={{ color: sim.hazardDrop > 0 ? GOLD : "#64748B" }}
                  >
                    {sim.hazardDrop > 0 ? `−${Number(sim.hazardDrop.toFixed(1))} pp` : "0.0 pp"}
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#CBD5E1]">
                    {Number(k.dropoutCliff.toFixed(1))}% → {Number(sim.projected.toFixed(1))}% ({sim.hazardDrop > 0 ? `-${Number(sim.hazardDrop.toFixed(1))} pp reduction` : "Baseline hazard"})
                  </p>
                </div>
              </div>

              {/* Transparent methodology disclaimer */}
              <p className="text-[10px] italic text-[#64748B] leading-tight pt-1">
                Hypothetical Policy Elasticity Model — weighted against Eurobarometer 574 (37% time), Women in Sport (78% period/kit), and PMC12330288 (63% female role-model) barrier elasticities.
              </p>
            </div>
          </div>

          {/* Right Column (spans 3 of 12 cols = 1 col of 3-col split) */}
          <div className="space-y-5 lg:col-span-3">
            <Card title="Prime-Hour Disparity (18:00–21:00)" accent="coral">
              <div className="h-44">
                <ResponsiveContainer className="relative z-10">
                  <BarChart data={k.days} margin={{ top: 2, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid {...CHART_GRID} vertical={false} />
                    <XAxis dataKey="day" tick={CHART_TICK_X} axisLine={false} tickLine={false} />
                    <YAxis unit="h" tick={CHART_TICK_Y} axisLine={false} tickLine={false} />
                    <Tooltip {...TIP_STYLE} />
                    <Bar dataKey="female" name="Female slots (hrs)" fill={VIOLET} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="male"   name="Male slots (hrs)"   fill={GOLD}   radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="kpi mt-3 text-3xl font-extrabold text-[#F8FAFC]">
                {k.primeMaleSkew}x
              </p>
              <p className="text-xs text-[#CBD5E1]">
                Prime-hour slots skew heavily male (Mon–Fri 18:00–21:00)
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge color="violet">Female Coach: {k.femaleCoachAvg}%</Badge>
                <Badge color="gold">Prime Slot Gap: {100 - k.primeSlotAvg - k.primeSlotAvg}pp</Badge>
              </div>
            </Card>

            <Card
              title={
                mode === "macro"
                  ? 'POLICY OPTIMIZER — "WHAT IF?" MACRO PARITY SIMULATOR'
                  : 'CLUB DIAGNOSTIC SANDBOX — "WHAT IF?" RETENTION SIMULATOR'
              }
              accent="gold"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 border-b border-[#262D4D] pb-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
                    Intervention Levers
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={resetToBaseline}
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold transition-all border ${
                        !isAfterMode
                          ? "border-white/20 bg-[#171C33] text-[#F8FAFC]"
                          : "border-[#262D4D] bg-[#080A12] text-[#64748B] hover:text-[#F8FAFC]"
                      }`}
                      title="Reset all levers to baseline (0%)"
                    >
                      ↺ Before (Baseline)
                    </button>
                    <button
                      type="button"
                      onClick={applyAfterTarget}
                      className={`rounded px-2.5 py-0.5 text-[10px] font-bold transition-all border ${
                        isAfterMode
                          ? "border-[#C084FC] bg-[#C084FC] text-[#080A12] shadow-[0_0_12px_rgba(192,132,252,0.5)]"
                          : "border-[#C084FC]/40 bg-[#C084FC]/15 text-[#C084FC] hover:bg-[#C084FC]/25 shadow-[0_0_10px_rgba(192,132,252,0.2)]"
                      }`}
                      title="Apply 90-day target parity (Prime 50%, Coach 45%, Kit 100%)"
                    >
                      ⚡ After (90-Day Target)
                    </button>
                  </div>
                </div>

                <ControlledTelemetrySlider
                  label={
                    mode === "macro"
                      ? "Prime-Hour Slot Allocation Mandate (18:00–21:00) %"
                      : "Shift Prime-Time Slots (18:00–21:00) to Girls %"
                  }
                  value={s1}
                  onChange={(v) => { setS1(v); if (v > 0) setIsAfterMode(true); }}
                  accentColor={VIOLET}
                />
                <ControlledTelemetrySlider
                  label={
                    mode === "macro"
                      ? "Female Coaching & Mentorship Ratio %"
                      : "Increase Accredited Female Coaching Staff %"
                  }
                  value={s2}
                  onChange={(v) => { setS2(v); if (v > 0) setIsAfterMode(true); }}
                  accentColor={VIOLET}
                />
                <ControlledTelemetrySlider
                  label={
                    mode === "macro"
                      ? "Dark-Kit & Period-Ready Facility Support %"
                      : "Puberty & Period Kit/Facility Support %"
                  }
                  value={s3}
                  onChange={(v) => { setS3(v); if (v > 0) setIsAfterMode(true); }}
                  accentColor={VIOLET}
                />

                <div className="rounded-lg p-2.5 bg-[#080A12] border border-[#262D4D] text-[11px] text-[#CBD5E1]">
                  <span className="font-semibold text-[#F8FAFC]">⚡ Live Parity Engine: </span>
                  Adjust sliders to project female active retention, prime slot equity, and club growth live across the telemetry bar on the left.
                </div>

                {mode === "macro" && (
                  <button
                    type="button"
                    onClick={() => { setMode("sandbox"); setView("demo-football"); }}
                    className="w-full text-center py-2 px-3 rounded-lg border border-[#FBBF24]/30 bg-[#FBBF24]/10 hover:bg-[#FBBF24]/20 text-[#FBBF24] text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
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
            background: "#111526",
            border: "1px solid #262D4D",
            boxShadow: "0 8px 30px rgba(0,0,0,0.5), inset 0 1px 0 0 rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#262D4D] pb-4 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight text-[#F8FAFC]">
                  SPORT FORMAT SKEW
                </span>
                <span className="text-sm font-semibold text-[#64748B]">
                  — Male-Dominated Clubs vs. Female-Led Activities
                </span>
              </div>
              <p className="mt-1 text-xs text-[#CBD5E1]">
                Verified empirical data from Women in Sport (2022) &amp; Eurostat (hlth_ehis_pe3i)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-[#FBBF24]/10 border border-[#FBBF24]/30 text-[#FBBF24]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#FBBF24]" />
                Boys Baseline
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-[#C084FC]/10 border border-[#C084FC]/30 text-[#C084FC]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#C084FC]" />
                Girls Participation
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Left Column: Male-Dominated Organized Arenas */}
            <div
              className="rounded-xl p-4 md:p-5 flex flex-col justify-between"
              style={{
                background: "#080A12",
                border: "1px solid rgba(251,191,36,0.3)",
              }}
            >
              <div>
                <div className="flex items-center justify-between border-b border-[#262D4D] pb-3 mb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#F8FAFC] flex items-center gap-2">
                      <span className="text-[#FBBF24]">▼</span>
                      <span>Male-Dominated Organized Arenas</span>
                    </h3>
                    <p className="text-[11px] text-[#64748B]">External team clubs &amp; facility-dependent sports</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#FBBF24]/15 text-[#FBBF24] border border-[#FBBF24]/30">
                    −13 to −17 pp Deficit
                  </span>
                </div>

                <div className="space-y-4">
                  {SPORT_MODALITY_SPLIT.maleDominated.map((item) => (
                    <div key={item.arena} className="space-y-1.5">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-semibold text-[#F8FAFC]">{item.arena}</span>
                        <span className="font-bold text-[#FBBF24] font-mono text-[11px]">{item.gapLabel}</span>
                      </div>
                      <div className="space-y-1">
                        {/* Boys Bar */}
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-10 text-[#64748B]">Boys:</span>
                          <div className="h-2 flex-1 rounded-full bg-[#171C33] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${item.malePct}%`, background: GOLD }}
                            />
                          </div>
                          <span className="w-10 text-right font-mono font-bold text-[#FBBF24]">{item.malePct}%</span>
                        </div>
                        {/* Girls Bar */}
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-10 text-[#64748B]">Girls:</span>
                          <div className="h-2 flex-1 rounded-full bg-[#171C33] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${item.femalePct}%`, background: VIOLET }}
                            />
                          </div>
                          <span className="w-10 text-right font-mono font-bold text-[#C084FC]">{item.femalePct}%</span>
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
                background: "#080A12",
                border: "1px solid rgba(192,132,252,0.3)",
              }}
            >
              <div>
                <div className="flex items-center justify-between border-b border-[#262D4D] pb-3 mb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#F8FAFC] flex items-center gap-2">
                      <span className="text-[#C084FC]">▲</span>
                      <span>Female-Led &amp; Parity Arenas</span>
                    </h3>
                    <p className="text-[11px] text-[#64748B]">Self-paced, individual &amp; school physical education</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#C084FC]/15 text-[#C084FC] border border-[#C084FC]/30">
                    +2 to +10 pp Parity Lead
                  </span>
                </div>

                <div className="space-y-4">
                  {SPORT_MODALITY_SPLIT.femaleParity.map((item) => (
                    <div key={item.arena} className="space-y-1.5">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-semibold text-[#F8FAFC]">{item.arena}</span>
                        <span className="font-bold text-[#C084FC] font-mono text-[11px]">{item.gapLabel}</span>
                      </div>
                      <div className="space-y-1">
                        {/* Girls Bar */}
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-10 text-[#64748B]">Girls:</span>
                          <div className="h-2 flex-1 rounded-full bg-[#171C33] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${item.femalePct}%`, background: VIOLET }}
                            />
                          </div>
                          <span className="w-10 text-right font-mono font-bold text-[#C084FC]">{item.femalePct}%</span>
                        </div>
                        {/* Boys Bar */}
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-10 text-[#64748B]">Boys:</span>
                          <div className="h-2 flex-1 rounded-full bg-[#171C33] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${item.malePct}%`, background: GOLD }}
                            />
                          </div>
                          <span className="w-10 text-right font-mono font-bold text-[#FBBF24]">{item.malePct}%</span>
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
              background: "rgba(192,132,252,0.08)",
              border: "1px solid rgba(192,132,252,0.35)",
            }}
          >
            <div className="flex items-start gap-3">
              <span className="text-lg leading-none" role="img" aria-label="insight">💡</span>
              <div className="space-y-1">
                <span className="font-bold text-[#C084FC] text-xs uppercase tracking-wide">
                  Core Analytical Insight:
                </span>
                <p className="text-xs text-[#F8FAFC] font-medium leading-relaxed italic">
                  &ldquo;{SPORT_FORMAT_ANALYTICAL_INSIGHT}&rdquo;
                </p>
                <p className="text-[11px] text-[#CBD5E1] pt-1">
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
                <span className="font-normal text-[#64748B]">
                  {mode === "macro"
                    ? "— Verified EU Evidence & 90-Day Policy Roadmap"
                    : "— Root-Cause Diagnostics & 90-Day Action Plan"}
                </span>
              </h2>
              <p className="mt-1 text-xs text-[#CBD5E1]">
                {mode === "macro"
                  ? `Verified Macro Geography: ${displayLabel}`
                  : `Club Diagnostic Telemetry: ${displayLabel}`}
              </p>
            </div>
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="rounded-lg px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-60 bg-[#C084FC] hover:bg-[#A855F7] text-[#080A12] shadow-[0_0_20px_rgba(192,132,252,0.4)]"
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
              color="gold"
              title="Scheduling & Safe Transit Barrier"
              stat={`Prime-slot female share: ${k.primeSlotAvg}% (target ≥ 50%). Girls pushed to 20:30–22:00 slots.`}
              source="Eurobarometer 574 (2026): 40% of women cite lack of time / incompatible scheduling as the #1 barrier. Late slots raise safety concerns and reduce parental consent for younger girls."
              fix="Mandate 50/50 rotation of 18:00–20:00 prime hours between boys' and girls' squads."
              evidence="Evidence: Special Eurobarometer 574 — Sport & Physical Activity (2026)"
            />
            <RootCauseCard
              icon="🏅"
              color="violet"
              title="Coaching Mentorship & Socioeconomic Gap"
              stat={`Female coaches: ${k.femaleCoachAvg}%. Fee subsidy for girls: ${k.feeSubsidyAvg}%.`}
              source="Eurostat (hlth_ehis_pe3i): 18pp sport-participation gap between top and bottom income quintiles. 63% of dropped-out girls lack a female coach or role model (PMC12330288)."
              fix="Fast-track senior Uni 19+ female players into paid assistant coaching badges. Ring-fence 40% of equipment/travel grants for U14–U18 girls."
              evidence="Evidence: Eurostat hlth_ehis_pe3i · hlth_ehis_pe2e"
            />
          </div>
        </section>
      </div>

      {/* ── EU & BiH Evidence Modal (Includes Law 03 and Law 05 compliance disclosures) ── */}
      <Modal open={showEvidence} onClose={() => setShowEvidence(false)} title="Evidence Base & Verified Methodology" wide>
        <div className="space-y-5">
          {/* Methodological Note Callout */}
          <div
            className="rounded-lg p-3.5 text-xs"
            style={{
              background: "rgba(192,132,252,0.08)",
              border: "1px solid rgba(192,132,252,0.35)",
              color: "#F8FAFC",
            }}
          >
            <div className="flex items-center gap-2 mb-1.5 font-bold text-sm" style={{ color: VIOLET }}>
              <span>🇧🇦</span>
              <span>Methodological Note — Host Country (Bosnia &amp; Herzegovina):</span>
            </div>
            <p className="leading-relaxed text-[#F8FAFC]">
              {METHODOLOGICAL_NOTE}
            </p>
          </div>

          {/* Law 03 and Law 05 Clean Architectural Disclosures */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="rounded-lg p-3 bg-[#080A12] border border-[#262D4D] text-xs">
              <span className="font-bold text-[#34D399] block mb-1">LAW 03 ZERO-PII ARCHITECTURE:</span>
              <p className="text-[11px] text-[#CBD5E1]">
                Zero player PII ingested. Cohort aggregations (U12–Uni19+) and anonymized schedule telemetry guarantee strict GDPR and competition privacy.
              </p>
            </div>
            <div className="rounded-lg p-3 bg-[#080A12] border border-[#262D4D] text-xs">
              <span className="font-bold text-[#C084FC] block mb-1">LAW 05 AI-ASSISTED ENGINEERING:</span>
              <p className="text-[11px] text-[#CBD5E1]">
                Engineered for Erasmus+ Track 04 with Google Gemini AI policy generation and deterministic telemetry fallbacks.
              </p>
            </div>
          </div>

          <p className="text-xs text-[#CBD5E1]">
            All benchmarks below are clickable, peer-reviewed European and host-country research sources. Every KPI on this dashboard is anchored in these verified findings:
          </p>
          {BENCHMARK_EVIDENCE_REGISTRY.map((e) => (
            <div
              key={e.id}
              className="rounded-lg p-4 bg-[#080A12] border border-[#262D4D]"
            >
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#64748B]">{e.country}</span>
                  <h4 className="font-bold text-[#F8FAFC] text-sm">{e.title}</h4>
                </div>
                <Badge color="violet">{e.stat}</Badge>
              </div>
              <p className="text-xs text-[#CBD5E1]">{e.finding}</p>
              <a
                href={e.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs underline underline-offset-2 transition-opacity hover:opacity-80"
                style={{ color: VIOLET }}
              >
                {e.url}
              </a>
            </div>
          ))}
          <div className="rounded-lg p-3 text-xs bg-[#FBBF24]/10 border border-[#FBBF24]/30 text-[#F8FAFC]">
            <span className="font-bold" style={{ color: GOLD }}>Calculation Formulae:</span>{" "}
            Female Active Share = active at season end ÷ registered at season start (per gender/cohort). Dropout Cliff = (U14 active girls − U18 active girls) ÷ U14 registered girls. What-If elasticities are modeled on Eurobarometer 574 (time barrier: 40%), PMC12330288 (period: 78%), and ICOACHKIDS+ (coach gap: 63%).
          </div>
        </div>
      </Modal>

      {/* ── 90-Day Plan Modal ── */}
      <Modal open={showAiPlan} onClose={() => setShowAiPlan(false)} title={plan.title} wide>
        {loading ? (
          <div className="flex items-center gap-3 py-10 text-sm text-[#CBD5E1]">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: `${VIOLET} transparent ${VIOLET} ${VIOLET}` }} />
            Gemini AI is reading your figures…
          </div>
        ) : (
          <>
            <p className="mb-5 text-xs text-[#CBD5E1]">
              {planSource === "gemini"
                ? "✨ Generated by Google Gemini (gemini-2.5-flash) using only the verified telemetry figures and root causes shown on this dashboard."
                : "⚡ Deterministic rule-based engine (<10ms offline fallback) — showing instant evidence-based action plan from your telemetry."}
            </p>
            <div className="space-y-4">
              {plan.cards.map((c) => (
                <div
                  key={c.title}
                  className="rounded-lg p-4 bg-[#080A12] border border-[#262D4D]"
                >
                  <h4 className="mb-3 font-bold" style={{ color: VIOLET }}>{c.title}</h4>
                  <ul className="list-disc space-y-1.5 pl-5 text-sm text-[#F8FAFC]">
                    {c.actions.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {c.kpis.map((x) => (
                      <span
                        key={x.metric}
                        className="kpi rounded-full px-2.5 py-0.5 text-xs bg-[#C084FC]/15 border border-[#C084FC]/35 text-[#C084FC]"
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
