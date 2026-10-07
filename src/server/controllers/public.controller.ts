import "server-only";

import { cache } from "react";

import type { CandidateProfile } from "@/server/models/candidate.model";
import type { PublicCompany } from "@/server/models/company.model";
import type { PublicFormField } from "@/server/models/form.model";
import type { PublicJob } from "@/server/models/job.model";
import {
  getCandidateApplication,
  getAppliedJobIds,
  getExistingApplicationId,
  getPrefillAnswers,
  listCandidateApplications,
} from "@/server/services/application.service";
import { getSessionCandidate } from "@/server/services/candidate.service";
import {
  getDefaultCompanySlug,
  getPublicCompanyBySlug,
} from "@/server/services/company.service";
import { listApplicationFormFields } from "@/server/services/form.service";
import {
  countCandidateUnread,
  listCandidateNotifications,
} from "@/server/services/notification.service";
import {
  countApplicants,
  getOpenJob,
  listOpenJobs,
} from "@/server/services/job.service";

/**
 * Controller do fluxo público (candidato).
 * `cache()` deduplica a resolução do tenant entre layout e página no mesmo request.
 */
export const getTenant = cache(
  async (slug: string): Promise<PublicCompany | null> => {
    return getPublicCompanyBySlug(slug);
  }
);

export async function getJobsPageData(
  slug: string
): Promise<{ company: PublicCompany; jobs: PublicJob[]; appliedJobIds: string[] } | null> {
  const company = await getTenant(slug);
  if (!company) return null;
  // Sequencial: com connection_limit=1 o Promise.all só enfileira na
  // mesma conexão e aumenta o risco de P2024 (pool_timeout).
  const jobs = await listOpenJobs(company.id);
  const candidate = await getSessionCandidate();
  const appliedJobIds = candidate
    ? await getAppliedJobIds(candidate.id, jobs.map((j) => j.id))
    : [];
  return { company, jobs, appliedJobIds };
}

export async function getJobDetailPageData(
  slug: string,
  jobId: string
): Promise<{
  company: PublicCompany;
  job: PublicJob;
  applicantCount: number;
} | null> {
  const company = await getTenant(slug);
  if (!company) return null;
  const job = await getOpenJob(company.id, jobId);
  if (!job) return null;
  const applicantCount = await countApplicants(job.id);
  return { company, job, applicantCount };
}

export async function getApplyPageData(
  slug: string,
  jobId: string
): Promise<{
  company: PublicCompany;
  job: PublicJob;
  coreFields: PublicFormField[];
  customFields: PublicFormField[];
  candidate: CandidateProfile | null;
  prefillAnswers: Record<string, string>;
  alreadyAppliedId: string | null;
} | null> {
  const company = await getTenant(slug);
  if (!company) return null;
  const job = await getOpenJob(company.id, jobId);
  if (!job) return null;
  // Sequencial: com connection_limit=1 o Promise.all só enfileira na
  // mesma conexão e aumenta o risco de P2024 (pool_timeout).
  const { core, custom } = await listApplicationFormFields(company.id, job.id);
  const candidate = await getSessionCandidate();
  const prefillAnswers = candidate
    ? await getPrefillAnswers(candidate.id, company.id)
    : {};
  const alreadyAppliedId = candidate
    ? await getExistingApplicationId(candidate.id, job.id)
    : null;
  return {
    company,
    job,
    coreFields: core,
    customFields: custom,
    candidate,
    prefillAnswers,
    alreadyAppliedId,
  };
}

/** Detalhe da candidatura na visão do candidato (timeline, respostas, CV). */
export async function getMinhaCandidaturaData(slug: string, id: string) {
  const company = await getTenant(slug);
  if (!company) return null;
  const candidate = await getSessionCandidate();
  if (!candidate) return { company, candidate: null, application: null };
  const application = await getCandidateApplication(candidate.id, id);
  return { company, candidate, application };
}

/** Raiz do site → página de vagas da empresa ativa. */
export async function getDefaultPublicSlug(): Promise<string | null> {
  return getDefaultCompanySlug();
}

/** Sessão do candidato para o header público. */
export async function getPublicSession(): Promise<CandidateProfile | null> {
  return getSessionCandidate();
}

/** Novidades não lidas do candidato da sessão (contador do sino). */
export const getUnreadCount = cache(async (): Promise<number> => {
  const candidate = await getSessionCandidate();
  if (!candidate) return 0;
  return countCandidateUnread(candidate.id);
});

/** Histórico de novidades do candidato (página de notificações). */
export async function getNotificacoesData(slug: string) {
  const company = await getTenant(slug);
  if (!company) return null;
  const candidate = await getSessionCandidate();
  if (!candidate) return { company, candidate: null, notifications: [] };
  const notifications = await listCandidateNotifications(candidate.id);
  return { company, candidate, notifications };
}

/** CA4 · Home do candidato: novidades + candidaturas em andamento e encerradas. */
export async function getMinhasCandidaturasData(slug: string) {
  const company = await getTenant(slug);
  if (!company) return null;
  const candidate = await getSessionCandidate();
  if (!candidate) {
    return { company, candidate: null, applications: [], unread: [] };
  }
  // Sequencial: com connection_limit=1 o Promise.all só enfileira na
  // mesma conexão e aumenta o risco de P2024 (pool_timeout).
  const applications = await listCandidateApplications(candidate.id);
  const notifications = await listCandidateNotifications(candidate.id);
  return {
    company,
    candidate,
    applications,
    unread: notifications.filter((n) => !n.readAt).slice(0, 3),
  };
}
