"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { geminiGenerate } from "@/lib/gemini";
import { requireManager } from "@/server/controllers/guards";
import { jobFormSchema } from "@/server/models/job.model";
import {
  createCompanyJob,
  trackWhatsappShare,
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

/** Incrementa o contador de compartilhamentos via WhatsApp. */
export async function trackJobShareAction(jobId: string): Promise<void> {
  const user = await requireManager();
  await trackWhatsappShare(user.companyId, jobId);
  revalidatePath(`/vagas/${jobId}`);
}

/** Reescreve o texto de uma vaga com IA — retorna o texto melhorado. */
export async function rewriteJobTextAction(
  field: "description" | "requirements",
  text: string,
  jobTitle: string
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  await requireManager();
  if (!text.trim()) return { ok: false, error: "Texto vazio." };

  const systemPrompts = {
    description: `Você é um especialista em RH. Reescreva a descrição da vaga abaixo de forma clara, atraente e objetiva. Use parágrafos curtos. Não invente informações que não estão no original. Retorne apenas o texto reescrito, sem preâmbulos.`,
    requirements: `Você é um especialista em RH. Reescreva a lista de requisitos da vaga abaixo de forma clara e direta, um item por linha, começando cada linha com "• ". Não invente requisitos. Retorne apenas os itens, sem preâmbulos.`,
  };

  try {
    const result = await geminiGenerate({
      system: systemPrompts[field],
      prompt: `Vaga: ${jobTitle}\n\n${text}`,
      maxTokens: 800,
    });
    return { ok: true, text: result.trim() };
  } catch {
    return { ok: false, error: "Falha ao conectar com a IA. Tente novamente." };
  }
}

/** Muda status (Aberta/Pausada/Encerrada) — decisão manual do gestor. */
export async function setJobStatusAction(
  jobId: string,
  status: "OPEN" | "PAUSED" | "CLOSED"
): Promise<void> {
  const user = await requireManager();
  await updateCompanyJob(user.companyId, jobId, { status });
  revalidatePath("/vagas");
  revalidatePath(`/vagas/${jobId}`);
  revalidatePath("/painel");
}
