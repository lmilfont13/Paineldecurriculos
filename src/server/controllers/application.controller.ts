"use server";

import { revalidatePath } from "next/cache";

import { geminiGenerate } from "@/lib/gemini";
import { requireManager } from "@/server/controllers/guards";
import {
  applicationInputSchema,
  type SubmitApplicationResult,
} from "@/server/models/application.model";
import { interviewSchema } from "@/server/models/interview.model";
import { createAuditLog } from "@/server/repositories/audit.repository";
import {
  getCompanyApplication,
  requestReanalysis,
  saveManagerNotes,
  scheduleInterview,
  sendManagerMessage,
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
  const app = await getCompanyApplication(user.companyId, applicationId);
  await saveManagerNotes(
    user.companyId,
    applicationId,
    String(formData.get("notes") ?? "")
  );
  try {
    await createAuditLog({
      companyId: user.companyId,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "NOTA_SALVA",
      entityType: "CANDIDATURA",
      entityId: applicationId,
      entityLabel: app?.name,
      metadata: { jobTitle: app?.job.title },
    });
  } catch { /* auditoria nunca bloqueia a ação principal */ }
  revalidatePath(`/candidaturas/${applicationId}`);
  return { saved: true };
}

export type InterviewState = { error: string } | { ok: true } | null;

/** Combina a conversa com o candidato (move para Entrevista e avisa). */
export async function scheduleInterviewAction(
  applicationId: string,
  _prev: InterviewState,
  formData: FormData
): Promise<InterviewState> {
  const user = await requireManager();
  const parsed = interviewSchema.safeParse({
    at: formData.get("at"),
    mode: formData.get("mode"),
    location: formData.get("location") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const result = await scheduleInterview(user.companyId, applicationId, {
    at: new Date(parsed.data.at),
    mode: parsed.data.mode,
    location: parsed.data.location.trim() || null,
  });
  if (!result.ok) return { error: "Candidatura não encontrada." };
  try {
    const app = await getCompanyApplication(user.companyId, applicationId);
    await createAuditLog({
      companyId: user.companyId,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "ENTREVISTA_AGENDADA",
      entityType: "CANDIDATURA",
      entityId: applicationId,
      entityLabel: app?.name,
      metadata: {
        jobTitle: app?.job.title,
        at: parsed.data.at,
        mode: parsed.data.mode,
        location: parsed.data.location || null,
      },
    });
  } catch { /* auditoria nunca bloqueia a ação principal */ }
  revalidatePath(`/candidaturas/${applicationId}`);
  revalidatePath("/candidaturas");
  revalidatePath("/painel");
  return { ok: true };
}

/** Recado do gestor para o candidato (novidade no site + e-mail). */
export async function sendMessageAction(
  applicationId: string,
  _prev: InterviewState,
  formData: FormData
): Promise<InterviewState> {
  const user = await requireManager();
  const message = String(formData.get("message") ?? "").trim();
  if (message.length < 2) return { error: "Escreva o recado antes de enviar." };
  const result = await sendManagerMessage(
    user.companyId,
    applicationId,
    message
  );
  if (!result.ok) return { error: "Não foi possível enviar o recado." };
  try {
    const app = await getCompanyApplication(user.companyId, applicationId);
    await createAuditLog({
      companyId: user.companyId,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "RECADO_ENVIADO",
      entityType: "CANDIDATURA",
      entityId: applicationId,
      entityLabel: app?.name,
      metadata: { jobTitle: app?.job.title, preview: message.slice(0, 80) },
    });
  } catch { /* auditoria nunca bloqueia a ação principal */ }
  revalidatePath(`/candidaturas/${applicationId}`);
  return { ok: true };
}

export type SuggestMessageResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

const TOPICS: Record<string, string> = {
  entrevista: "convocar para entrevista (informar que gostou do perfil e quer marcar uma conversa)",
  documentos: "solicitar documentos (RG, CPF, comprovante de residência, etc.)",
  teste: "convidar para um teste técnico ou desafio prático",
  feedback: "dar um feedback positivo sobre a candidatura (sem ainda dar uma resposta definitiva)",
  informacoes: "pedir informações adicionais sobre experiência ou disponibilidade",
  proposta: "comunicar que a proposta foi aprovada e o candidato foi selecionado",
};

/** Gera sugestão de mensagem por IA baseada no assunto escolhido. */
export async function suggestMessageAction(
  applicationId: string,
  topicKey: string
): Promise<SuggestMessageResult> {
  const user = await requireManager();
  const app = await getCompanyApplication(user.companyId, applicationId);
  if (!app) return { ok: false, error: "Candidatura não encontrada." };

  const topicDescription = TOPICS[topicKey];
  if (!topicDescription) return { ok: false, error: "Assunto inválido." };

  const firstName = app.name.split(" ")[0];
  const companyName = app.company.name;
  const jobTitle = app.job.title;

  try {
    const text = await geminiGenerate({
      system: `Você é um especialista em RH redijindo mensagens para candidatos. Escreva sempre em português brasileiro. Tom: profissional, acolhedor e direto. Sem saudações genéricas (não use "Prezado(a)"). Comece pelo nome do candidato. Não use emojis. Máximo 4 linhas.`,
      prompt: `Escreva uma mensagem para ${firstName} que se candidatou à vaga de ${jobTitle} na empresa ${companyName}. Objetivo: ${topicDescription}.`,
      maxTokens: 300,
    });
    return { ok: true, text: text.trim() };
  } catch {
    return { ok: false, error: "Falha ao conectar com a IA. Tente novamente." };
  }
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
  const statusLabels = {
    PENDING: "Triagem",
    INTERVIEW: "Entrevista",
    APPROVED: "Aprovado",
    REJECTED: "Reprovado",
  };
  try {
    const app = await getCompanyApplication(user.companyId, applicationId);
    await createAuditLog({
      companyId: user.companyId,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "CANDIDATURA_STATUS_ALTERADO",
      entityType: "CANDIDATURA",
      entityId: applicationId,
      entityLabel: app?.name,
      metadata: {
        jobTitle: app?.job.title,
        novoStatus: statusLabels[status],
      },
    });
  } catch { /* auditoria nunca bloqueia a ação principal */ }
  revalidatePath("/candidaturas");
  revalidatePath(`/candidaturas/${applicationId}`);
  revalidatePath("/painel");
  const refreshed = await getCompanyApplication(user.companyId, applicationId);
  if (refreshed) revalidatePath(`/vagas/${refreshed.job.id}`);
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
