import type { AIState, AppStatus } from "@prisma/client";

import type { AppStatusKey } from "@/server/models/application.model";

/** Linha da lista de candidatos (contrato entre a página e a tabela). */
export type CandidaturaRow = {
  id: string;
  name: string;
  email: string;
  createdAt: string; // ISO
  status: AppStatus;
  aiState: AIState;
  aiScore: number | null;
  resumeUrl: string | null;
  jobId: string;
  jobTitle: string;
  /** Código da vaga, para distinguir vagas com o mesmo cargo. */
  jobCode?: string | null;
  /** Índice de decisão da IA (nota + cobertura dos critérios), o mesmo do relatório da diretoria. */
  aiIndex?: number | null;
  /** Pré-entrevista: aguardando resposta do candidato ou já respondida. */
  infoState?: "WAITING" | "ANSWERED" | null;
  aiMinScore: number;
  /** Candidatura da sala de simulação (mostra o selo "Demonstração"). */
  isDemo?: boolean;
  preRegistered?: boolean;
  photoUrl?: string | null;
  /** Perfil profissional identificado pela IA (área, função, nível). */
  aiArea?: string | null;
  aiProfile?: string | null;
  aiLevel?: string | null;
  /** Idade, só para o gestor conferir (nunca entra na nota nem vai para a IA). */
  age?: number | null;
};

export type StageKey = AppStatusKey | "ALL";

export type SortKey = "WAITING" | "RECENT" | "SCORE" | "AI";

export type ListFilters = {
  search: string;
  jobId: string;
  onlyMeets: boolean;
  /** Somente candidatos com foto extraída do currículo. */
  onlyPhoto?: boolean;
  /** Ids que casaram com o termo no conteúdo do currículo (busca no servidor). */
  contentMatches?: ReadonlySet<string> | null;
};

/** Atende o mínimo definido na vaga? (null = sem análise, não atende) */
export function meetsMinimum(row: CandidaturaRow): boolean {
  return row.aiScore !== null && row.aiScore >= row.aiMinScore;
}

/**
 * Aplica tudo menos a etapa — é a base das contagens de cada aba, para o
 * número ao lado do rótulo ser honesto com os filtros ativos.
 */
export function applyFilters(
  rows: CandidaturaRow[],
  { search, jobId, onlyMeets, onlyPhoto, contentMatches }: ListFilters
): CandidaturaRow[] {
  const q = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (
      q &&
      !row.name.toLowerCase().includes(q) &&
      !row.email.toLowerCase().includes(q) &&
      !(row.aiProfile ?? "").toLowerCase().includes(q) &&
      !(row.aiArea ?? "").toLowerCase().includes(q) &&
      !contentMatches?.has(row.id)
    )
      return false;
    if (jobId && row.jobId !== jobId) return false;
    if (onlyMeets && !meetsMinimum(row)) return false;
    if (onlyPhoto && !row.photoUrl) return false;
    return true;
  });
}

export function countByStage(rows: CandidaturaRow[]): Record<StageKey, number> {
  const counts: Record<StageKey, number> = {
    PENDING: 0,
    SHORTLISTED: 0,
    INTERVIEW: 0,
    APPROVED: 0,
    REJECTED: 0,
    ALL: rows.length,
  };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

/** Sem análise vai para o fim na ordem por aderência, nunca para o topo. */
export function sortRows(
  rows: CandidaturaRow[],
  sort: SortKey
): CandidaturaRow[] {
  const time = (row: CandidaturaRow) => new Date(row.createdAt).getTime();
  return [...rows].sort((a, b) => {
    if (sort === "AI") {
      // Indicação da IA: quem atende o corte da vaga vem antes; depois o índice; sem nota por último.
      const rank = (r: CandidaturaRow) => (r.aiScore === null ? 0 : meetsMinimum(r) ? 2 : 1);
      return (
        rank(b) - rank(a) ||
        (b.aiIndex ?? b.aiScore ?? -1) - (a.aiIndex ?? a.aiScore ?? -1) ||
        (b.aiScore ?? -1) - (a.aiScore ?? -1)
      );
    }
    if (sort === "WAITING") return time(a) - time(b);
    if (sort === "RECENT") return time(b) - time(a);
    return (b.aiScore ?? -1) - (a.aiScore ?? -1);
  });
}

export function selectStage(
  rows: CandidaturaRow[],
  stage: StageKey
): CandidaturaRow[] {
  return stage === "ALL" ? rows : rows.filter((row) => row.status === stage);
}

/** "Promotor de Vendas #1123": o código separa vagas com o mesmo cargo. */
export function jobLabel(title: string, code: string | null | undefined): string {
  const c = code?.trim();
  return c ? `${title} #${c}` : title;
}

/** Junta as candidaturas de cada vaga (ordem das vagas pela 1ª aparição; ordem interna preservada). */
export function groupRowsByJob(rows: CandidaturaRow[]): CandidaturaRow[] {
  const groups = new Map<string, CandidaturaRow[]>();
  for (const row of rows) {
    const list = groups.get(row.jobId);
    if (list) list.push(row);
    else groups.set(row.jobId, [row]);
  }
  return [...groups.values()].flat();
}

/** Pré-entrevista na fila: pedida e sem resposta, ou já respondida (null se nunca pedida). */
export function infoRequestState(
  requestedAt: Date | null,
  answeredAt: Date | null
): "WAITING" | "ANSWERED" | null {
  if (!requestedAt) return null;
  return answeredAt ? "ANSWERED" : "WAITING";
}

/** Próximo da fila de triagem: quem espera resposta há mais tempo (null se a fila está limpa). */
export function nextToTriage(rows: CandidaturaRow[]): CandidaturaRow | null {
  return sortRows(selectStage(rows, "PENDING"), "WAITING")[0] ?? null;
}

/** Posição (1º, 2º...) de cada candidato com nota dentro da própria vaga, na ordem em que as linhas chegam. */
export function aiRankInGroups(rows: CandidaturaRow[]): Map<string, number> {
  const perJob = new Map<string, number>();
  const ranks = new Map<string, number>();
  for (const r of rows) {
    if (r.aiScore === null) continue;
    const next = (perJob.get(r.jobId) ?? 0) + 1;
    perJob.set(r.jobId, next);
    ranks.set(r.id, next);
  }
  return ranks;
}

export type CutoffSelection = "ALL" | "ABOVE" | "BELOW" | "UNANALYZED";

/**
 * Atalhos de seleção em massa. O corte é o da vaga de cada candidato; nota igual
 * ao corte atende. Quem não tem nota não entra em "acima" nem em "abaixo".
 */
export function selectByCutoff(rows: CandidaturaRow[], mode: CutoffSelection): CandidaturaRow[] {
  switch (mode) {
    case "ALL":
      return rows;
    case "ABOVE":
      return rows.filter((r) => meetsMinimum(r));
    case "BELOW":
      return rows.filter((r) => r.aiScore !== null && !meetsMinimum(r));
    case "UNANALYZED":
      return rows.filter((r) => r.aiScore === null);
  }
}
