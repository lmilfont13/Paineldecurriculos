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
};

export type StageKey = AppStatusKey | "ALL";

export type SortKey = "WAITING" | "RECENT" | "SCORE";

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
