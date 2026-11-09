/**
 * Controller das vagas externas (Google Vagas).
 * Valida input, resolve o tenant pela sessão (regra 1) e chama o service.
 */

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getGestorShell } from "@/server/controllers/gestor.controller";
import {
  calculateCtr,
  calculateExternalJobsSummary,
  externalJobCandidateSchema,
  externalJobSearchSchema,
  importExternalJobsSchema,
  type ExternalJobCandidate,
  type WorkplaceTypeFilter,
} from "@/server/models/external-job.model";
import {
  extractJobPreviewFromUrl,
  importExternalJobs,
  isGoogleJobsSearchConfigured,
  listExternalJobsForManager,
  removeExternalJob,
  searchGoogleJobs,
  toggleExternalJob,
  trackExternalJobClick,
  trackExternalJobViews,
} from "@/server/services/external-job.service";

export async function getExternalJobsPageData() {
  const { user, company } = await getGestorShell();
  const jobs = await listExternalJobsForManager(user.companyId);
  const stats = calculateExternalJobsSummary(jobs);

  return {
    companySlug: company.slug,
    searchConfigured: isGoogleJobsSearchConfigured(),
    stats,
    jobs: jobs.map((j) => ({
      id: j.id,
      title: j.title,
      employer: j.employer,
      location: j.location,
      source: j.source,
      applyUrl: j.applyUrl,
      postedLabel: j.postedLabel,
      isPublished: j.isPublished,
      viewsCount: j.viewsCount ?? 0,
      clicksCount: j.clicksCount ?? 0,
      ctr: calculateCtr(j.clicksCount ?? 0, j.viewsCount ?? 0),
      createdAt: j.createdAt.toISOString(),
    })),
  };
}

export async function searchGoogleJobsAction(input: {
  query?: string;
  location?: string;
  workplaceType?: WorkplaceTypeFilter;
}) {
  const { user } = await getGestorShell();
  const parsed = externalJobSearchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Busca inválida." };
  }
  return searchGoogleJobs(
    user.companyId,
    parsed.data.query,
    parsed.data.location,
    parsed.data.workplaceType
  );
}

export async function extractJobPreviewFromUrlAction(url: string) {
  await getGestorShell();
  return extractJobPreviewFromUrl(url);
}

export async function importExternalJobsAction(items: ExternalJobCandidate[]) {
  const { user, company } = await getGestorShell();
  const parsed = importExternalJobsSchema.safeParse(items);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Seleção inválida." };
  }
  const result = await importExternalJobs(user.companyId, parsed.data);
  revalidatePath("/vagas/externas");
  revalidatePath(`/${company.slug}/vagas`);
  return { ok: true as const, ...result, publicUrl: `/${company.slug}/vagas` };
}

export async function createSingleExternalJobAction(item: ExternalJobCandidate) {
  const { user, company } = await getGestorShell();
  const parsed = externalJobCandidateSchema.safeParse(item);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const result = await importExternalJobs(user.companyId, [parsed.data]);
  revalidatePath("/vagas/externas");
  revalidatePath(`/${company.slug}/vagas`);
  return { ok: true as const, ...result, publicUrl: `/${company.slug}/vagas` };
}

const idSchema = z.string().cuid();

export async function toggleExternalJobAction(id: string, isPublished: boolean) {
  const { user, company } = await getGestorShell();
  idSchema.parse(id);
  await toggleExternalJob(user.companyId, id, Boolean(isPublished));
  revalidatePath("/vagas/externas");
  revalidatePath(`/${company.slug}/vagas`);
}

export async function removeExternalJobAction(id: string) {
  const { user, company } = await getGestorShell();
  idSchema.parse(id);
  await removeExternalJob(user.companyId, id);
  revalidatePath("/vagas/externas");
  revalidatePath(`/${company.slug}/vagas`);
}

/**
 * Registra visualizações de vagas externas exibidas na tela para o candidato.
 * Protegido contra payload abusivo (máx 100 IDs válidos).
 */
export async function recordExternalJobViewsAction(jobIds: string[]) {
  if (!Array.isArray(jobIds) || jobIds.length === 0) return { ok: true, count: 0 };
  const validIds = jobIds.filter((id) => typeof id === "string" && id.length >= 10 && id.length <= 40).slice(0, 100);
  if (validIds.length === 0) return { ok: true, count: 0 };
  const count = await trackExternalJobViews(validIds);
  return { ok: true, count };
}

/**
 * Registra o clique do candidato para se inscrever na fonte original externa.
 */
export async function recordExternalJobClickAction(jobId: string) {
  if (!jobId || typeof jobId !== "string" || jobId.length < 10 || jobId.length > 40) {
    return { ok: false };
  }
  const tracked = await trackExternalJobClick(jobId);
  return { ok: tracked };
}
