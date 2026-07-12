"use server";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/server/controllers/guards";
import {
  applicationInputSchema,
  type SubmitApplicationResult,
} from "@/server/models/application.model";
import {
  setApplicationStatus,
  submitApplication,
} from "@/server/services/application.service";
import { getPublicCompanyBySlug } from "@/server/services/company.service";

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
    email: formData.get("email"),
    phone: formData.get("phone"),
    answers,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const company = await getPublicCompanyBySlug(parsed.data.slug);
  if (!company) {
    return { ok: false, error: "Empresa não encontrada." };
  }

  const resume = formData.get("resume");
  return submitApplication(
    company.id,
    parsed.data,
    resume instanceof File ? resume : null
  );
}
