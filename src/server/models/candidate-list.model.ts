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
  aiMinScore: number;
  /** Candidatura da sala de simulação (mostra o selo "Demonstração"). */
  isDemo?: boolean;
  photoUrl?: string | null;
};

export type StageKey = AppStatusKey | "ALL";

export type SortKey = "WAITING" | "RECENT" | "SCORE";

export type ListFilters = {
  search: string;
  jobId: string;
  onlyMeets: boolean;
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
  { search, jobId, onlyMeets }: ListFilters
): CandidaturaRow[] {
  const q = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (
      q &&
      !row.name.toLowerCase().includes(q) &&
      !row.email.toLowerCase().includes(q)
    )
      return false;
    if (jobId && row.jobId !== jobId) return false;
    if (onlyMeets && !meetsMinimum(row)) return false;
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
