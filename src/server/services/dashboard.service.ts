import "server-only";

import type {
  DashboardStats,
  JobProgress,
  PriorityApplication,
} from "@/server/models/dashboard.model";
import { findApplicationsByCompany } from "@/server/repositories/application.repository";
import { findJobsByCompanyId } from "@/server/repositories/job.repository";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Dados do E1 · Painel — sempre escopados ao companyId da sessão (regra 1).
 *
 * A prioridade combina espera e aderência: quem está há mais tempo sem
 * resposta sobe, e o score desempata. Ordenar só por score fazia um candidato
 * de duas semanas atrás desaparecer atrás de quem chegou hoje.
 */
export async function getDashboard(companyId: string): Promise<{
  stats: DashboardStats;
  priority: PriorityApplication[];
  jobs: JobProgress[];
}> {
  const since7d = new Date(Date.now() - WEEK_MS);
  // Sequencial: com connection_limit=1 o Promise.all só enfileira na
  // mesma conexão e aumenta o risco de P2024 (pool_timeout).
  const applications = await findApplicationsByCompany(companyId);
  const allJobs = await findJobsByCompanyId(companyId);

  const waitingList = applications.filter((a) => a.status === "PENDING");
  const oldestWaitingAt = waitingList.reduce<Date | null>(
    (oldest, a) => (!oldest || a.createdAt < oldest ? a.createdAt : oldest),
    null
  );

  const stats: DashboardStats = {
    openJobs: allJobs.filter((j) => j.status === "OPEN").length,
    totalJobs: allJobs.length,
    waiting: waitingList.length,
    oldestWaitingAt,
    decided7d: applications.filter(
      (a) =>
        (a.status === "APPROVED" || a.status === "REJECTED") &&
        a.updatedAt >= since7d
    ).length,
    newApplications7d: applications.filter((a) => a.createdAt >= since7d).length,
    totalApplications: applications.length,
  };

  const priority: PriorityApplication[] = waitingList
    .map((a) => ({
      id: a.id,
      name: a.name,
      jobTitle: a.job.title,
      aiScore: a.aiScore,
      aiState: a.aiState,
      status: a.status,
      meetsMinimum: a.aiScore !== null && a.aiScore >= a.job.aiMinScore,
      createdAt: a.createdAt,
    }))
    .sort((a, b) => {
      const byWait = a.createdAt.getTime() - b.createdAt.getTime();
      if (byWait !== 0) return byWait;
      return (b.aiScore ?? -1) - (a.aiScore ?? -1);
    })
    .slice(0, 5);

  // Rascunho entra na lista: é trabalho parado esperando o dono publicar.
  const jobs: JobProgress[] = allJobs
    .filter((j) => j.status !== "CLOSED")
    .map((job) => {
      const ofJob = applications.filter((a) => a.job.id === job.id);
      const count = (status: string) =>
        ofJob.filter((a) => a.status === status).length;
      return {
        id: job.id,
        title: job.title,
        status: job.status,
        total: ofJob.length,
        pending: count("PENDING"),
        interview: count("INTERVIEW"),
        approved: count("APPROVED"),
        rejected: count("REJECTED"),
      };
    })
    .sort((a, b) => {
      if (a.status === "DRAFT" && b.status !== "DRAFT") return -1;
      if (b.status === "DRAFT" && a.status !== "DRAFT") return 1;
      return b.pending - a.pending;
    });

  return { stats, priority, jobs };
}
