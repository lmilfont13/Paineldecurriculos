import "server-only";

import type {
  DashboardStats,
  PriorityApplication,
} from "@/server/models/dashboard.model";
import {
  countApplicationsByCompany,
  findApplicationsByCompany,
} from "@/server/repositories/application.repository";
import { countJobsByCompanyId } from "@/server/repositories/job.repository";

/** Dados do E1 · Painel — sempre escopados ao companyId da sessão (regra 1). */
export async function getDashboard(companyId: string): Promise<{
  stats: DashboardStats;
  priority: PriorityApplication[];
}> {
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [openJobs, totalJobs, newApplications7d, inInterview, applications] =
    await Promise.all([
      countJobsByCompanyId(companyId, true),
      countJobsByCompanyId(companyId),
      countApplicationsByCompany(companyId, { since: since7d }),
      countApplicationsByCompany(companyId, { status: "INTERVIEW" }),
      findApplicationsByCompany(companyId),
    ]);

  const meetingMinimum = applications.filter(
    (a) => a.aiScore !== null && a.aiScore >= a.job.aiMinScore
  ).length;

  const priority: PriorityApplication[] = applications
    .filter((a) => a.status === "PENDING")
    .slice(0, 4)
    .map((a) => ({
      id: a.id,
      name: a.name,
      jobTitle: a.job.title,
      aiScore: a.aiScore,
      aiState: a.aiState,
      status: a.status,
      meetsMinimum: a.aiScore !== null && a.aiScore >= a.job.aiMinScore,
    }));

  return {
    stats: { openJobs, totalJobs, newApplications7d, meetingMinimum, inInterview },
    priority,
  };
}
