import "server-only";

import { cache } from "react";

import { requireManager } from "@/server/controllers/guards";
import type {
  DashboardStats,
  PriorityApplication,
} from "@/server/models/dashboard.model";
import {
  countPendingApplications,
  getCompanyApplication,
  listCompanyApplications,
} from "@/server/services/application.service";
import { getCompanyById } from "@/server/services/company.service";
import { listApplicationFormFields } from "@/server/services/form.service";
import { getDashboard } from "@/server/services/dashboard.service";
import { getCompanyJob, listCompanyJobs } from "@/server/services/job.service";

/** Dados do shell do gestor (sidebar/topbar) — 1x por request. */
export const getGestorShell = cache(async () => {
  const user = await requireManager();
  const [company, pendingCount] = await Promise.all([
    getCompanyById(user.companyId),
    countPendingApplications(user.companyId),
  ]);
  if (!company) throw new Error("Empresa da sessão não encontrada");
  return { user, company, pendingCount };
});

export async function getVagasPageData() {
  const { user, company } = await getGestorShell();
  const jobs = await listCompanyJobs(user.companyId);
  return { companySlug: company.slug, jobs };
}

export async function getFormularioPageData() {
  const { user } = await getGestorShell();
  const { core, custom } = await listApplicationFormFields(user.companyId);
  return { fields: [...core, ...custom] };
}

export async function getCandidaturasPageData(jobId?: string) {
  const { user } = await getGestorShell();
  const [applications, jobs] = await Promise.all([
    listCompanyApplications(user.companyId, jobId),
    listCompanyJobs(user.companyId),
  ]);
  return { applications, jobs };
}

export async function getCandidaturaDetail(id: string) {
  const { user } = await getGestorShell();
  return getCompanyApplication(user.companyId, id);
}

export async function getJobForEdit(jobId: string) {
  const { user, company } = await getGestorShell();
  const job = await getCompanyJob(user.companyId, jobId);
  return { job, company };
}

export async function getPainelData(): Promise<{
  userName: string;
  companyName: string;
  stats: DashboardStats;
  priority: PriorityApplication[];
}> {
  const { user, company } = await getGestorShell();
  const { stats, priority } = await getDashboard(user.companyId);
  return {
    userName: user.name ?? user.email,
    companyName: company.name,
    stats,
    priority,
  };
}
