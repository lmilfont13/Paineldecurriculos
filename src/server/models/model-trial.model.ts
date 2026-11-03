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
  /** A vaga não tem nota mínima (ex.: banco de talentos): usamos DEFAULT_CUTOFF. */
  minIsDefault?: boolean;
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
/** Linha de corte usada quando a vaga não tem nota mínima (banco de talentos). */
export const DEFAULT_CUTOFF = 60;
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

/**
 * Veredito. Discordar do modelo atual NÃO quer dizer que o testado errou — o
 * atual também erra. Quando discordam, quem decide é o gestor, lendo as
 * justificativas dos dois nos casos destacados.
 */
export const verdictCopy: Record<TrialVerdict, { title: string; body: string }> = {
  SUFFICIENT: {
    title: "Os dois concordam",
    body: "Mesma decisão em quase todos os candidatos, com notas próximas. Dá para trocar sem mudar o resultado da triagem; escolha pelo custo ou pela clareza das justificativas.",
  },
  REVIEW: {
    title: "Concordam na maioria",
    body: "Há alguns casos diferentes. Leia as duas justificativas nos destacados: fique com o modelo que acertou mais segundo o que você sabe dos candidatos.",
  },
  INSUFFICIENT: {
    title: "Discordam em vários candidatos",
    body: "Isso não diz qual está certo: o modelo atual também pode errar. Leia as duas justificativas nos casos destacados e veja qual bate com o currículo. Se o testado acertar mais, troque; se não, mantenha o atual.",
  },
  INCONCLUSIVE: {
    title: "Poucos dados para concluir",
    body: `É preciso comparar pelo menos ${MIN_COMPARED} candidatos com currículo. Rode de novo quando houver mais candidaturas analisadas.`,
  },
};

/**
 * Erro técnico da IA → explicação e o que fazer, para o gestor (ou quem cuida
 * das chaves) resolver sem precisar ler log.
 */
export function explainAiError(message: string): { reason: string; action: string } {
  const m = message.toLowerCase();
  if (m.includes("não configurada")) {
    return { reason: "A chave deste provedor de IA não está configurada no site.", action: "Cadastre a chave na Vercel (Environment Variables) e publique de novo." };
  }
  if (m.includes("401") || m.includes("invalid x-api-key") || m.includes("authentication")) {
    return { reason: "A chave da IA foi recusada (inválida ou revogada).", action: "Gere uma chave nova no painel do provedor e atualize na Vercel." };
  }
  if (m.includes("credit") || m.includes("billing") || m.includes("balance") || m.includes("402")) {
    return { reason: "A conta da IA está sem crédito.", action: "Adicione crédito no painel do provedor (para a Anthropic: console.anthropic.com → Billing)." };
  }
  if (m.includes("invalid_request")) {
    return { reason: "A IA recusou o formato do pedido (incompatibilidade do sistema com este modelo).", action: "Mande o detalhe técnico abaixo para quem cuida do código." };
  }
  if (m.includes("404") || m.includes("not_found_error")) {
    return { reason: "Este modelo não está disponível para a conta de IA.", action: "Confira no painel do provedor se o modelo está liberado, ou teste outro modelo." };
  }
  if (m.includes("429") || m.includes("529") || m.includes("rate") || m.includes("overloaded")) {
    return { reason: "A IA está sobrecarregada ou no limite de uso.", action: "Espere alguns minutos e rode o teste de novo." };
  }
  if (m.includes("score inválido")) {
    return { reason: "O modelo respondeu fora do formato esperado.", action: "Se acontecer em vários candidatos, este modelo não serve para a triagem." };
  }
  return { reason: "A IA não respondeu.", action: "Tente de novo em alguns minutos." };
}
