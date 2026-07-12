import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest";
import { sendApplicationConfirmation } from "@/server/services/email.service";
import { getCompanyById } from "@/server/services/company.service";
import {
  MAX_RESUME_BYTES,
  RESUME_MIME,
  type ApplicationInput,
  type SubmitApplicationResult,
} from "@/server/models/application.model";
import {
  countApplicationsByCompany,
  createApplication,
  findApplicationById,
  findApplicationsByCompany,
  updateApplicationStatus,
} from "@/server/repositories/application.repository";
import { findFormFieldsByCompanyId } from "@/server/repositories/form-field.repository";
import { findJobById } from "@/server/repositories/job.repository";

const RESUMES_BUCKET = "resumes";

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
 * A IA jamais chama esta função.
 */
export async function setApplicationStatus(
  companyId: string,
  id: string,
  status: "PENDING" | "INTERVIEW" | "APPROVED" | "REJECTED"
) {
  const application = await getCompanyApplication(companyId, id);
  if (!application) return null;
  return updateApplicationStatus(id, status);
}

/** URL assinada (10 min) para baixar o currículo do Storage privado. */
export async function getResumeSignedUrl(
  companyId: string,
  applicationId: string
): Promise<string | null> {
  const application = await getCompanyApplication(companyId, applicationId);
  if (!application?.resumeUrl) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(RESUMES_BUCKET)
    .createSignedUrl(application.resumeUrl, 600);
  if (error) return null;
  return data.signedUrl;
}

/**
 * Regra 2: a candidatura é salva e respondida imediatamente — a análise de IA
 * roda depois, em background (Inngest), e nunca bloqueia o candidato.
 * A IA só escreve aiScore/aiReasoning/aiState; AppStatus é decisão do gestor.
 */
export async function submitApplication(
  companyId: string,
  input: Omit<ApplicationInput, "slug">,
  resume: File | null
): Promise<SubmitApplicationResult> {
  const job = await findJobById(input.jobId);
  if (!job || job.companyId !== companyId || job.status !== "OPEN") {
    return { ok: false, error: "Esta vaga não está mais aberta." };
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

  // Regra 5: currículo só PDF, máx 5 MB, no Supabase Storage
  let resumeUrl: string | null = null;
  if (resume && resume.size > 0) {
    if (resume.type !== RESUME_MIME) {
      return { ok: false, error: "O currículo deve ser um PDF." };
    }
    if (resume.size > MAX_RESUME_BYTES) {
      return { ok: false, error: "O currículo deve ter no máximo 5 MB." };
    }
    const path = `${companyId}/${input.jobId}/${crypto.randomUUID()}.pdf`;
    const supabase = createAdminClient();
    const { error } = await supabase.storage
      .from(RESUMES_BUCKET)
      .upload(path, resume, { contentType: RESUME_MIME });
    if (error) {
      return {
        ok: false,
        error: "Não foi possível enviar o currículo. Tente novamente.",
      };
    }
    resumeUrl = path;
  }

  const application = await createApplication({
    jobId: job.id,
    companyId,
    name: input.name,
    email: input.email,
    phone: input.phone || null,
    resumeUrl,
    aiState: resumeUrl ? "WAITING" : "NO_RESUME",
    answers,
  });

  // Regra 2: candidatura já salva — daqui pra baixo nada pode falhar o fluxo.
  // IA roda em background via Inngest; e-mail é fire-and-forget.
  try {
    await inngest.send({
      name: "application/submitted",
      data: { applicationId: application.id },
    });
  } catch (error) {
    console.error("[inngest] Falha ao enfileirar análise:", error);
    // aiState permanece WAITING; o job pode ser redisparado depois
  }

  const company = await getCompanyById(companyId);
  if (company) {
    void sendApplicationConfirmation({
      to: application.email,
      candidateName: application.name,
      companyName: company.name,
      jobTitle: job.title,
    });
  }

  return { ok: true, applicationId: application.id };
}
