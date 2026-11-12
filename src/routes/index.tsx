import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend } from "recharts";
import { analyzeClubData, type Plan } from "@/lib/analyze-club-data.functions";
import { computeKpis, simulate, interventionPlan, viewOptions, type ClubId } from "@/data/sportsData";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SHE COUNTS: Women in Sport — Analytics Dashboard" },
      { name: "description", content: "Participation, retention and prime-hour equity analytics for grassroots clubs in Sarajevo." },
      { property: "og:title", content: "SHE COUNTS: Women in Sport" },
      { property: "og:description", content: "Analytics for Participation & Inclusion (Challenge 04)." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const CY = "var(--primary)", CO = "var(--accent)";
const tip = { contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)" } };

function Card({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-border bg-card p-5 ${className}`}><h2 className="label-caps mb-3">{title}</h2>{children}</section>;
}

function Donut({ data, center }: { data: { v: number; c: string }[]; center: ReactNode }) {
  return (
    <div className="relative h-48">
      <ResponsiveContainer><PieChart><Pie data={data} dataKey="v" innerRadius="68%" outerRadius="90%" stroke="none" startAngle={90} endAngle={-270}>{data.map((d, i) => <Cell key={i} fill={d.c} />)}</Pie></PieChart></ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>
    </div>
  );
}

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4"><h3 className="text-lg font-bold">{title}</h3><button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">✕</button></div>
        {children}
      </div>
    </div>
  );
}

function Dashboard() {
  const [view, setView] = useState<ClubId>("all");
  const [s1, setS1] = useState(0), [s2, setS2] = useState(0), [s3, setS3] = useState(0);
  const [method, setMethod] = useState(false), [ai, setAi] = useState(false);
  const k = useMemo(() => computeKpis(view), [view]);
  const sim = simulate(k, s1, s2, s3);
  const label = viewOptions.find((v) => v.id === view)!.label;
  const fallback = interventionPlan(k, label);
  const [aiPlan, setAiPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"gemini" | "fallback">("fallback");
  const plan = aiPlan ?? fallback;
  async function runAnalysis() {
    setAi(true); setLoading(true); setAiPlan(null);
    try {
      const r = await analyzeClubData({ data: {
        club: label, femaleParticipationPct: k.femaleShare, teenDropoutRiskPct: k.dropoutRisk,
        primeHourRatio: k.primeRatio, femaleCoachPct: k.coachShare,
        cohortRetention: k.ages.map((a) => ({ age: a.age, femalePct: a.female, malePct: a.male, gapPt: a.gap, girlsActive: a.fa, girlsRegistered: a.fr })),
        optimizer: { primeShiftPct: s1, coachIncreasePct: s2, parityPct: s3 },
      } });
      if (r.ok) { setAiPlan(r.plan); setSource("gemini"); } else { setSource("fallback"); console.warn("Gemini fallback:", r.error); }
    } catch (e) { setSource("fallback"); console.warn("Gemini fallback:", e); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <div className="mx-auto max-w-[1600px] space-y-5 p-4 md:p-6">
        <header className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-border bg-card p-5">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">SHE COUNTS: <span className="text-primary">Women in Sport</span></h1>
            <p className="italic text-muted-foreground">Analytics for Participation &amp; Inclusion (Challenge 04)</p>
            <label className="flex items-center gap-2 text-sm"><span className="label-caps">Select Club / Municipality</span>
              <select value={view} onChange={(e) => setView(e.target.value as ClubId)} className="rounded-md border border-border bg-background px-3 py-1.5 text-sm">
                {viewOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="kpi rounded-full border border-primary/40 px-3 py-1 text-xs text-primary">SARAJEVO HACKATHON 2026 • POWERED BY LOVABLE</span>
            <button onClick={() => setMethod(true)} className="rounded-md border border-border bg-secondary px-4 py-2 text-sm hover:border-primary">ⓘ Methodology &amp; Formulas</button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-3">
            <Card title="Weekly Pitch & Participation Share">
              <Donut data={[{ v: k.femaleShare, c: CY }, { v: k.maleShare, c: CO }]} center={<><span className="kpi text-2xl font-semibold text-primary">{k.femaleShare}% F</span><span className="kpi text-sm text-accent">{k.maleShare}% M</span></>} />
              <div className="flex items-center justify-between"><span className="kpi rounded-full border border-border px-2 py-0.5 text-xs">Target: 50/50</span><span className="text-xs italic text-muted-foreground">Prime-time slots (18:00–21:00) allocation</span></div>
            </Card>
            <Card title="Teen Retention Gap">
              <Donut data={[{ v: k.dropoutRisk, c: CO }, { v: 100 - k.dropoutRisk, c: "var(--muted)" }]} center={<><span className="kpi text-3xl font-semibold text-accent">{k.dropoutRisk}%</span><span className="text-xs text-muted-foreground">Active Dropout Risk</span></>} />
              <span className="inline-block rounded-md border border-warning/50 bg-warning/10 px-2 py-1 text-xs text-warning">⚠️ Hazard cohort: Ages 16–18</span>
            </Card>
          </div>

          <div className="space-y-5 lg:col-span-6">
            <Card title="Active Retention Curve">
              <div className="h-64"><ResponsiveContainer><AreaChart data={k.ages}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="age" stroke="var(--muted-foreground)" fontSize={12} /><YAxis unit="%" domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip {...tip} /><Legend />
                <Area type="linear" dataKey="female" name="Female Active (%)" stroke={CY} fill={CY} fillOpacity={0.12} strokeWidth={2.5} dot />
                <Area type="linear" dataKey="male" name="Male Active (%)" stroke={CO} fill={CO} fillOpacity={0.08} strokeWidth={2.5} dot />
              </AreaChart></ResponsiveContainer></div>
            </Card>
            <Card title="Age Cohort Comparison">
              <table className="kpi w-full border-collapse text-sm">
                <thead><tr className="text-left text-muted-foreground"><th className="border border-border p-2">Cohort</th><th className="border border-border p-2">Female Active</th><th className="border border-border p-2">Male Active</th><th className="border border-border p-2">Gap</th><th className="border border-border p-2">Girls (active/reg.)</th></tr></thead>
                <tbody>{k.ages.map((a) => (
                  <tr key={a.age}><td className="border border-border p-2">{a.age}</td><td className="border border-border p-2 text-primary">{a.female}%</td><td className="border border-border p-2 text-accent">{a.male}%</td><td className="border border-border p-2">{a.gap > 0 ? "−" : ""}{a.gap} pt</td><td className="border border-border p-2 text-muted-foreground">{a.fa}/{a.fr}</td></tr>
                ))}</tbody>
              </table>
            </Card>
          </div>

          <div className="space-y-5 lg:col-span-3">
            <Card title="Weekly Prime-Hour Allocation">
              <div className="h-44"><ResponsiveContainer><BarChart data={k.days}>
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} /><YAxis stroke="var(--muted-foreground)" fontSize={11} width={24} /><Tooltip {...tip} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="female" name="Female hrs" fill={CY} radius={[3, 3, 0, 0]} /><Bar dataKey="male" name="Male hrs" fill={CO} radius={[3, 3, 0, 0]} />
              </BarChart></ResponsiveContainer></div>
              <p className="kpi mt-2 text-4xl font-bold text-accent">{k.primeRatio}x</p>
              <p className="text-xs italic text-muted-foreground">Prime-hour slots skew {k.primeRatio > 1 ? "heavily male" : "evenly"} (Mon–Fri 18:00–21:00) · {k.primeM}h vs {k.primeF}h</p>
            </Card>
            <Card title='Decision Optimizer ("What If?")'>
              {([["Shift Prime-Time Slots to Girls %", s1, setS1], ["Increase Female Coaching Staff %", s2, setS2], ["Parity in Equipment/Travel %", s3, setS3]] as const).map(([l, v, set]) => (
                <label key={l} className="mb-3 block text-xs"><div className="flex justify-between text-muted-foreground"><span>{l}</span><span className="kpi text-foreground">{v}%</span></div>
                  <input type="range" min={0} max={100} value={v} onChange={(e) => set(+e.target.value)} className="w-full" /></label>
              ))}
              <div className="rounded-md border border-warning/50 bg-warning/10 p-3 text-xs text-warning">⚠️ Optimized Projection: Drop-out hazard reduces to <b className="kpi">{sim.projected}%</b> (Potential impact: <b className="kpi">+{sim.retained}</b> players retained annually — Hypothetical scenario)</div>
              {s2 > 35 && <div className="mt-3 rounded-md border border-primary/60 bg-primary/10 p-3 text-xs text-primary"><b>★ Injury-to-Coach Retention Pathway</b><p className="mt-1 text-foreground">Transition injured U16–U18 female players into certified youth assistant coaches. Projected impact: <b className="kpi text-primary">+19%</b> U10–U14 girl retention (hypothetical).</p></div>}
            </Card>
          </div>
        </div>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">THE MISSING PLAYERS <span className="font-normal text-muted-foreground">— From Data to Action</span></h2>
            <button onClick={runAnalysis} disabled={loading} className="rounded-md bg-primary disabled:opacity-60 px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">{loading ? "Analysing…" : "✨ Analyse My Data (Gemini AI)"}</button>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <Card title="Worst Age Dropout"><p className="kpi text-3xl text-accent">{k.worstAge.gap} pt gap</p><p className="mt-1 text-sm text-muted-foreground">{k.worstAge.age}: {k.worstAge.fa}/{k.worstAge.fr} girls active ({k.worstAge.female}%) vs {k.worstAge.ma}/{k.worstAge.mr} boys ({k.worstAge.male}%).</p></Card>
            <Card title="Sport Representation"><p className="kpi text-3xl text-accent">{k.sportRep.share}% female</p><p className="mt-1 text-sm text-muted-foreground">{k.sportRep.club} ({k.sportRep.sport}): {k.sportRep.female}/{k.sportRep.total} registered players are girls.</p></Card>
            <Card title="Coaching Gap"><p className="kpi text-3xl text-accent">{k.coachShare}% female</p><p className="mt-1 text-sm text-muted-foreground">{k.femaleCoaches}/{k.totalCoaches} licensed coaches are women.</p></Card>
          </div>
        </section>

        <footer className="flex flex-wrap justify-between gap-3 border-t border-border pt-4 text-xs">
          <span className="rounded-full border border-border bg-card px-4 py-2"><b className="text-primary">LAW 03 COMPLIANT:</b> Built on synthetic &amp; anonymized club datasets (Zero PII)</span>
          <span className="rounded-full border border-border bg-card px-4 py-2"><b className="text-primary">LAW 05 COMPLIANT:</b> AI-assisted development (Lovable, Gemini, Claude)</span>
        </footer>
      </div>

      <Modal open={method} onClose={() => setMethod(false)} title="Data Transparency & Methodology">
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li><b className="text-foreground">Participation share</b> = female weekly hours (all + prime slots) ÷ total weekly hours.</li>
          <li><b className="text-foreground">Active retention %</b> = active at season end ÷ registered at season start, per age group and gender.</li>
          <li><b className="text-foreground">Active Dropout Risk</b> = (U14 active girls − U18 active girls) ÷ U14 registered girls.</li>
          <li><b className="text-foreground">Prime-hour ratio</b> = male Mon–Fri 18:00–21:00 hours ÷ female hours.</li>
          <li><b className="text-foreground">Coaching share</b> = female licensed coaches ÷ all licensed coaches.</li>
          <li><b className="text-foreground">What-If simulator</b>: hazard × (1−0.0035·slots%)(1−0.0025·coaches%)(1−0.002·parity%); retained = hazard reduction × U14 girls registered. Elasticities are illustrative assumptions.</li>
          <li className="rounded-md border border-warning/50 bg-warning/10 p-3 text-warning">Caveat: all datasets are synthetic and anonymized for the hackathon. Figures illustrate the method and do not describe real clubs or people.</li>
        </ul>
      </Modal>
      <Modal open={ai} onClose={() => setAi(false)} title={plan.title}>
        {loading ? (
          <div className="flex items-center gap-3 py-10 text-sm text-muted-foreground"><span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />Gemini is reading your club's figures…</div>
        ) : (<>
          <p className="mb-4 text-xs text-muted-foreground">{source === "gemini" ? "Generated by Gemini 2.5 Flash using only the figures shown on this dashboard." : "Gemini unavailable — showing the instant rule-based plan from your data."}</p>
          <div className="space-y-4">{plan.cards.map((c) => (
            <div key={c.title} className="rounded-lg border border-border p-4"><h4 className="mb-2 font-semibold text-primary">{c.title}</h4>
              <ul className="list-disc space-y-1 pl-5 text-sm">{c.actions.map((a) => <li key={a}>{a}</li>)}</ul>
              <div className="mt-3 flex flex-wrap gap-2">{c.kpis.map((x) => <span key={x.metric} className="kpi rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs"><b className="text-primary">{x.metric}:</b> {x.target}</span>)}</div>
            </div>
          ))}</div>
        </>)}
      </Modal>
    </div>
  );
}
