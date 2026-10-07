"use server";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/server/controllers/guards";
import { runCareerAnalysis } from "@/server/services/career.service";
import {
  analyzeStandbyForApplication,
  analyzeStandbyForJob,
  deleteCompanyTalentFolder,
  getApplicationTalentInfo,
  getTalentFolder,
  listTalentFolders,
  removeFromTalentFolder,
  renameCompanyTalentFolder,
  saveToTalentFolder,
} from "@/server/services/talent.service";

/** Banco de talentos. O tenant vem sempre da sessão (regra 1). */

const ID = /^[a-z0-9]{10,40}$/i;

export async function loadTalentFolders() {
  const manager = await requireManager();
  return listTalentFolders(manager.companyId);
}

export async function loadTalentFolder(folderId: string) {
  const manager = await requireManager();
  if (!ID.test(folderId)) return null;
  return getTalentFolder(manager.companyId, folderId);
}

export async function loadApplicationTalentInfo(applicationId: string) {
  const manager = await requireManager();
  return getApplicationTalentInfo(manager.companyId, applicationId);
}

export async function saveToTalentFolderAction(
  applicationId: string,
  target: { folderId?: string; newName?: string }
) {
  const manager = await requireManager();
  const clean = {
    folderId: typeof target.folderId === "string" && ID.test(target.folderId) ? target.folderId : undefined,
    newName: typeof target.newName === "string" ? target.newName.slice(0, 120) : undefined,
  };
  const result = await saveToTalentFolder(manager.companyId, applicationId, clean);
  revalidatePath(`/candidaturas/${applicationId}`);
  revalidatePath("/talentos");
  if (result.ok) revalidatePath(`/talentos/${result.folderId}`);
  return result;
}

export async function removeFromTalentFolderAction(folderId: string, applicationId: string) {
  const manager = await requireManager();
  await removeFromTalentFolder(manager.companyId, folderId, applicationId);
  revalidatePath(`/talentos/${folderId}`);
  revalidatePath("/talentos");
  revalidatePath(`/candidaturas/${applicationId}`);
}

export async function renameTalentFolderAction(folderId: string, name: string) {
  const manager = await requireManager();
  const result = await renameCompanyTalentFolder(manager.companyId, folderId, String(name ?? ""));
  revalidatePath("/talentos");
  revalidatePath(`/talentos/${folderId}`);
  return result;
}

export async function deleteTalentFolderAction(folderId: string) {
  const manager = await requireManager();
  const ok = await deleteCompanyTalentFolder(manager.companyId, folderId);
  revalidatePath("/talentos");
  return { ok };
}

/** Hub da vaga: confere o banco de talentos para esta vaga agora. */
export async function analyzeStandbyForJobAction(jobId: string) {
  const manager = await requireManager();
  if (!ID.test(jobId)) return { analyzed: 0 };
  const analyzed = await analyzeStandbyForJob(manager.companyId, jobId);
  revalidatePath(`/vagas/${jobId}`);
  return { analyzed };
}

/** Detalhe do candidato: confere de novo com as vagas abertas. */
export async function analyzeStandbyForApplicationAction(applicationId: string) {
  const manager = await requireManager();
  if (!ID.test(applicationId)) return { analyzed: 0 };
  const analyzed = await analyzeStandbyForApplication(manager.companyId, applicationId);
  revalidatePath(`/candidaturas/${applicationId}`);
  return { analyzed };
}

/** Agente de perfil: áreas, nota estimada e onde a pessoa seria bem aproveitada. */
export async function analyzeCareerAction(applicationId: string) {
  const manager = await requireManager();
  if (!ID.test(applicationId)) return { ok: false as const, error: "Candidatura não encontrada." };
  const result = await runCareerAnalysis(manager.companyId, applicationId);
  revalidatePath(`/candidaturas/${applicationId}`);
  revalidatePath("/agentes");
  return result.ok ? { ok: true as const, jobsCompared: result.jobsCompared } : result;
}
