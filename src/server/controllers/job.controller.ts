"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireManager } from "@/server/controllers/guards";
import { jobFormSchema } from "@/server/models/job.model";
import {
  createCompanyJob,
  updateCompanyJob,
} from "@/server/services/job.service";

export type JobFormState = { error: string } | null;

function parseJobForm(formData: FormData) {
  return jobFormSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    requirements: formData.get("requirements") ?? "",
    location: formData.get("location") ?? "",
    contract: formData.get("contract"),
    workMode: formData.get("workMode"),
    aiCriteria: JSON.parse(String(formData.get("aiCriteria") ?? "[]")),
    aiMinScore: Number(formData.get("aiMinScore") ?? 70),
  });
}

/** Cria a vaga (wizard E5–E8). `publish=true` → OPEN; senão DRAFT. */
export async function createJobAction(
  _prev: JobFormState,
  formData: FormData
): Promise<JobFormState> {
  const user = await requireManager();
  const parsed = parseJobForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  await createCompanyJob(
    user.companyId,
    parsed.data,
    formData.get("publish") === "true"
  );
  revalidatePath("/vagas");
  redirect("/vagas");
}

/** Edita vaga existente. */
export async function updateJobAction(
  jobId: string,
  _prev: JobFormState,
  formData: FormData
): Promise<JobFormState> {
  const user = await requireManager();
  const parsed = parseJobForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const updated = await updateCompanyJob(user.companyId, jobId, parsed.data);
  if (!updated) return { error: "Vaga não encontrada." };
  revalidatePath("/vagas");
  redirect("/vagas");
}

/** Muda status (Aberta/Pausada/Encerrada) — decisão manual do gestor. */
export async function setJobStatusAction(
  jobId: string,
  status: "OPEN" | "PAUSED" | "CLOSED"
): Promise<void> {
  const user = await requireManager();
  await updateCompanyJob(user.companyId, jobId, { status });
  revalidatePath("/vagas");
}
