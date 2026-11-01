import type { AppStatus } from "@prisma/client";
import { replyToEmail } from "@/server/models/company.model";
import "server-only";

import { runInBackground } from "@/lib/background";
import { createAdminClient } from "@/lib/supabase/admin";
import { trySendEvent } from "@/lib/inngest";
import { getCompanyById } from "@/server/services/company.service";
import {
  applicationResumePrefix,
  isAllowedResumePath,
  isDemoResumePath,
  profileResumePrefix,
  type ApplicationInput,
  type ResumeUploadTarget,
  type SubmitApplicationResult,
} from "@/server/models/application.model";
import type { CandidateProfile } from "@/server/models/candidate.model";
import {
  countApplicationsByCompany,
  createAgentRun,
  createApplication,
  createStatusEvent,
  deleteApplication,
  findActiveAgentRuns,
  findAiStates,
  getAgentCenterData,
  findAppliedJobIds,
  findApplicationByCandidateAndJob,
  findApplicationById,
  findApplicationForCandidate,
  findApplicationsByCandidate,
  findApplicationsByCompany,
  findApplicationsByIds,
  findLatestApplicationWithAnswers,
  completePreRegisteredApplication,
  updateApplicationResume,
  updateAgentRun,
  updateApplicationAi,
  updateApplicationStatus,
  updateInterview,
  updateInfoRequest,
  findOtherApplicationsByEmail,
  updateInfoAnswers,
  updateManagerNotes,
  searchApplicationIds,
  updateApplicationResumeText,
  findApplicationsForCvSearch,
} from "@/server/repositories/application.repository";
import { formatInterviewAt } from "@/server/models/interview.model";
import { titleCasePt } from "@/server/models/text.model";
import {
  buildInfoAnswerSchema,
  knownInfoOf,
  pendingRequestedFields,
  type InfoField,
} from "@/server/models/pre-interview.model";
import {
  describeDelivery,
  reachedCandidate,
  type DeliveryReport,
  type EmailOutcome,
  type SiteOutcome,
} from "@/server/models/communication.model";
import {
  notifyApplicationReceived,
  notifyInfoRequested,
  notifyInterviewScheduled,
  notifyManagerMessage,
  notifyStageChange,
} from "@/server/services/notification.service";
import { findManagerByCompanyId, findUserByEmail } from "@/server/repositories/user.repository";
import { createCandidate, findCandidateByEmail } from "@/server/repositories/candidate.repository";
import { updateCandidateProfile } from "@/server/services/candidate.service";
import {
  sendApplicationConfirmation,
  sendInfoRequestEmail,
  sendInterviewScheduledEmail,
  sendManagerMessageEmail,
  sendNewApplicationNotification,
  sendStatusUpdateEmail,
  type EmailBrand,
} from "@/server/services/email.service";
import { findFieldsForJob } from "@/server/services/form.service";
import { findJobById } from "@/server/repositories/job.repository";
import { findAgeSourcesForCompany, findAgeSourcesForJob, updateAnswerValues } from "@/server/repositories/application.repository";
import { effectiveAge } from "@/server/models/age.model";
import { cepDigits } from "@/server/models/address.model";
import { parseAdmissionInput } from "@/server/models/admission.model";
import {
  extractResumeContact,
  generateCandidateSummary,
  loadResumeBytes,
  readResumeText,
  runTriageWithTracking,
  type CandidateSummary,
} from "@/server/services/ai.service";

export { type CandidateSummary };
import {
  BATCH_RESUME_LIMIT,
  batchResumePrefix,
  findContacts,
  guessName,
  isValidEmail,
} from "@/server/models/intake.model";
import {
  captureResumePhoto,
  removeResumePhotos,
  withPhotoUrls,
} from "@/server/services/resume-photo.service";
import { activeRunsSignature } from "@/server/models/simulation.model";
import { sweepStaleAgentRunsThrottled } from "@/server/services/agent-watchdog.service";
import {
  RESUMES_BUCKET,
  createResumeUploadTarget,
  verifyUploadedResume,
} from "@/server/services/resume-storage.service";

/** Para o candidato, quem escreve é a empresa: nome, símbolo e cor dela. */
function emailBrand(company: {
  name: string;
  slug: string;
  primaryColor: string;
  logoUrl: string | null;
  senderEmail?: string | null;
}): EmailBrand {
  return {
    name: company.name,
    slug: company.slug,
    primaryColor: company.primaryColor,
    senderEmail: company.senderEmail,
    logoUrl: company.logoUrl,
  };
}

/** Contagem de candidaturas pendentes (badge da sidebar do gestor). */
export function countPendingApplications(companyId: string): Promise<number> {
  return countApplicationsByCompany(companyId, { status: "PENDING" });
}

/** Lista de candidaturas do tenant (E3), com filtro opcional por vaga. */
export async function listCompanyApplications(
  companyId: string,
  jobId?: string
) {
  const applications = await findApplicationsByCompany(companyId);
  return jobId
    ? applications.filter((a) => a.job.id === jobId)
    : applications;
}

/** Idade (só para exibir e filtrar) de cada candidato de uma vaga, por id da candidatura. */
export async function listJobApplicantAges(companyId: string, jobId: string) {
  const rows = await findAgeSourcesForJob(companyId, jobId);
  return Object.fromEntries(rows.map((r) => [r.id, effectiveAge(r.birthDate, r.resumeText)])) as Record<string, number | null>;
}

/** Idade (só para exibir) de cada candidatura da empresa, por id. */
export async function listCompanyApplicantAges(companyId: string) {
  const rows = await findAgeSourcesForCompany(companyId);
  return Object.fromEntries(rows.map((r) => [r.id, effectiveAge(r.birthDate, r.resumeText)])) as Record<string, number | null>;
}

/** Busca avançada de CVs (nível Michelin): lista enriquecida com fotos assinadas e respostas. */
export async function listApplicationsForCvSearch(companyId: string) {
  const raw = await findApplicationsForCvSearch(companyId);
  return withPhotoUrls(raw);
}

/** Detalhe da candidatura (E4) — sempre valida a posse pelo tenant. */
export async function getCompanyApplication(companyId: string, id: string) {
  const application = await findApplicationById(id);
  if (!application || application.companyId !== companyId) return null;
  return application;
}

/**
 * Mudança de status — SEMPRE decisão manual do gestor (regra 2).
 * A IA jamais chama esta função. Q2: o candidato é avisado por e-mail
 * (fire-and-forget) quando o status muda.
 */
export async function setApplicationStatus(
  companyId: string,
  id: string,
  status: AppStatus
) {
  const application = await getCompanyApplication(companyId, id);
  if (!application) return null;
  const updated = await updateApplicationStatus(id, status);

  if (status !== application.status) {
    await createStatusEvent({
      applicationId: id,
      from: application.status,
      to: status,
      actor: "gestor",
    });
  }

  if (status !== application.status) {
    // O gestor não espera e-mail/notificação: o evento é processado em
    // background. O fallback em after() mantém a comunicação funcionando
    // enquanto o Inngest de produção não estiver configurado.
    const queued = await trySendEvent({
      name: "application/status-changed",
      data: { applicationId: id, status },
    });
    if (!queued) {
      runInBackground("comunicar mudança de status", () =>
        communicateStatusChange(id, status)
      );
    }
  }
  return updated;
}

type StageStatus = AppStatus;

/**
 * Comunicação pós-mudança de status: novidade no portal e e-mail. Devolve o
 * que aconteceu em cada canal (o e-mail pode "sair" e não chegar, quando o
 * remetente ainda é o de teste do Resend).
 */
export async function notifyApplicationStatusChange(
  applicationId: string,
  status: StageStatus
): Promise<DeliveryReport | null> {
  const application = await findApplicationById(applicationId);
  if (!application) return null;

  // Roda dentro do job do Inngest ou de um after(): aqui dá para (e é
  // preciso) esperar, senão a função termina antes do e-mail sair.
  const [site, email] = await Promise.allSettled([
    notifyStageChange({
      candidateId: application.candidateId,
      applicationId,
      to: status,
      companyName: application.company.name,
      jobTitle: application.job.title,
    }),
    // Etapas internas (triagem, "passou da triagem") só viram novidade no portal; e-mail é para entrevista e resultado.
    status !== "PENDING" && status !== "SHORTLISTED" && application.email.includes("@")
      ? sendStatusUpdateEmail({
          brand: emailBrand(application.company),
          to: application.email,
          candidateName: application.name,
          jobTitle: application.job.title,
          status,
          applicationId,
        })
      : Promise.resolve<EmailOutcome>("none"),
  ]);

  const siteOutcome: SiteOutcome =
    site.status === "rejected" ? "failed" : site.value ? "ok" : "no-account";
  const emailOutcome: EmailOutcome =
    email.status === "rejected" ? "failed" : email.value;
  return { site: siteOutcome, email: emailOutcome };
}

/**
 * Agente de Comunicação com rastreio: registra a execução (AgentRun) com o
 * resultado de cada canal. Usado pelo job do Inngest e pelo plano B.
 */
export async function communicateStatusChange(
  applicationId: string,
  status: StageStatus,
  options: { eventName?: string; rethrow?: boolean } = {}
) {
  const application = await findApplicationById(applicationId);
  if (!application) return;
  if (application.isDemo) return; // simulação: nunca fala com ninguém

  const run = await createAgentRun({
    companyId: application.company.id,
    applicationId,
    agent: "COMMUNICATION",
    eventName: options.eventName ?? "application/status-changed",
  });
  const startedAt = new Date();
  await updateAgentRun(run.id, { status: "RUNNING", attempts: 1, startedAt });

  try {
    const report = await notifyApplicationStatusChange(applicationId, status);
    const ok = !!report && reachedCandidate(report);
    await updateAgentRun(run.id, {
      // Nada chegou ao candidato: fica como falha, para o gestor ver.
      status: ok || !report ? "SUCCEEDED" : "FAILED",
      summary: report
        ? describeDelivery(status, report)
        : "Candidatura não encontrada.",
      error: ok || !report ? undefined : "Nenhum canal chegou ao candidato.",
      durationMs: Date.now() - startedAt.getTime(),
      finishedAt: new Date(),
    });
  } catch (error) {
    await updateAgentRun(run.id, {
      status: "FAILED",
      error:
        error instanceof Error
          ? error.message.slice(0, 500)
          : "Falha desconhecida.",
      durationMs: Date.now() - startedAt.getTime(),
      finishedAt: new Date(),
    });
    if (options.rethrow) throw error;
  }
}

/** Respostas da última candidatura na empresa — pré-preenche extras (CA3). */
export async function getPrefillAnswers(
  candidateId: string,
  companyId: string
): Promise<Record<string, string>> {
  const latest = await findLatestApplicationWithAnswers(candidateId, companyId);
  if (!latest) return {};
  return Object.fromEntries(latest.answers.map((a) => [a.fieldId, a.value]));
}

/** Candidaturas do candidato em todas as empresas (CA4). */
export function listCandidateApplications(candidateId: string) {
  return findApplicationsByCandidate(candidateId);
}

/** IDs de vagas em que o candidato já se candidatou (para lista pública). */
export function getAppliedJobIds(candidateId: string, jobIds: string[]) {
  return findAppliedJobIds(candidateId, jobIds);
}

/** Já existe candidatura deste candidato nesta vaga? (detecção precoce) */
export async function getExistingApplicationId(
  candidateId: string,
  jobId: string
): Promise<string | null> {
  const existing = await findApplicationByCandidateAndJob(candidateId, jobId);
  // Cadastro rápido do gestor ainda não conta: o candidato precisa completar.
  if (!existing || existing.preRegistered) return null;
  return existing.id;
}

/**
 * Re-extrai a foto do currículo sem re-rodar a análise de IA. Útil para
 * candidatos já analisados cujo currículo tem foto mas ela não foi capturada
 * (ex.: antes do relaxamento dos filtros de proporção). Não toca em aiState.
 */
export async function extractApplicationPhoto(
  companyId: string,
  applicationId: string
): Promise<boolean> {
  const application = await getCompanyApplication(companyId, applicationId);
  if (!application?.resumeUrl) return false;
  const { getDocumentProxy, extractText } = await import("unpdf");
  const pdf = await getDocumentProxy(await loadResumeBytes(application.resumeUrl));
  // Aproveita a leitura do PDF para indexar o texto (busca por conteúdo).
  if (!application.resumeText) {
    try {
      const text = (await extractText(pdf, { mergePages: true })).text.trim();
      if (text) await updateApplicationResumeText(applicationId, text.slice(0, 100_000));
    } catch (error) {
      console.error("[busca] Não foi possível indexar o texto do currículo:", error);
    }
  }
  return captureResumePhoto(pdf, {
    companyId,
    applicationId,
    currentPath: application.photoPath ?? null,
  });
}

/**
 * Extrai fotos (e indexa o texto) de várias candidaturas do tenant, em série
 * para não estourar memória/conexões. Sem ids = todas com PDF e sem foto.
 */
export async function extractPhotosBulk(
  companyId: string,
  ids?: string[]
): Promise<{ processed: number; found: number }> {
  const all = await findApplicationsByCompany(companyId);
  const targets = all
    .filter((a) => a.resumeUrl && (ids ? ids.includes(a.id) : !a.photoPath))
    .slice(0, 40);
  let found = 0;
  for (const app of targets) {
    try {
      if (await extractApplicationPhoto(companyId, app.id)) found += 1;
    } catch (error) {
      console.error("[foto] Falha em lote:", app.id, error);
    }
  }
  return { processed: targets.length, found };
}

/** Busca por nome, e-mail, perfil e conteúdo do currículo (sempre do tenant). */
export async function searchCompanyApplicationIds(companyId: string, term: string) {
  const q = term.trim();
  if (q.length < 2) return [];
  return searchApplicationIds(companyId, q.slice(0, 100));
}

/**
 * Reenfileira a análise de IA (gestor, para FAILED/NO_RESUME). Continua
 * respeitando a regra 2: só aiState muda aqui; o job em background faz o resto.
 */
/** O gestor corrige respostas que o candidato errou. Só mexe em respostas desta candidatura. */
export async function correctApplicationAnswers(
  companyId: string,
  id: string,
  values: Record<string, string>
): Promise<{ ok: true; changed: string[] } | { ok: false; error: string }> {
  const application = await getCompanyApplication(companyId, id);
  if (!application) return { ok: false, error: "Candidatura não encontrada." };

  const current = new Map(application.answers.map((a) => [a.id, a]));
  const updates: { id: string; value: string }[] = [];
  const changed: string[] = [];
  for (const [answerId, raw] of Object.entries(values)) {
    const answer = current.get(answerId);
    if (!answer) continue;
    const value = raw.trim().slice(0, 2000);
    if (!value) return { ok: false, error: `A resposta de "${answer.field.label}" não pode ficar vazia.` };
    if (value === answer.value) continue;
    updates.push({ id: answerId, value });
    changed.push(answer.field.label);
  }
  if (updates.length > 0) await updateAnswerValues(id, updates);
  return { ok: true, changed };
}

export async function requestReanalysis(
  companyId: string,
  id: string
): Promise<{ ok: boolean }> {
  const application = await getCompanyApplication(companyId, id);
  if (!application) return { ok: false };
  await updateApplicationAi(id, { aiState: "WAITING" });
  enqueueTriage(id);
  return { ok: true };
}

/**
 * Combina a conversa: move para Entrevista se ainda não estiver, grava a
 * trilha, avisa o candidato dentro do site e por e-mail. É o momento em que
 * as duas personas se encontram — por isso tudo acontece num ato só, em vez
 * de o gestor mudar o status aqui e combinar o horário por fora.
 */
export async function scheduleInterview(
  companyId: string,
  id: string,
  input: { at: Date; mode: string; location: string | null }
): Promise<{ ok: boolean }> {
  const application = await getCompanyApplication(companyId, id);
  if (!application) return { ok: false };

  const wasInterview = application.status === "INTERVIEW";
  await updateInterview(id, {
    interviewAt: input.at,
    interviewMode: input.mode,
    interviewLocation: input.location,
    ...(wasInterview ? {} : { status: "INTERVIEW" as const }),
  });

  if (!wasInterview) {
    await createStatusEvent({
      applicationId: id,
      from: application.status,
      to: "INTERVIEW",
      actor: "gestor",
    });
  }

  const company = await getCompanyById(companyId);
  if (!company) return { ok: true };
  const when = formatInterviewAt(input.at);

  runInBackground("avisar entrevista marcada", async () => {
    await notifyInterviewScheduled({
      candidateId: application.candidateId,
      applicationId: id,
      companyName: company.name,
      jobTitle: application.job.title,
      when,
      mode: input.mode,
      location: input.location,
    }).catch((e) => console.error("[notificação] entrevista:", e));

    if (application.email.includes("@")) {
      const manager = await findManagerByCompanyId(companyId);
      await sendInterviewScheduledEmail({
        brand: emailBrand(company),
        to: application.email,
        candidateName: application.name,
        jobTitle: application.job.title,
        when,
        mode: input.mode,
        location: input.location,
        managerEmail: replyToEmail(company.email, manager?.email),
        applicationId: id,
      });
    }
  });
  return { ok: true };
}

/** Recado do gestor ao candidato — vira novidade no site e e-mail. */
export async function sendManagerMessage(
  companyId: string,
  id: string,
  message: string,
  subject?: string
): Promise<{ ok: boolean }> {
  const text = message.trim();
  const application = await getCompanyApplication(companyId, id);
  if (!application || text.length === 0) return { ok: false };

  const company = await getCompanyById(companyId);
  if (!company) return { ok: false };

  runInBackground("enviar recado do gestor", async () => {
    await notifyManagerMessage({
      candidateId: application.candidateId,
      applicationId: id,
      companyName: company.name,
      jobTitle: application.job.title,
      message: text,
      subject,
    }).catch((e) => console.error("[notificação] recado:", e));

    if (application.email.includes("@")) {
      const manager = await findManagerByCompanyId(companyId);
      await sendManagerMessageEmail({
        brand: emailBrand(company),
        to: application.email,
        candidateName: application.name,
        jobTitle: application.job.title,
        message: text,
        subject,
        managerEmail: replyToEmail(company.email, manager?.email),
        applicationId: id,
      });
    }
  });
  return { ok: true };
}

/** Notas internas do gestor sobre a candidatura. */
export async function saveManagerNotes(
  companyId: string,
  id: string,
  notes: string
) {
  const application = await getCompanyApplication(companyId, id);
  if (!application) return null;
  return updateManagerNotes(id, notes.trim() || null);
}

/** Detalhe da candidatura na visão do candidato (timeline, respostas). */
export function getCandidateApplication(
  candidateId: string,
  applicationId: string
) {
  return findApplicationForCandidate(candidateId, applicationId);
}

/**
 * Candidato retira a candidatura: apaga o registro (e respostas/eventos em
 * cascata). Currículo enviado só para esta vaga sai do Storage; o do perfil
 * (path profile/…) é preservado.
 */
export async function withdrawApplication(
  candidateId: string,
  applicationId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const application = await findApplicationForCandidate(
    candidateId,
    applicationId
  );
  if (!application) return { ok: false, error: "Candidatura não encontrada." };

  if (
    application.resumeUrl &&
    !application.resumeUrl.startsWith("profile/") &&
    !isDemoResumePath(application.resumeUrl)
  ) {
    const supabase = createAdminClient();
    await supabase.storage.from(RESUMES_BUCKET).remove([application.resumeUrl]);
  }
  if (application.photoPath) await removeResumePhotos([application.photoPath]);
  await deleteApplication(applicationId);
  return { ok: true };
}

/** URL assinada do currículo, na visão do candidato (posse verificada). */
export async function getCandidateResumeSignedUrl(
  candidateId: string,
  resumePath: string | null
): Promise<string | null> {
  if (!resumePath) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(RESUMES_BUCKET)
    .createSignedUrl(resumePath, 600);
  return error ? null : data.signedUrl;
}

/** URL assinada (10 min) para baixar o currículo do Storage privado. */
export async function getResumeSignedUrl(
  companyId: string,
  applicationId: string
): Promise<string | null> {
  const application = await getCompanyApplication(companyId, applicationId);
  if (!application?.resumeUrl) return null;

  // Demo: arquivo estático de /public. Caminho relativo — a rota monta a
  // URL absoluta a partir do próprio request (não depende de
  // NEXT_PUBLIC_APP_URL estar certa).
  if (isDemoResumePath(application.resumeUrl)) {
    return `/${application.resumeUrl}`;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(RESUMES_BUCKET)
    .createSignedUrl(application.resumeUrl, 600);
  if (error) return null;
  return data.signedUrl;
}

/**
 * Enfileira a triagem da IA. Com o Inngest configurado, vai como evento (com
 * retries). Sem ele — ou se o envio falhar — roda em after(), depois da
 * resposta, para a candidatura nunca ficar presa em "Aguardando análise".
 */
export function enqueueTriage(applicationId: string): void {
  runInBackground("enfileirar triagem", async () => {
    const queued = await trySendEvent({
      name: "application/submitted",
      data: { applicationId },
    });
    if (!queued) {
      await runTriageWithTracking(applicationId, {
        eventName: "application/submitted (fallback)",
        maxAttempts: 3,
      });
    }
  });
}

/**
 * Regra 5: URL assinada para o navegador subir o PDF direto no Storage.
 * Só para vaga aberta da própria empresa; o caminho inclui o candidato,
 * e o envio da candidatura só aceita caminhos com esse prefixo.
 */
export async function requestApplicationResumeUpload(
  companyId: string,
  jobId: string,
  candidateId: string
): Promise<ResumeUploadTarget | null> {
  const job = await findJobById(jobId);
  if (!job || job.companyId !== companyId || job.status !== "OPEN") return null;
  return createResumeUploadTarget(
    applicationResumePrefix(companyId, jobId, candidateId)
  );
}

/**
 * Regra 2: a candidatura é salva e respondida imediatamente — a análise de IA
 * roda depois, em background, e nunca bloqueia o candidato.
 * A IA só escreve aiScore/aiReasoning/aiState; AppStatus é decisão do gestor.
 *
 * CA1/CA2/CA6: exige candidato logado, impede candidatura duplicada e
 * salva os dados básicos no perfil para reaproveitar nas próximas vagas.
 *
 * Regra 5: o PDF já foi enviado pelo navegador direto ao Storage
 * (requestApplicationResumeUpload); aqui chega só o caminho, que é validado.
 */
export async function submitApplication(
  companyId: string,
  candidate: CandidateProfile,
  input: Omit<ApplicationInput, "slug">,
  uploadedResumePath: string | null
): Promise<SubmitApplicationResult> {
  const job = await findJobById(input.jobId);
  if (!job || job.companyId !== companyId || job.status !== "OPEN") {
    return { ok: false, error: "Esta vaga não está mais aberta." };
  }

  const existing = await findApplicationByCandidateAndJob(candidate.id, job.id);
  if (existing && !existing.preRegistered) {
    return { ok: false, error: "Você já se candidatou a esta vaga." };
  }

  // Valida respostas contra os campos definidos pela empresa
  const fields = await findFieldsForJob(companyId, job.id);
  const fieldById = new Map(fields.map((f) => [f.id, f]));
  const answers: { fieldId: string; value: string }[] = [];

  for (const [fieldId, value] of Object.entries(input.answers)) {
    if (!fieldById.has(fieldId)) continue; // ignora campo de outro tenant
    if (value.trim().length === 0) continue;
    answers.push({ fieldId, value: value.trim() });
  }

  const answered = new Set(answers.map((a) => a.fieldId));
  for (const field of fields) {
    if (field.required && field.type !== "FILE_UPLOAD" && !answered.has(field.id)) {
      return { ok: false, error: `Preencha o campo "${field.label}".` };
    }
  }

  // Admissão (opcional): em branco passa; preenchido precisa ser válido.
  const admissionParsed = parseAdmissionInput({
    rg: input.rg,
    cpf: input.cpf,
    bootSize: input.bootSize,
    pantsSize: input.pantsSize,
    shirtSize: input.shirtSize,
  });
  if (!admissionParsed.ok) return { ok: false, error: admissionParsed.error };

  // Sem arquivo novo, reaproveita o currículo salvo no perfil (CA3) ou o
  // que o gestor já anexou no cadastro rápido.
  let resumeUrl: string | null = candidate.resumeUrl ?? existing?.resumeUrl ?? null;
  if (uploadedResumePath) {
    const allowed =
      isAllowedResumePath(
        uploadedResumePath,
        applicationResumePrefix(companyId, job.id, candidate.id)
      ) ||
      isAllowedResumePath(uploadedResumePath, profileResumePrefix(candidate.id));
    if (!allowed) {
      return { ok: false, error: "Currículo inválido. Envie o PDF novamente." };
    }
    const verified = await verifyUploadedResume(uploadedResumePath);
    if (!verified.ok) return verified;
    resumeUrl = uploadedResumePath;
  }

  // Currículo é obrigatório: novo, do perfil ou o que o gestor já anexou.
  if (!resumeUrl) {
    return { ok: false, error: "Anexe seu currículo em PDF para se candidatar." };
  }

  const rawBirthDate = input.birthDate;
  const birthDate = rawBirthDate
    ? new Date(rawBirthDate)
    : candidate.birthDate ?? null;
  const city = input.city ?? candidate.city ?? null;
  const state = input.state ?? candidate.state ?? null;
  const neighborhood = input.neighborhood ?? candidate.neighborhood ?? null;
  const zipCode = cepDigits(input.zipCode ?? candidate.zipCode) || null;
  const street = input.street ?? candidate.street ?? null;
  const streetNumber = input.streetNumber ?? candidate.streetNumber ?? null;
  const complement = input.complement ?? candidate.complement ?? null;
  const rg = admissionParsed.data.rg ?? candidate.rg ?? null;
  const cpf = admissionParsed.data.cpf ?? candidate.cpf ?? null;
  const bootSize = admissionParsed.data.bootSize ?? candidate.bootSize ?? null;
  const pantsSize = admissionParsed.data.pantsSize ?? candidate.pantsSize ?? null;
  const shirtSize = admissionParsed.data.shirtSize ?? candidate.shirtSize ?? null;
  const desiredRole = input.desiredRole ?? candidate.desiredRole ?? null;
  const salaryExpectation = input.salaryExpectation ?? candidate.salaryExpectation ?? null;
  const workPreference = input.workPreference ?? candidate.workPreference ?? null;
  const availability = input.availability ?? candidate.availability ?? null;
  const hasCnh = input.hasCnh ?? candidate.hasCnh ?? null;
  const isPcd = input.isPcd ?? candidate.isPcd ?? false;
  const pcdDetails = input.pcdDetails ?? candidate.pcdDetails ?? null;

  // Cadastro rápido do gestor: o candidato completa a mesma candidatura
  // (mantém histórico e notas); senão, cria uma nova.
  const application = existing
    ? await completePreRegisteredApplication(existing.id, {
        name: titleCasePt(input.name),
        phone: input.phone || null,
        resumeUrl,
        birthDate,
        city,
        state,
        neighborhood,
        zipCode,
        street,
        streetNumber,
        complement,
        rg,
        cpf,
        bootSize,
        pantsSize,
        shirtSize,
        desiredRole,
        salaryExpectation,
        workPreference,
        availability,
        hasCnh,
        isPcd,
        pcdDetails,
        answers,
      })
    : await createApplication({
        jobId: job.id,
        companyId,
        candidateId: candidate.id,
        name: titleCasePt(input.name),
        email: candidate.email,
        phone: input.phone || null,
        resumeUrl,
        birthDate,
        city,
        state,
        neighborhood,
        zipCode,
        street,
        streetNumber,
        complement,
        rg,
        cpf,
        bootSize,
        pantsSize,
        shirtSize,
        desiredRole,
        salaryExpectation,
        workPreference,
        availability,
        hasCnh,
        isPcd,
        pcdDetails,
        // Toda candidatura entra na análise: com PDF, só com as respostas, ou as
        // duas coisas. A própria análise marca NO_RESUME se não houver material.
        aiState: "WAITING",
        answers,
      });

  // CA2: o que o candidato preencheu vira perfil para as próximas vagas
  await updateCandidateProfile(candidate.id, {
    name: titleCasePt(input.name),
    phone: input.phone || null,
    resumeUrl,
    birthDate,
    city,
    state,
    neighborhood,
    zipCode,
    street,
    streetNumber,
    complement,
    rg,
    cpf,
    bootSize,
    pantsSize,
    shirtSize,
    desiredRole,
    salaryExpectation,
    workPreference,
    availability,
    hasCnh,
    isPcd,
    pcdDetails,
  });

  // Timeline: registra o envio (primeiro evento da candidatura). No cadastro
  // rápido, o primeiro evento já foi gravado quando o gestor cadastrou.
  if (!existing) {
    await createStatusEvent({
      applicationId: application.id,
      from: null,
      to: "PENDING",
      actor: "candidato",
    }).catch(() => {});
  }

  // Regra 2: candidatura já salva — daqui pra baixo nada pode falhar o fluxo.
  enqueueTriage(application.id);

  runInBackground("avisos da nova candidatura", async () => {
    const company = await getCompanyById(companyId);
    if (!company) return;
    const manager = await findManagerByCompanyId(companyId);
    await Promise.allSettled([
      notifyApplicationReceived({
        candidateId: candidate.id,
        applicationId: application.id,
        companyName: company.name,
        jobTitle: job.title,
      }),
      sendApplicationConfirmation({
        brand: emailBrand(company),
        to: application.email,
        candidateName: application.name,
        jobTitle: job.title,
        applicationId: application.id,
      }),
      // G14: avisa o gestor da empresa
      manager
        ? sendNewApplicationNotification({
            brand: emailBrand(company),
            to: manager.email,
            candidateName: application.name,
            jobTitle: job.title,
            aiEnabled: true,
            applicationId: application.id,
          })
        : Promise.resolve(),
    ]);
  });

  return { ok: true, applicationId: application.id };
}

/**
 * Estado da IA de candidaturas do tenant + execuções de agente ativas, para o
 * polling leve da UI (substitui router.refresh() em loop). Aproveita a
 * consulta para rodar o watchdog de forma oportunista (no máx. 1×/min).
 */
export async function getAiProgress(companyId: string, ids: string[]) {
  await sweepStaleAgentRunsThrottled(companyId);
  const states = ids.length > 0 ? await findAiStates(companyId, ids) : [];
  const runs = await findActiveAgentRuns(companyId);
  return {
    states,
    activeRuns: runs.length,
    runsSignature: activeRunsSignature(runs),
  };
}

/** Central de agentes: varre execuções travadas antes de montar a tela. */
export async function getAgentCenter(companyId: string) {
  await sweepStaleAgentRunsThrottled(companyId);
  return getAgentCenterData(companyId);
}

/**
 * Exclusão definitiva de candidaturas pelo gestor. Regra 1: cada id é
 * conferido contra a empresa da sessão (id de outro tenant é ignorado).
 * Respostas, histórico, avisos e execuções de agente saem em cascata no
 * banco; o PDF enviado só para a vaga sai do Storage (o do perfil do
 * candidato e o de demonstração ficam). A conta do candidato não é apagada.
 */
export async function deleteCompanyApplications(
  companyId: string,
  ids: string[]
): Promise<{ deleted: { id: string; name: string; jobTitle: string }[] }> {
  const deleted: { id: string; name: string; jobTitle: string }[] = [];
  const resumePaths: string[] = [];

  for (const id of ids.slice(0, 100)) {
    const application = await getCompanyApplication(companyId, id);
    if (!application) continue;
    await deleteApplication(id);
    deleted.push({ id, name: application.name, jobTitle: application.job.title });
    if (
      application.resumeUrl &&
      !application.resumeUrl.startsWith("profile/") &&
      !isDemoResumePath(application.resumeUrl)
    ) {
      resumePaths.push(application.resumeUrl);
    }
    if (application.photoPath) resumePaths.push(application.photoPath);
  }

  if (resumePaths.length > 0) {
    runInBackground("remover currículos excluídos", async () => {
      const supabase = createAdminClient();
      await supabase.storage.from(RESUMES_BUCKET).remove(resumePaths);
    });
  }
  return { deleted };
}

/**
 * Cadastro rápido pelo gestor: só com o e-mail (nome e telefone opcionais)
 * cria o candidato e a candidatura na vaga, marcada como "incompleta". O
 * candidato completa depois pelo link da vaga, criando a senha com o mesmo
 * e-mail. Nada é analisado até ter currículo ou respostas.
 */
export async function preRegisterCandidates(
  companyId: string,
  jobId: string,
  entries: { email: string; name: string; phone: string | null }[]
): Promise<{
  jobTitle: string;
  created: { id: string; email: string; name: string; phone: string | null }[];
  skipped: { email: string; reason: string }[];
} | null> {
  const job = await findJobById(jobId);
  if (!job || job.companyId !== companyId) return null;

  const created: { id: string; email: string; name: string; phone: string | null }[] = [];
  const skipped: { email: string; reason: string }[] = [];

  for (const entry of entries) {
    if (await findUserByEmail(entry.email)) {
      skipped.push({ email: entry.email, reason: "é e-mail de alguém da equipe" });
      continue;
    }
    const candidate =
      (await findCandidateByEmail(entry.email)) ??
      (await createCandidate({ email: entry.email, name: entry.name, authId: null }));
    if (await findApplicationByCandidateAndJob(candidate.id, job.id)) {
      skipped.push({ email: entry.email, reason: "já está nesta vaga" });
      continue;
    }
    const application = await createApplication({
      jobId: job.id,
      companyId,
      candidateId: candidate.id,
      name: candidate.authId ? candidate.name : entry.name,
      email: entry.email,
      phone: entry.phone ?? candidate.phone ?? null,
      resumeUrl: candidate.resumeUrl ?? null,
      aiState: candidate.resumeUrl ? "WAITING" : "NO_RESUME",
      answers: [],
      preRegistered: true,
    });
    await createStatusEvent({
      applicationId: application.id,
      from: null,
      to: "PENDING",
      actor: "gestor",
    }).catch(() => {});
    // Quem já tinha currículo no perfil entra direto na análise.
    if (candidate.resumeUrl) enqueueTriage(application.id);
    created.push({ id: application.id, email: entry.email, name: application.name, phone: application.phone });
  }
  return { jobTitle: job.title, created, skipped };
}

/** URL assinada para o gestor anexar o PDF (ex.: currículo recebido por e-mail). */
export async function requestManagerResumeUpload(
  companyId: string,
  applicationId: string
): Promise<ResumeUploadTarget | null> {
  const application = await getCompanyApplication(companyId, applicationId);
  if (!application?.candidateId) return null;
  return createResumeUploadTarget(
    applicationResumePrefix(companyId, application.jobId, application.candidateId)
  );
}

/**
 * Gestor anexou o currículo: confere o arquivo (regra 5), grava na
 * candidatura (e no perfil, se o candidato ainda não tem) e manda para a IA.
 */
export async function attachManagerResume(
  companyId: string,
  applicationId: string,
  path: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const application = await getCompanyApplication(companyId, applicationId);
  if (!application?.candidateId) return { ok: false, error: "Candidatura não encontrada." };
  const prefix = applicationResumePrefix(companyId, application.jobId, application.candidateId);
  if (!isAllowedResumePath(path, prefix)) {
    return { ok: false, error: "Currículo inválido. Envie o PDF novamente." };
  }
  const verified = await verifyUploadedResume(path);
  if (!verified.ok) return verified;
  await updateApplicationResume(applicationId, path);
  enqueueTriage(applicationId);
  return { ok: true };
}

/** Lote de PDFs: URLs assinadas para o navegador subir direto ao Storage. */
export async function requestBatchResumeUploads(
  companyId: string,
  jobId: string,
  count: number
): Promise<ResumeUploadTarget[] | null> {
  const job = await findJobById(jobId);
  if (!job || job.companyId !== companyId) return null;
  const targets: ResumeUploadTarget[] = [];
  for (let i = 0; i < Math.min(Math.max(count, 0), BATCH_RESUME_LIMIT); i++) {
    const target = await createResumeUploadTarget(batchResumePrefix(companyId, jobId));
    if (target) targets.push(target);
  }
  return targets;
}

export type BatchImportResult =
  | { status: "created"; id: string; name: string; email: string; phone: string | null }
  | { status: "exists"; id: string; name: string; email: string }
  | { status: "needs_email"; name: string }
  | { status: "skipped"; reason: string };

/**
 * Pré-cadastro a partir de um PDF do lote: lê o currículo, tira nome, e-mail
 * e telefone (texto primeiro, IA para completar), cria o candidato e a
 * candidatura incompleta já com o currículo e manda para a análise. Sem
 * e-mail no PDF, pede para o gestor digitar (emailOverride).
 */
export async function importBatchResume(
  companyId: string,
  jobId: string,
  path: string,
  fileName: string,
  emailOverride?: string
): Promise<BatchImportResult> {
  const job = await findJobById(jobId);
  if (!job || job.companyId !== companyId) return { status: "skipped", reason: "vaga não encontrada" };
  if (!isAllowedResumePath(path, batchResumePrefix(companyId, jobId))) {
    return { status: "skipped", reason: "arquivo inválido" };
  }
  const verified = await verifyUploadedResume(path);
  if (!verified.ok) return { status: "skipped", reason: verified.error };

  let text = "";
  try {
    text = await readResumeText(path);
  } catch (error) {
    console.error("[lote] PDF ilegível:", error);
  }
  const found = findContacts(text);
  let ai: { name: string | null; email: string | null; phone: string | null } = {
    name: null,
    email: null,
    phone: null,
  };
  // O texto do PDF costuma vir sem quebras de linha: o nome sai mais certo
  // pela IA (só contato). Sem IA, cai na adivinhação pelo texto/arquivo.
  if (text.trim().length >= 40) {
    ai = await extractResumeContact(text).catch(() => ai);
  }
  const override = emailOverride?.trim().toLowerCase();
  const email = (override && isValidEmail(override) ? override : null) ?? found.email ?? ai.email;
  const name = ai.name ?? guessName(text, fileName);
  const phone = found.phone ?? ai.phone;
  if (!email) return { status: "needs_email", name };

  if (await findUserByEmail(email)) return { status: "skipped", reason: "é e-mail de alguém da equipe" };
  const candidate =
    (await findCandidateByEmail(email)) ?? (await createCandidate({ email, name, authId: null }));
  const existing = await findApplicationByCandidateAndJob(candidate.id, job.id);
  if (existing) return { status: "exists", id: existing.id, name: existing.name, email };

  const application = await createApplication({
    jobId: job.id,
    companyId,
    candidateId: candidate.id,
    name: candidate.authId ? candidate.name : name,
    email,
    phone: phone ?? candidate.phone ?? null,
    resumeUrl: path,
    aiState: "WAITING",
    answers: [],
    preRegistered: true,
  });
  await createStatusEvent({ applicationId: application.id, from: null, to: "PENDING", actor: "gestor" }).catch(
    () => {}
  );
  enqueueTriage(application.id);
  return { status: "created", id: application.id, name: application.name, email, phone: application.phone };
}

/**
 * Resumos gerenciais de candidaturas selecionadas para a diretoria.
 * Regra 1: cada id é validado pelo tenant. Sequencial para não estourar o
 * limite de tokens/minuto do Groq no plano gratuito.
 */
export async function getApplicationSummaries(
  companyId: string,
  applicationIds: string[]
): Promise<CandidateSummary[]> {
  const owned = await findApplicationsByIds(companyId, applicationIds.slice(0, 10));
  const results: CandidateSummary[] = [];
  for (const { id } of owned) {
    results.push(await generateCandidateSummary(id));
  }
  return results;
}

/**
 * Pré-entrevista: o gestor escolhe o que pedir e o candidato é avisado (site +
 * e-mail). Só se pede o que falta; não muda status nem a nota (regras 2 e 3).
 */
export async function requestApplicationInfo(
  companyId: string,
  id: string,
  fields: InfoField[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const application = await getCompanyApplication(companyId, id);
  if (!application) return { ok: false, error: "Candidatura não encontrada." };
  const pending = pendingRequestedFields(fields, knownInfoOf(application));
  if (pending.length === 0)
    return {
      ok: false,
      error: "Nada a pedir: escolha ao menos uma informação que ainda falta.",
    };
  const company = await getCompanyById(companyId);
  if (!company) return { ok: false, error: "Empresa não encontrada." };

  await updateInfoRequest(id, {
    infoRequestedFields: pending,
    infoRequestedAt: new Date(),
  });

  runInBackground("pedir informações da pré-entrevista", async () => {
    await notifyInfoRequested({
      candidateId: application.candidateId,
      applicationId: id,
      companyName: company.name,
      jobTitle: application.job.title,
    }).catch((e) => console.error("[notificação] pedido de informações:", e));

    if (application.email.includes("@")) {
      const manager = await findManagerByCompanyId(companyId);
      await sendInfoRequestEmail({
        brand: emailBrand(company),
        to: application.email,
        candidateName: application.name,
        jobTitle: application.job.title,
        managerEmail: replyToEmail(company.email, manager?.email),
        applicationId: id,
      });
    }
  });
  return { ok: true };
}

/** Resposta do candidato: só a candidatura dele, só as perguntas pedidas. */
export async function saveInfoAnswers(
  candidateId: string,
  applicationId: string,
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const application = await findApplicationForCandidate(candidateId, applicationId);
  if (!application) return { ok: false, error: "Candidatura não encontrada." };
  const requested = application.infoRequestedFields as InfoField[];
  if (requested.length === 0 || application.infoAnsweredAt)
    return { ok: false, error: "Não há nada pendente nesta candidatura." };

  const parsed = buildInfoAnswerSchema(requested).safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const a = parsed.data as Record<string, unknown>;

  await updateInfoAnswers(applicationId, {
    ...(a.maritalStatus !== undefined ? { maritalStatus: a.maritalStatus as string } : {}),
    ...(a.hasChildren !== undefined
      ? {
          hasChildren: a.hasChildren as boolean,
          childrenCount: a.hasChildren ? ((a.childrenCount as number | undefined) ?? null) : null,
        }
      : {}),
    ...(a.professionalSummary !== undefined
      ? { professionalSummary: a.professionalSummary as string }
      : {}),
    ...(a.rg !== undefined ? { rg: a.rg as string } : {}),
    ...(a.cpf !== undefined ? { cpf: a.cpf as string } : {}),
    infoAnsweredAt: new Date(),
  });
  return { ok: true };
}

/** Outras candidaturas da mesma pessoa na empresa (vazio se o e-mail não for válido). */
export async function getOtherApplicationsOfPerson(companyId: string, email: string, excludeId: string) {
  if (!email.includes("@")) return [];
  return findOtherApplicationsByEmail(companyId, email, excludeId);
}
