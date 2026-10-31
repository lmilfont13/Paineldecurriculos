import type { AppStatus, JobStatus } from "@prisma/client";

import {
  buildReportData,
  criteriaSummary,
  scoreStats,
  type CriterionSummary,
  type ReportCandidate,
  type ReportData,
} from "@/server/models/report.model";

export type PortfolioJob = {
  id: string;
  title: string;
  code: string | null;
  status: JobStatus;
  location: string | null;
  aiMinScore: number;
  criteria: string[];
  createdAt: Date;
};

/** Candidatura com o necessário para o relatório geral (o e-mail só identifica a pessoa; não vai ao PDF). */
export type PortfolioApplication = ReportCandidate & {
  jobId: string;
  email: string;
  hasCnh: string | null;
  workPreference: string | null;
};

export type Count = { label: string; count: number };

export type JobSummary = {
  job: PortfolioJob;
  report: ReportData;
  criteria: CriterionSummary[];
  total: number;
  /** Candidaturas dos últimos 7 dias. */
  last7: number;
};

export type Portfolio = {
  generatedAt: Date;
  totals: {
    jobs: { total: number; open: number; paused: number; draft: number; closed: number };
    applications: number;
    /** Pessoas distintas (pelo e-mail). */
    people: number;
    active: number;
    analyzed: number;
    meets: number;
    meetsPct: number;
    avgWaitDays: number | null;
    last7: number;
    previous7: number;
  };
  stage: { status: AppStatus; count: number }[];
  perJob: JobSummary[];
  timeline: { date: string; count: number }[];
  profile: {
    people: number;
    levels: Count[];
    areas: Count[];
    roles: Count[];
    places: Count[];
    availability: Count[];
    workPreference: Count[];
    cnh: { with: number; without: number };
    salary: {
      n: number;
      median: number | null;
      mean: number | null;
      bands: { label: string; count: number }[];
    };
  };
};

const DAY = 86_400_000;
const FORTALEZA_OFFSET_MS = 3 * 3_600_000; // UTC-3, sem horário de verão
const dayKey = (d: Date) => new Date(d.getTime() - FORTALEZA_OFFSET_MS).toISOString().slice(0, 10);

/** Pretensão salarial digitada como texto livre → número em reais (null se não houver valor plausível). */
export function parseSalary(text: string | null | undefined): number | null {
  if (!text) return null;
  const token = /\d[\d.,]*/.exec(text)?.[0];
  if (!token) return null;
  let t = token.replace(/[.,]+$/, "");
  const hasDot = t.includes(".");
  const hasComma = t.includes(",");
  if (hasDot && hasComma) t = t.replace(/\./g, "").replace(",", ".");
  else if (hasComma) t = t.replace(",", ".");
  else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const value = Number(t);
  return Number.isFinite(value) && value >= 300 && value <= 100_000 ? value : null;
}

export function salaryBands(values: number[]): { label: string; count: number }[] {
  const bands = [
    { label: "até 1.499", test: (v: number) => v < 1500 },
    { label: "1.500–1.999", test: (v: number) => v >= 1500 && v < 2000 },
    { label: "2.000–2.499", test: (v: number) => v >= 2000 && v < 2500 },
    { label: "2.500–2.999", test: (v: number) => v >= 2500 && v < 3000 },
    { label: "3.000 ou mais", test: (v: number) => v >= 3000 },
  ];
  return bands.map((b) => ({ label: b.label, count: values.filter(b.test).length }));
}

const LOWER_WORDS = new Set(["de", "da", "do", "das", "dos", "e"]);
const titleOf = (s: string) =>
  s
    .replace(/(^|[\s-])(\p{L}+)/gu, (_, sep: string, word: string) =>
      sep !== "" && LOWER_WORDS.has(word) ? sep + word : sep + word[0].toUpperCase() + word.slice(1)
    );

/** Conta valores iguais (sem ligar para caixa e espaço), ordena e junta o que passa do limite em "Outros". */
export function topCounts(values: (string | null | undefined)[], n: number): Count[] {
  const map = new Map<string, number>();
  for (const v of values) {
    const key = (v ?? "").trim().replace(/\s+/g, " ").toLowerCase();
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const head = sorted.slice(0, n).map(([label, count]) => ({ label: titleOf(label), count }));
  const rest = sorted.slice(n).reduce((acc, [, c]) => acc + c, 0);
  return rest > 0 ? [...head, { label: "Outros", count: rest }] : head;
}

const median = (values: number[]) => scoreStats(values)?.median ?? null;

export function buildPortfolio(
  jobs: PortfolioJob[],
  applications: PortfolioApplication[],
  now: Date
): Portfolio {
  const countJobs = (s: JobStatus) => jobs.filter((j) => j.status === s).length;

  // Pessoas distintas: a candidatura mais recente representa a pessoa no perfil.
  const byPerson = new Map<string, PortfolioApplication>();
  for (const a of applications) {
    const email = a.email.trim().toLowerCase();
    const key = email.includes("@") ? email : `id:${a.id}`;
    const current = byPerson.get(key);
    if (!current || a.createdAt.getTime() > current.createdAt.getTime()) byPerson.set(key, a);
  }
  const people = [...byPerson.values()];

  const live = jobs.filter((j) => j.status !== "CLOSED");
  const perJob: JobSummary[] = live.map((job) => {
    const ofJob = applications.filter((a) => a.jobId === job.id);
    const report = buildReportData(
      { title: job.title, code: job.code, aiMinScore: job.aiMinScore, criteria: job.criteria },
      ofJob,
      now
    );
    return {
      job,
      report,
      criteria: criteriaSummary(report),
      total: ofJob.length,
      last7: ofJob.filter((a) => now.getTime() - a.createdAt.getTime() < 7 * DAY).length,
    };
  });

  // Qualidade e etapas somam só as vagas em andamento (as encerradas ficam fora do resumo).
  const inLive = applications.filter((a) => live.some((j) => j.id === a.jobId));
  const active = inLive.filter((a) => a.status !== "REJECTED");
  const analyzed = perJob.reduce((acc, j) => acc + j.report.totals.analyzed, 0);
  const meets = perJob.reduce((acc, j) => acc + j.report.totals.meetsMinimum, 0);
  const waiting = inLive.filter((a) => a.status === "PENDING");

  const timeline = Array.from({ length: 30 }, (_, i) => ({
    date: dayKey(new Date(now.getTime() - (29 - i) * DAY)),
    count: 0,
  }));
  const index = new Map(timeline.map((d, i) => [d.date, i]));
  for (const a of applications) {
    const i = index.get(dayKey(a.createdAt));
    if (i !== undefined) timeline[i].count += 1;
  }

  const salaries = people.map((p) => parseSalary(p.salaryExpectation)).filter((v): v is number => v !== null);
  const sum = salaries.reduce((a, b) => a + b, 0);

  return {
    generatedAt: now,
    totals: {
      jobs: {
        total: jobs.length,
        open: countJobs("OPEN"),
        paused: countJobs("PAUSED"),
        draft: countJobs("DRAFT"),
        closed: countJobs("CLOSED"),
      },
      applications: applications.length,
      people: people.length,
      active: active.length,
      analyzed,
      meets,
      meetsPct: analyzed ? (meets / analyzed) * 100 : 0,
      avgWaitDays: waiting.length
        ? waiting.reduce((acc, a) => acc + (now.getTime() - a.createdAt.getTime()) / DAY, 0) / waiting.length
        : null,
      last7: applications.filter((a) => now.getTime() - a.createdAt.getTime() < 7 * DAY).length,
      previous7: applications.filter((a) => {
        const age = now.getTime() - a.createdAt.getTime();
        return age >= 7 * DAY && age < 14 * DAY;
      }).length,
    },
    stage: (["PENDING", "INTERVIEW", "APPROVED", "REJECTED"] as AppStatus[]).map((status) => ({
      status,
      count: inLive.filter((a) => a.status === status).length,
    })),
    perJob,
    timeline,
    profile: {
      people: people.length,
      levels: topCounts(people.map((p) => p.aiLevel), 6),
      areas: topCounts(people.map((p) => p.aiArea), 7),
      roles: topCounts(people.map((p) => p.aiProfile), 7),
      places: topCounts(people.map((p) => p.neighborhood || p.city), 8),
      availability: topCounts(people.map((p) => p.availability), 5),
      workPreference: topCounts(people.map((p) => p.workPreference), 4),
      cnh: {
        with: people.filter((p) => p.hasCnh && p.hasCnh !== "NONE").length,
        without: people.filter((p) => p.hasCnh === "NONE").length,
      },
      salary: {
        n: salaries.length,
        median: median(salaries),
        mean: salaries.length ? sum / salaries.length : null,
        bands: salaryBands(salaries),
      },
    },
  };
}

const fmt = (n: number, d = 0) => n.toLocaleString("pt-BR", { maximumFractionDigits: d });
const label = (j: PortfolioJob) => `${j.title}${j.code ? ` #${j.code}` : ""}`;

/** Observações em linguagem de gestor, calculadas só dos números (nada que a IA invente). */
export function portfolioInsights(p: Portfolio): string[] {
  if (p.totals.applications === 0) {
    return ["Ainda não há candidaturas para analisar. O relatório se completa conforme os candidatos chegam."];
  }
  const out: string[] = [];
  const jobs = p.perJob.filter((j) => j.total > 0);

  const biggest = [...jobs].sort((a, b) => b.total - a.total)[0];
  if (biggest) out.push(`${label(biggest.job)} é a vaga com mais candidatos (${biggest.total}).`);

  const withScore = jobs.filter((j) => j.report.totals.analyzed > 0);
  if (withScore.length >= 2) {
    const sorted = [...withScore].sort((a, b) => b.report.totals.meetsPct - a.report.totals.meetsPct);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (best.job.id !== worst.job.id) {
      out.push(
        `${label(best.job)} tem a maior aderência: ${fmt(best.report.totals.meetsPct)}% dos analisados atendem o corte. ` +
          `${label(worst.job)} tem a menor aderência: ${fmt(worst.report.totals.meetsPct)}%.`
      );
    }
  } else if (withScore.length === 1) {
    const j = withScore[0];
    out.push(`${fmt(j.report.totals.meetsPct)}% dos candidatos analisados de ${label(j.job)} atendem o corte.`);
  }

  const scarce = jobs
    .flatMap((j) => j.criteria.filter((c) => c.total > 0).map((c) => ({ job: j.job, c })))
    .sort((a, b) => a.c.pctSim - b.c.pctSim)[0];
  if (scarce && scarce.c.pctSim < 100 / 3) {
    out.push(
      `Critério mais escasso: "${scarce.c.criterion}" em ${label(scarce.job)}, atendido por ${fmt(scarce.c.pctSim)}% dos candidatos. ` +
        `Vale rever a exigência ou ampliar a busca.`
    );
  }

  if (p.totals.avgWaitDays !== null && p.totals.avgWaitDays >= 3) {
    out.push(`Quem está na triagem espera em média ${fmt(p.totals.avgWaitDays, 1)} dias por uma resposta.`);
  }
  if (p.totals.last7 > 0 || p.totals.previous7 > 0) {
    out.push(`Entraram ${p.totals.last7} candidatura(s) nos últimos 7 dias, contra ${p.totals.previous7} nos 7 anteriores.`);
  }

  const lvl = p.profile.levels[0];
  if (lvl && p.profile.people > 0) {
    out.push(`O perfil mais comum é o nível ${lvl.label} (${fmt((lvl.count / p.profile.people) * 100)}% dos candidatos).`);
  }
  const place = p.profile.places.find((x) => x.label !== "Outros");
  if (place) out.push(`A maior concentração é em ${place.label} (${place.count} candidato(s)).`);
  if (p.profile.salary.median !== null) {
    out.push(`A pretensão salarial mediana é R$ ${fmt(p.profile.salary.median)} (${p.profile.salary.n} candidatos informaram).`);
  }
  return out;
}
