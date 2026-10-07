"use server";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/server/controllers/guards";
import { formFieldInputSchema } from "@/server/models/form.model";
import {
  addCatalogQuestionToJob,
  addJobQuestion,
  removeFormField,
  setFormFieldRequired,
} from "@/server/services/form.service";

/**
 * Perguntas por vaga (hub da vaga). O tenant vem sempre da sessão (regra 1);
 * o service confere que a vaga e a pergunta são da empresa.
 */

export type JobQuestionState = { error: string } | null;

function refresh(jobId: string) {
  revalidatePath(`/vagas/${jobId}`);
}

export async function addSuggestedQuestionAction(
  jobId: string,
  catalogId: string
): Promise<JobQuestionState> {
  const user = await requireManager();
  const created = await addCatalogQuestionToJob(user.companyId, jobId, catalogId);
  refresh(jobId);
  return created ? null : { error: "Não foi possível adicionar a pergunta." };
}

export async function addCustomQuestionAction(
  jobId: string,
  _prev: JobQuestionState,
  formData: FormData
): Promise<JobQuestionState> {
  const user = await requireManager();
  const options = String(formData.get("options") ?? "")
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean);
  const parsed = formFieldInputSchema.safeParse({
    label: String(formData.get("label") ?? "").trim(),
    type: formData.get("type"),
    required: formData.get("required") === "on",
    options,
    isCore: false,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  if (parsed.data.type === "DROPDOWN" && parsed.data.options.length < 2) {
    return { error: "Lista de opções precisa de pelo menos 2 opções." };
  }
  const created = await addJobQuestion(user.companyId, jobId, parsed.data);
  refresh(jobId);
  return created ? null : { error: "Vaga não encontrada." };
}

export async function toggleJobQuestionRequiredAction(
  jobId: string,
  fieldId: string,
  required: boolean
): Promise<void> {
  const user = await requireManager();
  await setFormFieldRequired(user.companyId, fieldId, required);
  refresh(jobId);
}

export async function deleteJobQuestionAction(
  jobId: string,
  fieldId: string
): Promise<JobQuestionState> {
  const user = await requireManager();
  const result = await removeFormField(user.companyId, fieldId);
  refresh(jobId);
  return result.ok ? null : { error: result.error };
}
