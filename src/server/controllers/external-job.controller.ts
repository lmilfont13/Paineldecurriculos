/**
 * Controller das vagas externas (Google Vagas).
 * Valida input, resolve o tenant pela sessão (regra 1) e chama o service.
 */

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getGestorShell } from "@/server/controllers/gestor.controller";
import {
  externalJobCandidateSchema,
  externalJobSearchSchema,
  importExternalJobsSchema,
  type ExternalJobCandidate,
} from "@/server/models/external-job.model";
import {
  extractJobPreviewFromUrl,
  importExternalJobs,
  isGoogleJobsSearchConfigured,
  listExternalJobsForManager,
  removeExternalJob,
  searchGoogleJobs,
  toggleExternalJob,
} from "@/server/services/external-job.service";

export async function getExternalJobsPageData() {
  const { user, company } = await getGestorShell();
  const jobs = await listExternalJobsForManager(user.companyId);
  return {
    companySlug: company.slug,
    searchConfigured: isGoogleJobsSearchConfigured(),
    jobs: jobs.map((j) => ({
      id: j.id,
      title: j.title,
      employer: j.employer,
      location: j.location,
      source: j.source,
      applyUrl: j.applyUrl,
      postedLabel: j.postedLabel,
      isPublished: j.isPublished,
      createdAt: j.createdAt.toISOString(),
    })),
  };
}

export async function searchGoogleJobsAction(input: { query: string; location?: string }) {
  const { user } = await getGestorShell();
  const parsed = externalJobSearchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Busca inválida." };
  }
  return searchGoogleJobs(user.companyId, parsed.data.query, parsed.data.location);
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
  return { ok: true as const, ...result };
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
  return { ok: true as const, ...result };
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
