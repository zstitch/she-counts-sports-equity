# She Counts: Sports Equity

Build SHE COUNTS: Women in Sport, a dark-mode sports-telemetry Bento analytics dashboard for Challenge 04 (No Auth/Login).

### 1. Color & Typography System
- Background: #0B151E | Elevated Cards: #13222F with 1px solid #1E3346 borders and subtle rounded corners (rounded-xl).
- Accents: Electric Cyan (#2DD4BF) for Female/Target metrics, Warm Coral (#FB7185) for Male/Dropout Risk/Disparity, Amber (#F59E0B) for Optimizer warnings.
- Text: Crisp Off-White (#F8FAFC) headings, Muted Slate (#94A3B8) labels, tabular monospace numbers for KPIs.

### 2. Deterministic Relational Data Engine (src/data/sportsData.ts)
Create clean relational datasets (participation, cohort, coaching, primeHours) for 4 selectable views: All Grassroots Clubs, Sarajevo Youth FC — Football, Bosna Youth — Basketball, and Ilidža Club — Volleyball. Compute all KPIs deterministically in TypeScript (zero hardcoded chart strings). Include a header button opening a "Data Transparency & Methodology" modal explaining every formula and synthetic dataset caveat.

### 3. Top Command Header
- Left: Title "SHE COUNTS: Women in Sport", subtitle *"Analytics for Participation & Inclusion (Challenge 04)"*, and an interactive Select Club / Municipality dropdown updating every chart, table, and card.
- Right: Badge "SARAJEVO HACKATHON 2026 • POWERED BY LOVABLE" + "Methodology & Formulas" modal button.

### 4. 3-Column Bento Grid (12-column desktop layout)
- Left Column (3 cols — 2 Donut Cards):
  1. WEEKLY PITCH & PARTICIPATION SHARE: Recharts Donut (#2DD4BF vs #FB7185) showing Female/Male share inside the ring (e.g., 32% Female / 68% Male), Target: 50/50 pill, and subtitle *"Prime-time slots (18:00–21:00) allocation"*.
  2. TEEN RETENTION GAP: Warm Coral Recharts Donut displaying 27% Active Dropout Risk inside the ring and an Amber/Coral badge: ⚠️ Hazard cohort: Ages 16–18.
- Center Column (6 cols — Retention Curve & Matrix):
  1. ACTIVE RETENTION CURVE: Sharp Recharts dual-area/line chart comparing Female Active (%) (#2DD4BF) vs. Male Active (%) (#FB7185) across U10, U12, U14, U16, U18, Senior (pure telemetry lines, zero background silhouettes).
  2. AGE COHORT COMPARISON TABLE: Dark-bordered matrix directly below showing U10 | U12 | U14 | U16 | U18 | Senior rows for Female Active (%) (e.g., 88%, 74%, 52%, 34%, 29%, 25%) and Male Active (%) (92%, 89%, 85%, 82%, 78%, 74%).
- Right Column (3 cols — Allocation & Simulator):
  1. WEEKLY PRIME-HOUR ALLOCATION: Vertical Recharts bar chart comparing Cyan vs. Coral prime hours alongside a bold `1.55x` callout (*"Prime-hour slots skew heavily male (Mon–Fri 18:00–21:00)"*).
  2. DECISION OPTIMIZER ("What If?" Simulator): 3 interactive sliders (*Shift Prime-Time Slots to Girls %*, *Increase Female Coaching Staff %*, *Parity in Equipment/Travel %*) dynamically recalculating an Amber callout box: *"⚠️ Optimized Projection: Drop-out hazard reduces to X% (Potential impact: +Y players retained annually — Hypothetical scenario)"*.

### 5. Action Section & Compliance Footer
- Below the Bento grid, render "THE MISSING PLAYERS — From Data to Action": 3 rule-based cards surfacing the worst age-dropout, sport representation, and coaching gaps with exact denominators, paired with a "✨ Analyse My Data (Gemini AI)" button that opens a structured 90-day intervention plan (with instant deterministic fallback data).
- Bottom Footer Bar with two dark pills:
  - Left: LAW 03 COMPLIANT: Built on synthetic & anonymized club datasets (Zero PII)
  - Right: LAW 05 COMPLIANT: AI-assisted development (Lovable, Gemini, Claude)

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e0771f8c-7862-429e-bcdd-dc45459e4cac).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
