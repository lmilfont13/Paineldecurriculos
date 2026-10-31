"use server";

import { revalidatePath } from "next/cache";

import { runInBackground } from "@/lib/background";
import { geminiGenerate } from "@/lib/gemini";
import { requireManager } from "@/server/controllers/guards";
import {
  applicationInputSchema,
  type SubmitApplicationResult,
} from "@/server/models/application.model";
import { interviewSchema } from "@/server/models/interview.model";
import { rejectionMessage } from "@/server/models/message-templates.model";
import { INFO_FIELDS, type InfoField } from "@/server/models/pre-interview.model";
import { createAuditLog } from "@/server/repositories/audit.repository";
import {
  deleteCompanyApplications,
  extractApplicationPhoto,
  extractPhotosBulk,
  searchCompanyApplicationIds,
  getApplicationSummaries,
  getCompanyApplication,
  requestApplicationResumeUpload,
  requestApplicationInfo,
  requestReanalysis,
  saveInfoAnswers,
  saveManagerNotes,
  scheduleInterview,
  sendManagerMessage,
  setApplicationStatus,
  submitApplication,
  type CandidateSummary,
} from "@/server/services/application.service";

export { type CandidateSummary };
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

  // Negativa: texto fixo (sem IA), para o gestor revisar e enviar.
  if (topicKey === "negativa") {
    return {
      ok: true,
      text: rejectionMessage(app.name, app.company.name, app.job.title),
    };
  }

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

/** Re-extrai a foto do currículo sem re-rodar a análise de IA. */
export async function reextractPhotoAction(
  applicationId: string
): Promise<{ ok: boolean; message: string }> {
  const user = await requireManager();
  const found = await extractApplicationPhoto(user.companyId, applicationId);
  revalidatePath(`/candidaturas/${applicationId}`);
  return found
    ? { ok: true, message: "Foto extraída com sucesso." }
    : { ok: false, message: "Nenhuma foto encontrada no currículo." };
}

/** Extrai fotos em lote: dos ids selecionados, ou de todos que ainda não têm foto. */
export async function extractPhotosBulkAction(
  applicationIds?: string[]
): Promise<{ processed: number; found: number }> {
  const user = await requireManager();
  const ids = applicationIds?.length ? applicationIds.slice(0, 100) : undefined;
  const result = await extractPhotosBulk(user.companyId, ids);
  revalidatePath("/candidaturas");
  return result;
}

/** Busca por conteúdo (nome, e-mail, perfil e texto do currículo). */
export async function searchCandidatesAction(term: string): Promise<string[]> {
  const user = await requireManager();
  return searchCompanyApplicationIds(user.companyId, String(term ?? ""));
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
  const updated = await setApplicationStatus(user.companyId, applicationId, status);
  const statusLabels = {
    PENDING: "Triagem",
    INTERVIEW: "Entrevista",
    APPROVED: "Aprovado",
    REJECTED: "Reprovado",
  };
  if (updated) {
    // Auditoria é importante, mas nunca deve aumentar o tempo percebido
    // da ação principal.
    runInBackground("auditoria de status", async () => {
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
    });
  }
  revalidatePath("/candidaturas");
  revalidatePath(`/candidaturas/${applicationId}`);
  revalidatePath("/painel");
  if (updated) revalidatePath(`/vagas/${updated.jobId}`);
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
    birthDate: formData.get("birthDate") || undefined,
    city: formData.get("city") || undefined,
    state: formData.get("state") || undefined,
    neighborhood: formData.get("neighborhood") || undefined,
    desiredRole: formData.get("desiredRole") || undefined,
    salaryExpectation: formData.get("salaryExpectation") || undefined,
    workPreference: formData.get("workPreference") || undefined,
    availability: formData.get("availability") || undefined,
    hasCnh: formData.get("hasCnh") || undefined,
    isPcd: formData.get("isPcd") === "true",
    pcdDetails: formData.get("pcdDetails") || undefined,
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

  const resumePath = String(formData.get("resumePath") ?? "").trim();
  return submitApplication(
    company.id,
    candidate,
    parsed.data,
    resumePath || null
  );
}

/**
 * Regra 5: destino assinado para o navegador subir o PDF direto no Storage
 * (sem passar pelo limite de corpo das funções da Vercel).
 */
export async function requestResumeUploadAction(
  slug: string,
  jobId: string
): Promise<
  { ok: true; path: string; token: string } | { ok: false; error: string }
> {
  const candidate = await getSessionCandidate();
  if (!candidate) {
    return { ok: false, error: "Sua sessão expirou. Entre novamente." };
  }
  const company = await getPublicCompanyBySlug(slug);
  if (!company) return { ok: false, error: "Empresa não encontrada." };

  const target = await requestApplicationResumeUpload(
    company.id,
    jobId,
    candidate.id
  );
  if (!target) {
    return {
      ok: false,
      error: "Não foi possível preparar o envio do currículo. Tente novamente.",
    };
  }
  return { ok: true, ...target };
}

export type CandidateReportResult =
  | { ok: true; reports: CandidateSummary[] }
  | { ok: false; error: string };

/** Relatório gerencial: resumos de candidatos selecionados para a diretoria. */
export async function generateCandidatesReportAction(
  applicationIds: string[]
): Promise<CandidateReportResult> {
  if (!applicationIds.length) return { ok: false, error: "Nenhum candidato selecionado." };
  const user = await requireManager();
  const reports = await getApplicationSummaries(user.companyId, applicationIds);
  return { ok: true, reports };
}

/**
 * Exclui candidaturas (detalhe ou ação em massa). Definitivo: some do
 * painel, das contagens e da área do candidato. Fica registrado na auditoria.
 */
export async function deleteApplicationsAction(
  applicationIds: string[]
): Promise<{ deleted: number }> {
  const user = await requireManager();
  const { deleted } = await deleteCompanyApplications(
    user.companyId,
    applicationIds
  );

  runInBackground("auditoria de exclusão", async () => {
    for (const app of deleted) {
      await createAuditLog({
        companyId: user.companyId,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        action: "CANDIDATURA_EXCLUIDA",
        entityType: "CANDIDATURA",
        entityId: app.id,
        entityLabel: app.name,
        metadata: { jobTitle: app.jobTitle },
      }).catch(() => {});
    }
  });

  revalidatePath("/candidaturas");
  revalidatePath("/painel");
  revalidatePath("/vagas");
  revalidatePath("/agentes");
  return { deleted: deleted.length };
}

/** Pré-entrevista: o gestor escolhe o que pedir; o candidato é avisado (site + e-mail). */
export async function requestInfoAction(
  applicationId: string,
  fields: string[]
): Promise<{ ok: true } | { error: string }> {
  const user = await requireManager();
  const valid = fields.filter((f): f is InfoField =>
    (INFO_FIELDS as readonly string[]).includes(f)
  );
  const result = await requestApplicationInfo(user.companyId, applicationId, valid);
  if (!result.ok) return { error: result.error };
  try {
    const app = await getCompanyApplication(user.companyId, applicationId);
    await createAuditLog({
      companyId: user.companyId,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "INFO_SOLICITADA",
      entityType: "CANDIDATURA",
      entityId: applicationId,
      entityLabel: app?.name,
      // só as chaves pedidas, nunca valores
      metadata: { jobTitle: app?.job.title, fields: valid },
    });
  } catch { /* auditoria nunca bloqueia a ação principal */ }
  revalidatePath(`/candidaturas/${applicationId}`);
  return { ok: true };
}

/** Resposta do candidato ao formulário de pré-entrevista (só a candidatura dele). */
export async function submitInfoAnswersAction(
  slug: string,
  applicationId: string,
  _prev: InterviewState,
  formData: FormData
): Promise<InterviewState> {
  const candidate = await getSessionCandidate();
  if (!candidate) return { error: "Sua sessão expirou. Entre novamente." };

  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : undefined;
  };
  const children = text("hasChildren");
  const count = text("childrenCount");
  const result = await saveInfoAnswers(candidate.id, applicationId, {
    maritalStatus: text("maritalStatus"),
    hasChildren: children === "sim" ? true : children === "nao" ? false : undefined,
    childrenCount: count ? Number(count) : undefined,
    professionalSummary: text("professionalSummary"),
    rg: text("rg"),
    cpf: text("cpf"),
  });
  if (!result.ok) return { error: result.error };
  revalidatePath(`/${slug}/minhas-candidaturas/${applicationId}`);
  revalidatePath(`/candidaturas/${applicationId}`);
  return { ok: true };
}

/** Gestor pede para ver RG/CPF sem máscara; cada abertura fica na auditoria. */
export async function revealSensitiveInfoAction(
  applicationId: string
): Promise<{ rg: string | null; cpf: string | null } | null> {
  const user = await requireManager();
  const app = await getCompanyApplication(user.companyId, applicationId);
  if (!app) return null;
  try {
    await createAuditLog({
      companyId: user.companyId,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "DADOS_SENSIVEIS_VISTOS",
      entityType: "CANDIDATURA",
      entityId: applicationId,
      entityLabel: app.name,
    });
  } catch { /* auditoria nunca bloqueia a ação principal */ }
  return { rg: app.rg, cpf: app.cpf };
}
