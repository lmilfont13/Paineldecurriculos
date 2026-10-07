import "server-only";

import { cache } from "react";

import { requireManager } from "@/server/controllers/guards";
import type {
  DashboardStats,
  JobProgress,
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
  // Sequencial: com connection_limit=1 o Promise.all só enfileira na
  // mesma conexão e aumenta o risco de P2024 (pool_timeout).
  const company = await getCompanyById(user.companyId);
  const pendingCount = await countPendingApplications(user.companyId);
  if (!company) throw new Error("Empresa da sessão não encontrada");
  return { user, company, pendingCount };
});

export async function getVagasPageData() {
  const { user, company } = await getGestorShell();
  const jobs = await listCompanyJobs(user.companyId);
  return { companySlug: company.slug, jobs };
}

/** Configurações · a vitrine da empresa, como o dono edita. */
export async function getConfiguracoesData() {
  const { company } = await getGestorShell();
  return {
    company,
    publicUrl: `${process.env.NEXT_PUBLIC_APP_URL}/${company.slug}/vagas`,
  };
}

export async function getFormularioPageData() {
  const { user } = await getGestorShell();
  const { core, custom } = await listApplicationFormFields(user.companyId);
  return { fields: [...core, ...custom] };
}

export async function getCandidaturasPageData(jobId?: string) {
  const { user } = await getGestorShell();
  // Sequencial: com connection_limit=1 o Promise.all só enfileira na
  // mesma conexão e aumenta o risco de P2024 (pool_timeout).
  const applications = await listCompanyApplications(user.companyId, jobId);
  const jobs = await listCompanyJobs(user.companyId);
  return { applications, jobs };
}

/** Hub da vaga: o processo inteiro em um lugar (funil, sinais, critérios). */
export async function getVagaDetailData(jobId: string) {
  const { user, company } = await getGestorShell();
  const job = await getCompanyJob(user.companyId, jobId);
  if (!job) return null;
  const applications = await listCompanyApplications(user.companyId, jobId);
  return {
    job,
    companySlug: company.slug,
    publicUrl: `${process.env.NEXT_PUBLIC_APP_URL}/${company.slug}/vagas/${job.id}`,
    applications,
  };
}

export async function getCandidaturaDetail(id: string) {
  const { user } = await getGestorShell();
  return getCompanyApplication(user.companyId, id);
}

/** G12 · Dados para comparação lado a lado (2–3 candidaturas do tenant). */
export async function getCompareData(ids: string[]) {
  const { user } = await getGestorShell();
  // Sequencial (connection_limit=1): cada detalhe já faz vários joins.
  const applications = [];
  for (const id of ids.slice(0, 3)) {
    const application = await getCompanyApplication(user.companyId, id);
    if (application) applications.push(application);
  }
  return applications;
}

export async function getJobForEdit(jobId: string) {
  const { user, company } = await getGestorShell();
  const job = await getCompanyJob(user.companyId, jobId);
  return { job, company };
}

export async function getPainelData(): Promise<{
  userName: string;
  companyName: string;
  companySlug: string;
  publicUrl: string;
  stats: DashboardStats;
  priority: PriorityApplication[];
  jobs: JobProgress[];
}> {
  const { user, company } = await getGestorShell();
  const { stats, priority, jobs } = await getDashboard(user.companyId);
  return {
    userName: user.name ?? user.email,
    companyName: company.name,
    companySlug: company.slug,
    publicUrl: `${process.env.NEXT_PUBLIC_APP_URL}/${company.slug}/vagas`,
    stats,
    priority,
    jobs,
  };
}
