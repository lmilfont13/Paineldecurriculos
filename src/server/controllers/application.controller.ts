"use server";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/server/controllers/guards";
import {
  applicationInputSchema,
  type SubmitApplicationResult,
} from "@/server/models/application.model";
import {
  requestReanalysis,
  saveManagerNotes,
  setApplicationStatus,
  submitApplication,
} from "@/server/services/application.service";
import { getSessionCandidate } from "@/server/services/candidate.service";
import { getPublicCompanyBySlug } from "@/server/services/company.service";

/** Notas internas do gestor na candidatura (E4). */
export async function saveNotesAction(
  applicationId: string,
  _prev: { saved: boolean } | null,
  formData: FormData
): Promise<{ saved: boolean }> {
  const user = await requireManager();
  await saveManagerNotes(
    user.companyId,
    applicationId,
    String(formData.get("notes") ?? "")
  );
  revalidatePath(`/candidaturas/${applicationId}`);
  return { saved: true };
}

/** Reenfileira a análise de IA (FAILED/NO_RESUME com currículo novo). */
export async function reanalyzeAction(applicationId: string): Promise<void> {
  const user = await requireManager();
  await requestReanalysis(user.companyId, applicationId);
  revalidatePath(`/candidaturas/${applicationId}`);
  revalidatePath("/candidaturas");
}

/** G11 · Mudança de status em massa (E9) — cada id é validado pelo tenant. */
export async function bulkSetApplicationStatusAction(
  applicationIds: string[],
  status: "PENDING" | "INTERVIEW" | "APPROVED" | "REJECTED"
): Promise<{ updated: number }> {
  const user = await requireManager();
  let updated = 0;
  for (const id of applicationIds.slice(0, 100)) {
    const result = await setApplicationStatus(user.companyId, id, status);
    if (result) updated += 1;
  }
  revalidatePath("/candidaturas");
  revalidatePath("/painel");
  return { updated };
}

/** Mudança de status pelo gestor (E4) — decisão sempre manual (regra 2). */
export async function setApplicationStatusAction(
  applicationId: string,
  status: "PENDING" | "INTERVIEW" | "APPROVED" | "REJECTED"
): Promise<void> {
  const user = await requireManager();
  await setApplicationStatus(user.companyId, applicationId, status);
  revalidatePath("/candidaturas");
  revalidatePath(`/candidaturas/${applicationId}`);
  revalidatePath("/painel");
}

export async function submitApplicationAction(
  formData: FormData
): Promise<SubmitApplicationResult> {
  let answers: Record<string, string> = {};
  try {
    answers = JSON.parse(String(formData.get("answers") ?? "{}"));
  } catch {
    return { ok: false, error: "Dados inválidos. Recarregue a página." };
  }

  const parsed = applicationInputSchema.safeParse({
    slug: formData.get("slug"),
    jobId: formData.get("jobId"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    answers,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  // CA1: candidatura exige conta de candidato
  const candidate = await getSessionCandidate();
  if (!candidate) {
    return {
      ok: false,
      error: "Sua sessão expirou. Entre novamente para enviar.",
    };
  }

  const company = await getPublicCompanyBySlug(parsed.data.slug);
  if (!company) {
    return { ok: false, error: "Empresa não encontrada." };
  }

  const resume = formData.get("resume");
  return submitApplication(
    company.id,
    candidate,
    parsed.data,
    resume instanceof File ? resume : null
  );
}
