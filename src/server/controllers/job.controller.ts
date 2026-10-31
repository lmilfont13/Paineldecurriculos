"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { geminiGenerate } from "@/lib/gemini";
import { requireManager } from "@/server/controllers/guards";
import { jobFormSchema } from "@/server/models/job.model";
import { createAuditLog } from "@/server/repositories/audit.repository";
import {
  createCompanyJob,
  deleteCompanyJob,
  trackWhatsappShare,
  updateCompanyJob,
} from "@/server/services/job.service";
import { queueStandbyForJob } from "@/server/services/talent.service";

export type JobFormState = { error: string } | null;

function parseJobForm(formData: FormData) {
  return jobFormSchema.safeParse({
    code: formData.get("code") ?? "",
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
  const isPublish = formData.get("publish") === "true";
  const job = await createCompanyJob(user.companyId, parsed.data, isPublish);
  try {
    await createAuditLog({
      companyId: user.companyId,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: isPublish ? "VAGA_PUBLICADA" : "VAGA_CRIADA",
      entityType: "VAGA",
      entityId: job.id,
      entityLabel: parsed.data.title,
    });
  } catch { /* auditoria nunca bloqueia a ação principal */ }
  // Vaga no ar: confere o banco de talentos em stand-by em segundo plano.
  if (isPublish) queueStandbyForJob(user.companyId, job.id);
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
  try {
    await createAuditLog({
      companyId: user.companyId,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "VAGA_EDITADA",
      entityType: "VAGA",
      entityId: jobId,
      entityLabel: parsed.data.title,
    });
  } catch { /* auditoria nunca bloqueia a ação principal */ }
  revalidatePath("/vagas");
  redirect("/vagas");
}

/** Incrementa o contador de compartilhamentos via WhatsApp. */
export async function trackJobShareAction(jobId: string): Promise<void> {
  const user = await requireManager();
  await trackWhatsappShare(user.companyId, jobId);
  try {
    await createAuditLog({
      companyId: user.companyId,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "VAGA_COMPARTILHADA_WHATSAPP",
      entityType: "VAGA",
      entityId: jobId,
    });
  } catch { /* auditoria nunca bloqueia a ação principal */ }
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

export type ParsedJobText = {
  code: string;
  title: string;
  location: string;
  contract: "CLT" | "PJ" | "FREELANCE" | "INTERNSHIP";
  workMode: "REMOTE" | "HYBRID" | "ONSITE";
  description: string;
  requirements: string;
  aiCriteria: string[];
};

const parsedJobSchema = z.object({
  code: z.string().default(""),
  title: z.string().default(""),
  location: z.string().default(""),
  contract: z.enum(["CLT", "PJ", "FREELANCE", "INTERNSHIP"]).catch("CLT"),
  workMode: z.enum(["REMOTE", "HYBRID", "ONSITE"]).catch("ONSITE"),
  description: z.string().default(""),
  requirements: z.string().default(""),
  aiCriteria: z.array(z.string()).default([]),
});

/** Organiza o texto bruto de uma vaga (colado como chega) nos campos do wizard. */
export async function parseJobTextAction(
  raw: string
): Promise<{ ok: true; job: ParsedJobText } | { ok: false; error: string }> {
  await requireManager();
  if (raw.trim().length < 20) return { ok: false, error: "Cole o texto da vaga." };

  const system = `Você é um especialista em RH. Receberá o texto bruto de uma vaga, geralmente copiado de e-mail ou WhatsApp. Organize-o em JSON com exatamente estas chaves:
- "code": código/número da vaga se houver no texto (ex.: "1123" em "INFORMAÇÕES DA VAGA 1123"), apenas o código; senão "".
- "title": nome do cargo em Title Case (ex.: "Consultor de Vendas"), sem códigos.
- "location": cidade e UF (ex.: "Caucaia, CE").
- "contract": "CLT", "PJ", "FREELANCE" ou "INTERNSHIP".
- "workMode": "REMOTE", "HYBRID" ou "ONSITE" (loja/ponto de venda/presencial = ONSITE).
- "description": texto para o candidato, em parágrafos curtos e blocos com título em linha própria (ex.: "Sobre a vaga", "Escala e horário", "Remuneração e benefícios"), listas com "• ". Inclua perfil, início, escala, roteiro/endereço, salário, variável e benefícios.
- "requirements": requisitos obrigatórios e diferenciais, um por linha, cada linha começando com "• " (diferenciais terminam com " (diferencial)").
- "aiCriteria": de 3 a 6 critérios curtos (até 8 palavras) para avaliar currículos, baseados nos requisitos.
Não invente nada que não esteja no texto. Remova emojis, números de controle da vaga e formatação quebrada. Responda apenas com o JSON.`;

  try {
    const out = await geminiGenerate({
      system,
      prompt: raw.slice(0, 8000),
      maxTokens: 1800,
      json: true,
    });
    const jsonText = out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1);
    const parsed = parsedJobSchema.safeParse(JSON.parse(jsonText));
    if (!parsed.success) throw new Error("JSON inválido");
    const job = parsed.data;
    return {
      ok: true,
      job: {
        ...job,
        code: job.code.trim(),
        title: job.title.trim(),
        aiCriteria: job.aiCriteria.map((c) => c.trim()).filter(Boolean).slice(0, 10),
      },
    };
  } catch {
    return { ok: false, error: "Não consegui organizar o texto. Tente novamente." };
  }
}

/** Muda status (Aberta/Pausada/Encerrada) — decisão manual do gestor. */
export async function setJobStatusAction(
  jobId: string,
  status: "OPEN" | "PAUSED" | "CLOSED"
): Promise<void> {
  const user = await requireManager();
  const updated = await updateCompanyJob(user.companyId, jobId, { status });
  if (updated && status === "OPEN") queueStandbyForJob(user.companyId, jobId);
  const actionMap = {
    OPEN: "VAGA_PUBLICADA",
    PAUSED: "VAGA_PAUSADA",
    CLOSED: "VAGA_ENCERRADA",
  } as const;
  try {
    await createAuditLog({
      companyId: user.companyId,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: actionMap[status],
      entityType: "VAGA",
      entityId: jobId,
      entityLabel: updated?.title,
    });
  } catch { /* auditoria nunca bloqueia a ação principal */ }
  revalidatePath("/vagas");
  revalidatePath(`/vagas/${jobId}`);
  revalidatePath("/painel");
}

/** Exclui a vaga e as candidaturas dela (definitivo, com confirmação na tela). */
export async function deleteJobAction(
  jobId: string
): Promise<{ ok: true; deletedApplications: number } | { ok: false; error: string }> {
  const user = await requireManager();
  const result = await deleteCompanyJob(user.companyId, jobId);
  if (!result) return { ok: false, error: "Vaga não encontrada." };
  try {
    await createAuditLog({
      companyId: user.companyId,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "VAGA_EXCLUIDA",
      entityType: "VAGA",
      entityId: jobId,
      entityLabel: result.title,
      metadata: { candidaturasExcluidas: result.deletedApplications },
    });
  } catch { /* auditoria nunca bloqueia a ação principal */ }
  revalidatePath("/vagas");
  revalidatePath("/candidaturas");
  revalidatePath("/painel");
  revalidatePath("/agentes");
  return { ok: true, deletedApplications: result.deletedApplications };
}
