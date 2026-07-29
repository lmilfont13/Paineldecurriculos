import "server-only";

import { cache } from "react";

import type { CandidateProfile } from "@/server/models/candidate.model";
import type { PublicCompany } from "@/server/models/company.model";
import type { PublicFormField } from "@/server/models/form.model";
import type { PublicJob } from "@/server/models/job.model";
import {
  getCandidateApplication,
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
): Promise<{ company: PublicCompany; jobs: PublicJob[] } | null> {
  const company = await getTenant(slug);
  if (!company) return null;
  const jobs = await listOpenJobs(company.id);
  return { company, jobs };
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
  const [{ core, custom }, candidate] = await Promise.all([
    listApplicationFormFields(company.id),
    getSessionCandidate(),
  ]);
  const [prefillAnswers, alreadyAppliedId] = candidate
    ? await Promise.all([
        getPrefillAnswers(candidate.id, company.id),
        getExistingApplicationId(candidate.id, job.id),
      ])
    : [{}, null];
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

/** CA4 · Minhas candidaturas (todas as empresas). */
export async function getMinhasCandidaturasData(slug: string) {
  const company = await getTenant(slug);
  if (!company) return null;
  const candidate = await getSessionCandidate();
  if (!candidate) return { company, candidate: null, applications: [] };
  const applications = await listCandidateApplications(candidate.id);
  return { company, candidate, applications };
}
