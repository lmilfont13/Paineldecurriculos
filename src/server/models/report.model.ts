import type { AppStatus } from "@prisma/client";

export type CriterionMet = "sim" | "parcial" | "não";

export type ReportCandidate = {
  id: string;
  name: string;
  status: AppStatus;
  aiScore: number | null;
  /** Leitura da IA sobre o candidato, como a triagem gravou (não é reescrita). */
  aiReasoning: string | null;
  /** Checklist por critério da vaga, como a triagem gravou (com a evidência de cada um). */
  criteria: { criterion: string; met: CriterionMet; evidence?: string }[];
  aiProfile: string | null;
  aiArea: string | null;
  aiLevel: string | null;
  salaryExpectation: string | null;
  availability: string | null;
  city: string | null;
  neighborhood: string | null;
  createdAt: Date;
};

export type ScoreStats = {
  n: number;
  mean: number;
  median: number;
  /** Desvio-padrão amostral (n−1); 0 com um candidato só. */
  stdDev: number;
  q1: number;
  q3: number;
  min: number;
  max: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Quantil por interpolação linear (mesmo método de QUARTIL.INC do Excel). */
function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function scoreStats(scores: number[]): ScoreStats | null {
  if (scores.length === 0) return null;
  const sorted = [...scores].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1 ? sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
  return {
    n,
    mean,
    median: quantile(sorted, 0.5),
    stdDev: Math.sqrt(variance),
    q1: quantile(sorted, 0.25),
    q3: quantile(sorted, 0.75),
    min: sorted[0],
    max: sorted[n - 1],
  };
}

/** Posição relativa no grupo (0–100): quem está abaixo + metade dos empatados. */
export function percentileRank(scores: number[], value: number): number {
  if (scores.length === 0) return 0;
  const below = scores.filter((s) => s < value).length;
  const equal = scores.filter((s) => s === value).length;
  return ((below + 0.5 * equal) / scores.length) * 100;
}

const MET_WEIGHT: Record<CriterionMet, number> = { sim: 1, parcial: 0.5, não: 0 };

/** Quanto dos critérios da vaga o candidato cobre (0–100); null sem critérios avaliados. */
export function criteriaCoverage(criteria: { met: CriterionMet }[]): number | null {
  if (criteria.length === 0) return null;
  const sum = criteria.reduce((acc, c) => acc + MET_WEIGHT[c.met], 0);
  return (sum / criteria.length) * 100;
}

/** Pesos do índice de decisão, mostrados no relatório para a conta ser conferível. */
export const INDEX_WEIGHTS = { score: 0.6, coverage: 0.4 } as const;

/** Índice de decisão (0–100): 60% nota da triagem + 40% cobertura dos critérios. */
export function decisionIndex(score: number | null, coverage: number | null): number | null {
  if (score === null) return null;
  if (coverage === null) return score;
  return round2(INDEX_WEIGHTS.score * score + INDEX_WEIGHTS.coverage * coverage);
}

const BANDS = [
  { label: "0–19", from: 0, to: 19 },
  { label: "20–39", from: 20, to: 39 },
  { label: "40–59", from: 40, to: 59 },
  { label: "60–79", from: 60, to: 79 },
  { label: "80–100", from: 80, to: 100 },
] as const;

export function scoreBands(scores: number[]): { label: string; from: number; to: number; count: number }[] {
  return BANDS.map((b) => ({
    ...b,
    count: scores.filter((s) => s >= b.from && s <= b.to).length,
  }));
}

export type RankedCandidate = ReportCandidate & {
  position: number;
  coverage: number | null;
  index: number;
  percentile: number;
  /** Nota menos o corte da vaga (negativo = abaixo do mínimo). */
  gapToCutoff: number;
};

export type ReportData = {
  generatedAt: Date;
  job: { title: string; code: string | null; aiMinScore: number; criteria: string[] };
  totals: {
    total: number;
    /** Sem os reprovados. */
    active: number;
    /** Ativos com nota da triagem. */
    analyzed: number;
    meetsMinimum: number;
    meetsPct: number;
  };
  stage: { status: AppStatus; count: number }[];
  stats: ScoreStats | null;
  bands: ReturnType<typeof scoreBands>;
  ranking: RankedCandidate[];
  /** Ativos ainda sem nota: aparecem nas fichas, depois do ranking, e ficam fora dos cálculos. */
  unranked: ReportCandidate[];
  /** Diferença de índice entre o 1º e o 2º colocado. */
  margin: number | null;
  /** Espera média, em dias, de quem está em triagem. */
  avgWaitDays: number | null;
};

const STAGES: AppStatus[] = ["PENDING", "INTERVIEW", "APPROVED", "REJECTED"];
const DAY = 86_400_000;

export function buildReportData(
  job: ReportData["job"],
  candidates: ReportCandidate[],
  now: Date
): ReportData {
  const active = candidates.filter((c) => c.status !== "REJECTED");
  const analyzed = active.filter((c) => c.aiScore !== null);
  const scores = analyzed.map((c) => c.aiScore as number);
  const meets = analyzed.filter((c) => (c.aiScore as number) >= job.aiMinScore).length;

  const ranking: RankedCandidate[] = analyzed
    .map((c) => {
      const coverage = criteriaCoverage(c.criteria);
      return {
        ...c,
        coverage,
        index: decisionIndex(c.aiScore, coverage) as number,
        percentile: percentileRank(scores, c.aiScore as number),
        gapToCutoff: (c.aiScore as number) - job.aiMinScore,
        position: 0,
      };
    })
    .sort((a, b) => {
      const meetsA = (a.aiScore as number) >= job.aiMinScore ? 1 : 0;
      const meetsB = (b.aiScore as number) >= job.aiMinScore ? 1 : 0;
      // quem atende o corte vem antes de quem não atende; dentro de cada grupo, o índice
      return meetsB - meetsA || b.index - a.index || (b.aiScore as number) - (a.aiScore as number);
    })
    .map((c, i) => ({ ...c, position: i + 1 }));

  const waiting = candidates.filter((c) => c.status === "PENDING");
  const avgWaitDays = waiting.length
    ? waiting.reduce((acc, c) => acc + (now.getTime() - c.createdAt.getTime()) / DAY, 0) / waiting.length
    : null;

  return {
    generatedAt: now,
    job,
    totals: {
      total: candidates.length,
      active: active.length,
      analyzed: analyzed.length,
      meetsMinimum: meets,
      meetsPct: analyzed.length ? (meets / analyzed.length) * 100 : 0,
    },
    stage: STAGES.map((status) => ({ status, count: candidates.filter((c) => c.status === status).length })),
    stats: scoreStats(scores),
    bands: scoreBands(scores),
    ranking,
    unranked: active.filter((c) => c.aiScore === null),
    margin: ranking.length >= 2 ? round2(ranking[0].index - ranking[1].index) : null,
    avgWaitDays,
  };
}

const fmt = (n: number, digits = 1) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: digits });

/** Leitura em linguagem de gestor, calculada só dos números (nada que a IA invente). */
export function executiveSummary(data: ReportData): { headline: string; bullets: string[] } {
  const [leader, second] = data.ranking;
  if (!leader) {
    return { headline: "Ainda não há candidatos analisados para comparar.", bullets: [] };
  }

  const bullets: string[] = [];
  if (second && data.margin !== null) {
    if (data.margin < 3) {
      bullets.push(
        `Disputa acirrada: ${fmt(data.margin)} ponto(s) separam ${leader.name} de ${second.name}. Recomendamos entrevistar os dois antes de decidir.`
      );
    } else if (data.margin < 10) {
      bullets.push(`Vantagem moderada de ${fmt(data.margin)} pontos sobre ${second.name}.`);
    } else {
      bullets.push(`Vantagem clara de ${fmt(data.margin)} pontos sobre ${second.name}.`);
    }
  }
  bullets.push(
    `${data.totals.meetsMinimum} de ${data.totals.analyzed} candidatos analisados (${fmt(data.totals.meetsPct, 0)}%) atendem o mínimo de ${data.job.aiMinScore} pontos.`
  );
  bullets.push(`${leader.name} supera ${fmt(leader.percentile, 0)}% do grupo na nota da triagem.`);
  if (data.totals.active > data.totals.analyzed) {
    const missing = data.totals.active - data.totals.analyzed;
    bullets.push(`${missing} candidato(s) ainda sem análise ficaram fora do ranking.`);
  }
  return {
    headline: `${leader.name} é a melhor opção no momento, com índice de decisão ${fmt(leader.index)}.`,
    bullets,
  };
}

export type CriterionSummary = {
  criterion: string;
  sim: number;
  parcial: number;
  nao: number;
  /** Candidatos ranqueados com este critério avaliado. */
  total: number;
  /** % que atende totalmente. */
  pctSim: number;
  /** Menos de 1/3 do grupo atende: exigência escassa no mercado desta vaga. */
  scarce: boolean;
};

/** Para cada critério da vaga, como o grupo ranqueado se distribui (atende / em parte / não). */
export function criteriaSummary(data: ReportData): CriterionSummary[] {
  return data.job.criteria.map((criterion) => {
    const mets = data.ranking
      .map((c) => c.criteria.find((k) => k.criterion === criterion)?.met)
      .filter((m): m is CriterionMet => m !== undefined);
    const sim = mets.filter((m) => m === "sim").length;
    const parcial = mets.filter((m) => m === "parcial").length;
    const nao = mets.filter((m) => m === "não").length;
    const total = mets.length;
    const pctSim = total ? (sim / total) * 100 : 0;
    return { criterion, sim, parcial, nao, total, pctSim, scarce: total > 0 && pctSim < 100 / 3 };
  });
}
