import type { AIState, AppStatus, JobStatus } from "@prisma/client";

/**
 * O painel é uma fila de trabalho, não um resumo de volume: os números aqui
 * respondem "o que eu faço agora?" — quem espera, há quanto tempo, e quais
 * processos estão andando.
 */
export type DashboardStats = {
  openJobs: number;
  totalJobs: number;
  /** Candidatos em triagem — o trabalho parado na mesa do gestor. */
  waiting: number;
  /** Quando chegou o mais antigo que ainda espera resposta. */
  oldestWaitingAt: Date | null;
  /** Decisões tomadas nos últimos 7 dias (o painel também mostra progresso). */
  decided7d: number;
  newApplications7d: number;
};

/** Andamento de uma vaga aberta, para a linha por processo do painel. */
export type JobProgress = {
  id: string;
  title: string;
  status: JobStatus;
  total: number;
  pending: number;
  interview: number;
  approved: number;
  rejected: number;
};

export type PriorityApplication = {
  id: string;
  name: string;
  jobTitle: string;
  aiScore: number | null;
  aiState: AIState;
  status: AppStatus;
  meetsMinimum: boolean;
  createdAt: Date;
};

export function personInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1][0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}
