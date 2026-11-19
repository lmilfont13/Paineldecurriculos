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
  /** Candidaturas de todos os tempos: distingue "fila limpa" de "ninguém veio". */
  totalApplications: number;
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
  photoPath: string | null;
  hasImpediment?: boolean;
  impedimentReason?: string | null;
};

export type DailyRegistrationPoint = {
  dateKey: string;
  dayMonth: string;
  weekday: string;
  count: number;
  isToday: boolean;
};

export type TopJobRegistration = {
  id: string;
  title: string;
  code: number | null;
  count: number;
  pct: number;
  status: JobStatus;
};

export type DashboardAnalytics = {
  totalRegistrations: number;
  uniquePeople: number;
  todayRegistrations: number;
  last7DaysTotal: number;
  dailyRegistrations: DailyRegistrationPoint[];
  topJobs: TopJobRegistration[];
  gender: {
    femaleCount: number;
    femalePct: number;
    maleCount: number;
    malePct: number;
    unspecifiedCount: number;
    unspecifiedPct: number;
  };
  quality: {
    avgScore: number | null;
    aboveCutoffCount: number;
    aboveCutoffPct: number;
    topMatchCount: number;
  };
  topAreas: { label: string; count: number; pct: number }[];
  funnel: {
    pending: number;
    shortlisted: number;
    interview: number;
    standby: number;
    approved: number;
    rejected: number;
  };
};

export function personInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1][0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}
