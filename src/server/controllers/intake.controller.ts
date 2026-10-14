"use server";

import { revalidatePath } from "next/cache";

import { appUrl } from "@/lib/env";
import { requireManager } from "@/server/controllers/guards";
import { intakeInviteText, parseIntakeList } from "@/server/models/intake.model";
import { whatsappNumber } from "@/server/models/standby.model";
import {
  attachManagerResume,
  importBatchResume,
  preRegisterCandidates,
  requestBatchResumeUploads,
  requestManagerResumeUpload,
} from "@/server/services/application.service";
import { getCompanyJob } from "@/server/services/job.service";

async function getJobTitle(companyId: string, jobId: string) {
  return (await getCompanyJob(companyId, jobId))?.title ?? "a vaga";
}
import { getCompanyById } from "@/server/services/company.service";

/** Cadastro rápido pelo gestor. O tenant vem sempre da sessão (regra 1). */

const ID = /^[a-z0-9]{10,40}$/i;

export type IntakeResult = {
  ok: true;
  jobTitle: string;
  created: { id: string; email: string; name: string; invite: string; whatsapp: string | null }[];
  skipped: { email: string; reason: string }[];
  invalid: string[];
} | { ok: false; error: string };

export async function preRegisterAction(jobId: string, text: string): Promise<IntakeResult> {
  const manager = await requireManager();
  if (!ID.test(jobId)) return { ok: false, error: "Escolha a vaga." };
  const { entries, invalid } = parseIntakeList(String(text ?? "").slice(0, 20000));
  if (entries.length === 0) {
    return { ok: false, error: "Nenhum e-mail válido. Coloque um e-mail por linha." };
  }
  const result = await preRegisterCandidates(manager.companyId, jobId, entries);
  if (!result) return { ok: false, error: "Vaga não encontrada." };

  const company = await getCompanyById(manager.companyId);
  const url = `${appUrl()}/${company?.slug ?? ""}/vagas/${jobId}/candidatar`;
  revalidatePath("/candidaturas");
  revalidatePath("/painel");
  revalidatePath(`/vagas/${jobId}`);
  return {
    ok: true,
    jobTitle: result.jobTitle,
    created: result.created.map((c) => {
      const invite = intakeInviteText({
        name: c.name,
        company: company?.name ?? "empresa",
        jobTitle: result.jobTitle,
        url,
        email: c.email,
      });
      const number = whatsappNumber(c.phone);
      return {
        id: c.id,
        email: c.email,
        name: c.name,
        invite,
        whatsapp: number ? `https://wa.me/${number}?text=${encodeURIComponent(invite)}` : null,
      };
    }),
    skipped: result.skipped,
    invalid,
  };
}

/** Gestor anexa o PDF: 1) pede a URL assinada; 2) confirma o arquivo. */
export async function requestManagerResumeUploadAction(applicationId: string) {
  const manager = await requireManager();
  if (!ID.test(applicationId)) return null;
  return requestManagerResumeUpload(manager.companyId, applicationId);
}

export async function attachManagerResumeAction(applicationId: string, path: string) {
  const manager = await requireManager();
  if (!ID.test(applicationId)) return { ok: false as const, error: "Candidatura não encontrada." };
  const result = await attachManagerResume(manager.companyId, applicationId, String(path ?? ""));
  revalidatePath(`/candidaturas/${applicationId}`);
  revalidatePath("/candidaturas");
  return result;
}

/** Convite pronto para o detalhe do candidato (copiar / WhatsApp). */
export async function getIntakeInvite(applicationId: string, jobId: string, jobTitle: string, name: string, email: string, phone: string | null) {
  const manager = await requireManager();
  const company = await getCompanyById(manager.companyId);
  const url = `${appUrl()}/${company?.slug ?? ""}/vagas/${jobId}/candidatar`;
  const invite = intakeInviteText({ name, company: company?.name ?? "empresa", jobTitle, url, email });
  const number = whatsappNumber(phone);
  return {
    applicationId,
    invite,
    whatsapp: number ? `https://wa.me/${number}?text=${encodeURIComponent(invite)}` : null,
  };
}

/** Lote de PDFs · passo 1: URLs para subir os arquivos direto ao Storage. */
export async function requestBatchUploadsAction(jobId: string, count: number) {
  const manager = await requireManager();
  if (!ID.test(jobId)) return null;
  return requestBatchResumeUploads(manager.companyId, jobId, Number(count) || 0);
}

/** Lote de PDFs · passo 2 (um por arquivo): lê, pré-cadastra e manda analisar. */
export async function importBatchResumeAction(
  jobId: string,
  path: string,
  fileName: string,
  email?: string
) {
  const manager = await requireManager();
  if (!ID.test(jobId)) return { status: "skipped" as const, reason: "vaga não encontrada" };
  const result = await importBatchResume(
    manager.companyId,
    jobId,
    String(path ?? ""),
    String(fileName ?? "").slice(0, 200),
    email ? String(email).slice(0, 200) : undefined
  );
  if (result.status !== "created") return result;

  const company = await getCompanyById(manager.companyId);
  const url = `${appUrl()}/${company?.slug ?? ""}/vagas/${jobId}/candidatar`;
  const job = await getJobTitle(manager.companyId, jobId);
  const invite = intakeInviteText({
    name: result.name,
    company: company?.name ?? "empresa",
    jobTitle: job,
    url,
    email: result.email,
  });
  const number = whatsappNumber(result.phone);
  revalidatePath("/candidaturas");
  return {
    ...result,
    invite,
    whatsapp: number ? `https://wa.me/${number}?text=${encodeURIComponent(invite)}` : null,
  };
}
