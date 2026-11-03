/**
 * Teste de modelo de IA: o mesmo currículo avaliado pelo modelo atual e pelo
 * modelo em teste, lado a lado. Regras puras do veredito (sem I/O).
 *
 * O que importa para a triagem não é a nota idêntica, e sim a MESMA DECISÃO:
 * os dois modelos concordam se a pessoa atende ou não a nota mínima da vaga?
 * A nota de uma IA varia uns pontos até repetindo o mesmo modelo, por isso há
 * folga na diferença média.
 */

export type TrialScore = { score: number; reasoning: string } | { error: string };

export type TrialRow = {
  applicationId: string;
  name: string;
  jobTitle: string;
  minScore: number;
  reference: TrialScore;
  candidate: TrialScore;
};

export type TrialVerdict = "SUFFICIENT" | "REVIEW" | "INSUFFICIENT" | "INCONCLUSIVE";

export type TrialSummary = {
  /** Candidatos em que os dois modelos responderam. */
  compared: number;
  /** Em quantos os dois tomam a mesma decisão (atende / não atende o mínimo). */
  sameDecision: number;
  /**
   * Decisões diferentes com as duas notas coladas na nota mínima: variação
   * normal de IA na linha de corte, não erro. Destacadas, mas não pesam contra.
   */
  borderline: number;
  /** Diferença média de nota, em pontos. */
  meanAbsDiff: number | null;
  /** Falhas do modelo em teste (resposta inválida, erro). */
  candidateErrors: number;
  /** Casos que merecem olhar: decisão diferente ou diferença grande. */
  flagged: string[];
  verdict: TrialVerdict;
};

/** Diferença a partir da qual a nota é considerada bem diferente. */
export const BIG_DIFF = 20;
/** Distância da nota mínima (pontos) em que uma divergência é "linha de corte". */
export const NEAR_CUTOFF = 8;
/** Mínimo de comparações para o veredito valer. */
export const MIN_COMPARED = 5;

const hasScore = (s: TrialScore): s is { score: number; reasoning: string } => "score" in s;

export function summarizeTrial(rows: TrialRow[]): TrialSummary {
  let compared = 0;
  let sameDecision = 0;
  let borderline = 0;
  let diffSum = 0;
  let candidateErrors = 0;
  const flagged: string[] = [];

  for (const row of rows) {
    if (!hasScore(row.candidate)) {
      candidateErrors += 1;
      continue;
    }
    if (!hasScore(row.reference)) continue;
    compared += 1;
    const diff = Math.abs(row.candidate.score - row.reference.score);
    diffSum += diff;
    const same = row.candidate.score >= row.minScore === row.reference.score >= row.minScore;
    if (same) sameDecision += 1;
    else if (
      Math.abs(row.candidate.score - row.minScore) <= NEAR_CUTOFF &&
      Math.abs(row.reference.score - row.minScore) <= NEAR_CUTOFF
    ) {
      borderline += 1;
    }
    if (!same || diff >= BIG_DIFF) flagged.push(row.applicationId);
  }

  const meanAbsDiff = compared > 0 ? Math.round((diffSum / compared) * 10) / 10 : null;
  const agreement = compared > 0 ? (sameDecision + borderline) / compared : 0;
  const errorRate = rows.length > 0 ? candidateErrors / rows.length : 0;

  let verdict: TrialVerdict;
  if (compared < MIN_COMPARED) verdict = "INCONCLUSIVE";
  else if (agreement >= 0.9 && (meanAbsDiff ?? 99) <= 10 && errorRate <= 0.1) verdict = "SUFFICIENT";
  else if (agreement >= 0.75 && (meanAbsDiff ?? 99) <= 15 && errorRate <= 0.2) verdict = "REVIEW";
  else verdict = "INSUFFICIENT";

  return { compared, sameDecision, borderline, meanAbsDiff, candidateErrors, flagged, verdict };
}

export const verdictCopy: Record<TrialVerdict, { title: string; body: string }> = {
  SUFFICIENT: {
    title: "Dá conta",
    body: "Os dois modelos tomaram a mesma decisão em quase todos os candidatos, com notas próximas. Dá para trocar com segurança.",
  },
  REVIEW: {
    title: "Dá conta, com ressalvas",
    body: "Concordam na maioria, mas há casos diferentes. Olhe os candidatos destacados: se você concordar com o modelo em teste, pode trocar.",
  },
  INSUFFICIENT: {
    title: "Não recomendo trocar",
    body: "O modelo em teste discordou do atual em muitos candidatos. Para a triagem desta empresa, mantenha o modelo atual.",
  },
  INCONCLUSIVE: {
    title: "Poucos dados para concluir",
    body: `É preciso comparar pelo menos ${MIN_COMPARED} candidatos com currículo. Rode de novo quando houver mais candidaturas analisadas.`,
  },
};
