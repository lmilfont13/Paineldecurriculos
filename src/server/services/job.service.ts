import "server-only";

import {
  toPublicJob,
  type JobFormInput,
  type ManagerJob,
  type PublicJob,
} from "@/server/models/job.model";
import {
  countApplicationsByJobId,
  countPendingGroupedByJob,
} from "@/server/repositories/application.repository";
import {
  createJob,
  findJobById,
  findJobsByCompanyId,
  findOpenJobsByCompanyId,
  updateJob,
} from "@/server/repositories/job.repository";

/** Vagas abertas do tenant, para a lista pública. */
export async function listOpenJobs(companyId: string): Promise<PublicJob[]> {
  const jobs = await findOpenJobsByCompanyId(companyId);
  return jobs.map(toPublicJob);
}

/**
 * Detalhe público da vaga — precisa pertencer ao tenant e estar aberta,
 * senão null (rota responde 404). Nunca vaza vaga de outra empresa.
 */
export async function getOpenJob(
  companyId: string,
  jobId: string
): Promise<PublicJob | null> {
  const job = await findJobById(jobId);
  if (!job || job.companyId !== companyId || job.status !== "OPEN") return null;
  return toPublicJob(job);
}

/** Quantas pessoas já se candidataram (mostrado no card da P2). */
export function countApplicants(jobId: string): Promise<number> {
  return countApplicationsByJobId(jobId);
}

/** Todas as vagas do tenant com contagens (lista E2 do gestor). */
export async function listCompanyJobs(companyId: string): Promise<ManagerJob[]> {
  const [jobs, pendingByJob] = await Promise.all([
    findJobsByCompanyId(companyId),
    countPendingGroupedByJob(companyId),
  ]);
  return jobs.map((job) => ({
    ...toPublicJob(job),
    status: job.status,
    aiCriteria: job.aiCriteria,
    aiMinScore: job.aiMinScore,
    applicationCount: job._count.applications,
    pendingCount: pendingByJob.get(job.id) ?? 0,
  }));
}

/** Vaga do tenant para edição (E5–E8). */
export async function getCompanyJob(companyId: string, jobId: string) {
  const job = await findJobById(jobId);
  if (!job || job.companyId !== companyId) return null;
  return job;
}

/** Cria vaga do tenant (wizard E5–E8): como rascunho ou publicada. */
export function createCompanyJob(
  companyId: string,
  input: JobFormInput,
  publish: boolean
) {
  return createJob({
    companyId,
    title: input.title,
    description: input.description,
    requirements: input.requirements || null,
    location: input.location || null,
    contract: input.contract,
    workMode: input.workMode,
    status: publish ? "OPEN" : "DRAFT",
    aiCriteria: input.aiCriteria,
    aiMinScore: input.aiMinScore,
  });
}

/** Atualiza vaga do tenant — sempre valida a posse antes (regra 1). */
export async function updateCompanyJob(
  companyId: string,
  jobId: string,
  input: Partial<JobFormInput> & {
    status?: "DRAFT" | "OPEN" | "PAUSED" | "CLOSED";
  }
) {
  const job = await getCompanyJob(companyId, jobId);
  if (!job) return null;
  return updateJob(jobId, {
    ...input,
    requirements:
      input.requirements !== undefined ? input.requirements || null : undefined,
    location: input.location !== undefined ? input.location || null : undefined,
  });
}
