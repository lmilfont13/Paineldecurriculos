"use server";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/server/controllers/guards";
import { createAuditLog } from "@/server/repositories/audit.repository";
import {
  createJobFromFolder,
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

/** Sugere a vaga para o perfil da pasta (rascunho para revisar). */
export async function createJobFromFolderAction(folderId: string) {
  const manager = await requireManager();
  if (!ID.test(folderId)) return { ok: false as const, error: "Pasta não encontrada." };
  const result = await createJobFromFolder(manager.companyId, folderId);
  if (result.ok && !result.existed) {
    try {
      await createAuditLog({
        companyId: manager.companyId,
        userId: manager.id,
        userEmail: manager.email,
        userName: manager.name,
        action: "VAGA_CRIADA",
        entityType: "VAGA",
        entityId: result.jobId,
        metadata: { origem: "banco de talentos", pasta: folderId },
      });
    } catch { /* auditoria nunca bloqueia a ação principal */ }
  }
  if (result.ok) {
    revalidatePath("/vagas");
    revalidatePath("/talentos");
    revalidatePath(`/talentos/${folderId}`);
  }
  return result;
}
