/**
 * euBenchmarks.ts — Peer-Reviewed & Verified European / Host Country Benchmarks
 * 
 * Provides verified sports participation, retention hazard, and adolescent activity
 * data for Bosnia & Herzegovina (Host Country), EU27, Croatia, Serbia, and Slovenia.
 */

export const METHODOLOGICAL_NOTE =
  "Eurostat EHIS does not cover Bosnia & Herzegovina (BA); host-country baselines use peer-reviewed BiH adolescent research alongside Eurostat EU27, Croatia, Serbia, and Slovenia benchmarks.";

export interface BenchmarkEvidence {
  id: string;
  title: string;
  country: string;
  stat: string;
  finding: string;
  url: string;
  authors?: string;
  year: number;
}

export interface BihStudyStats {
  adolescentBaseline: {
    ageGroup: "15-19";
    label: "Adolescent Baseline (Ages 15–19)";
    femaleSufficient: number;
    maleSufficient: number;
    gapPt: number;
    femaleInsufficient: number;
    maleInsufficient: number;
    citation: string;
    url: string;
  };
  lateHighSchoolCliff: {
    ageGroup: "17-18";
    label: "Late High School Cliff (Ages 17–18)";
    femaleSufficient: number;
    maleSufficient: number;
    gapPt: number;
    femaleInsufficient: number;
    maleInsufficient: number;
    citation: string;
    url: string;
  };
  longitudinalDropOff: {
    baselineAge: "15-16";
    followUpAge: "17-18";
    label: "Longitudinal Cohort Drop-Off";
    femaleBaseline: number;
    femaleFollowUp: number;
    maleBaseline: number;
    maleFollowUp: number;
    citation: string;
    url: string;
  };
}

export const BIH_STATS: BihStudyStats = {
  adolescentBaseline: {
    ageGroup: "15-19",
    label: "Adolescent Baseline (Ages 15–19)",
    femaleSufficient: 44.0,
    maleSufficient: 56.0,
    gapPt: 12.0,
    femaleInsufficient: 56.0,
    maleInsufficient: 44.0,
    citation: "Sekulić et al., Children 2021",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8534587/",
  },
  lateHighSchoolCliff: {
    ageGroup: "17-18",
    label: "Late High School Cliff (Ages 17–18)",
    femaleSufficient: 27.0,
    maleSufficient: 41.0,
    gapPt: 14.0,
    femaleInsufficient: 73.0,
    maleInsufficient: 59.0,
    citation: "BiH Late Adolescence Study, 2021",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8620439/",
  },
  longitudinalDropOff: {
    baselineAge: "15-16",
    followUpAge: "17-18",
    label: "Longitudinal Cohort Drop-Off",
    femaleBaseline: 26.0,
    femaleFollowUp: 21.0,
    maleBaseline: 38.0,
    maleFollowUp: 31.0,
    citation: "Sekulić et al., Healthcare 2020",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7761556/",
  },
};

export const BENCHMARK_EVIDENCE_REGISTRY: BenchmarkEvidence[] = [
  {
    id: "bih-adolescent-baseline",
    country: "Bosnia & Herzegovina (Host Country)",
    title: "BiH Adolescent Physical Activity Baseline (PMC8534587)",
    stat: "44.0% F vs 56.0% M (12.0 pt gap)",
    finding:
      "In Bosnia & Herzegovina high schools, 44.0% of adolescent females meet sufficient physical activity standards compared to 56.0% of males (12.0 pt gap). 56.0% of adolescent girls suffer insufficient physical activity.",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8534587/",
    authors: "Sekulić et al., Children 2021",
    year: 2021,
  },
  {
    id: "bih-late-highschool-cliff",
    country: "Bosnia & Herzegovina (Host Country)",
    title: "BiH Late Adolescence Physical Activity Cliff (PMC8620439)",
    stat: "27.0% F vs 41.0% M (73% girls inactive)",
    finding:
      "By late high school (ages 17–18), female sufficient activity drops to 27.0% vs 41.0% for males (14.0 pt gap). 73.0% of high school senior girls in BiH are insufficiently active.",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8620439/",
    authors: "BiH Late Adolescence Study",
    year: 2021,
  },
  {
    id: "bih-longitudinal-cohort",
    country: "Bosnia & Herzegovina (Host Country)",
    title: "BiH Longitudinal School Cohort Drop-Off (PMC7761556)",
    stat: "26% → 21% F drop-off",
    finding:
      "Longitudinal tracking shows female sufficient activity declining from 26.0% at baseline (ages 15–16) down to 21.0% at follow-up (ages 17–18) vs 38.0% to 31.0% for males.",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7761556/",
    authors: "Sekulić et al., Healthcare 2020",
    year: 2020,
  },
  {
    id: "eurostat-pe3i",
    country: "European Union (EU27)",
    title: "Eurostat Health & Physical Activity (hlth_ehis_pe3i & pe2e)",
    stat: "−18 pp income gap",
    finding:
      "42% of EU women vs. 47% of EU men engage in regular leisure physical activity. An 18-percentage-point drop exists between the top income quintile (55%) and bottom quintile (37%).",
    url: "https://ec.europa.eu/eurostat/databrowser/view/hlth_ehis_pe3i/default/table",
    year: 2024,
  },
  {
    id: "eurobarometer-574",
    country: "European Union (EU27)",
    title: "Special Eurobarometer 574 — Sport & Physical Activity",
    stat: "40% cite time barriers",
    finding:
      "41% of women report never exercising or playing sport (vs. 36% of men). The #1 barrier across Europe is lack of time / incompatible scheduling (40%), compounded by financial strain.",
    url: "https://europa.eu/eurobarometer/",
    year: 2026,
  },
  {
    id: "icoachkids-dropout",
    country: "European Union (Erasmus+)",
    title: "Erasmus+ ICOACHKIDS+ European Youth Sport Dropout Study",
    stat: "52% dropout ages 14–18",
    finding:
      "52% of all youth sport dropouts occur between ages 14 and 18 — even though 70% of girls who drop out still consider themselves 'sporty'.",
    url: "https://icoachkids.org/the-hub/inclusion/understanding-youth-sport-dropout-what-it-is-and-why-it-matters",
    year: 2023,
  },
  {
    id: "pmc-puberty",
    country: "Global & EU Research",
    title: "Puberty, Menstruation & Coaching Barriers (PMC12330288 / UN Women)",
    stat: "78% period avoidance",
    finding:
      "78% of teenage girls avoid sport during their period. 71.7% have received zero menstrual education related to exercise. 68% fear body/leakage judgment (especially in light/white kits). 63% lack female coaches or role models.",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12330288/",
    year: 2024,
  },
];
