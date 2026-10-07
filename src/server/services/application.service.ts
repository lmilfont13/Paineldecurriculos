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
  findLatestApplicationWithAnswers,
  updateApplicationAi,
  updateApplicationStatus,
  updateInterview,
  updateManagerNotes,
} from "@/server/repositories/application.repository";
import { formatInterviewAt } from "@/server/models/interview.model";
import {
  notifyApplicationReceived,
  notifyInterviewScheduled,
  notifyManagerMessage,
  notifyStageChange,
} from "@/server/services/notification.service";
import { findManagerByCompanyId } from "@/server/repositories/user.repository";
import { updateCandidateProfile } from "@/server/services/candidate.service";
import {
  sendApplicationConfirmation,
  sendInterviewScheduledEmail,
  sendManagerMessageEmail,
  sendNewApplicationNotification,
  sendStatusUpdateEmail,
  type EmailBrand,
} from "@/server/services/email.service";
import { findFormFieldsByCompanyId } from "@/server/repositories/form-field.repository";
import { findJobById } from "@/server/repositories/job.repository";
import { runTriageWithTracking } from "@/server/services/ai.service";
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
}): EmailBrand {
  return {
    name: company.name,
    slug: company.slug,
    primaryColor: company.primaryColor,
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
  status: "PENDING" | "INTERVIEW" | "APPROVED" | "REJECTED"
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
        notifyApplicationStatusChange(id, status)
      );
    }
  }
  return updated;
}

/** Comunicação pós-mudança de status: novidade no portal e e-mail. */
export async function notifyApplicationStatusChange(
  applicationId: string,
  status: "PENDING" | "INTERVIEW" | "APPROVED" | "REJECTED"
) {
  const application = await findApplicationById(applicationId);
  if (!application) return;

  // Roda dentro do job do Inngest ou de um after(): aqui dá para (e é
  // preciso) esperar, senão a função termina antes do e-mail sair.
  await Promise.allSettled([
    notifyStageChange({
      candidateId: application.candidateId,
      applicationId,
      to: status,
      companyName: application.company.name,
      jobTitle: application.job.title,
    }),
    status !== "PENDING" && application.email.includes("@")
      ? sendStatusUpdateEmail({
          brand: emailBrand(application.company),
          to: application.email,
          candidateName: application.name,
          jobTitle: application.job.title,
          status,
          applicationId,
        })
      : Promise.resolve(),
  ]);
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
  return existing?.id ?? null;
}

/**
 * Reenfileira a análise de IA (gestor, para FAILED/NO_RESUME). Continua
 * respeitando a regra 2: só aiState muda aqui; o job em background faz o resto.
 */
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
        managerEmail: manager?.email ?? null,
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
  message: string
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
    }).catch((e) => console.error("[notificação] recado:", e));

    if (application.email.includes("@")) {
      const manager = await findManagerByCompanyId(companyId);
      await sendManagerMessageEmail({
        brand: emailBrand(company),
        to: application.email,
        candidateName: application.name,
        jobTitle: application.job.title,
        message: text,
        managerEmail: manager?.email ?? null,
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

  if (await findApplicationByCandidateAndJob(candidate.id, job.id)) {
    return { ok: false, error: "Você já se candidatou a esta vaga." };
  }

  // Valida respostas contra os campos definidos pela empresa
  const fields = await findFormFieldsByCompanyId(companyId);
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

  // Sem arquivo novo, reaproveita o currículo salvo no perfil (CA3).
  let resumeUrl: string | null = candidate.resumeUrl;
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

  const application = await createApplication({
    jobId: job.id,
    companyId,
    candidateId: candidate.id,
    name: input.name,
    email: candidate.email,
    phone: input.phone || null,
    resumeUrl,
    aiState: resumeUrl ? "WAITING" : "NO_RESUME",
    answers,
  });

  // CA2: o que o candidato preencheu vira perfil para as próximas vagas
  await updateCandidateProfile(candidate.id, {
    name: input.name,
    phone: input.phone || null,
    resumeUrl,
  });

  // Timeline: registra o envio (primeiro evento da candidatura)
  await createStatusEvent({
    applicationId: application.id,
    from: null,
    to: "PENDING",
    actor: "candidato",
  }).catch(() => {});

  // Regra 2: candidatura já salva — daqui pra baixo nada pode falhar o fluxo.
  if (resumeUrl) enqueueTriage(application.id);

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
            aiEnabled: Boolean(resumeUrl),
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
