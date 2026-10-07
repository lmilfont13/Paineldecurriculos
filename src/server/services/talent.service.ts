import "server-only";

import {
  normalizeFolderName,
  sameFolderName,
  type TalentFolderSummary,
} from "@/server/models/talent.model";
import {
  addTalentFolderItem,
  createTalentFolder,
  deleteTalentFolder,
  findFolderIdsForApplication,
  findTalentFolder,
  findTalentFolders,
  removeTalentFolderItem,
  renameTalentFolder,
} from "@/server/repositories/talent.repository";
import { getCompanyApplication } from "@/server/services/application.service";
import { withPhotoUrls } from "@/server/services/resume-photo.service";

/**
 * Banco de talentos: o gestor guarda, em pastas por perfil, candidatos que não
 * servem para a vaga em que se inscreveram mas podem servir para outras.
 * Guardar não muda a etapa nem avisa o candidato.
 */

export async function listTalentFolders(companyId: string): Promise<TalentFolderSummary[]> {
  const folders = await findTalentFolders(companyId);
  return folders.map((f) => ({ id: f.id, name: f.name, count: f._count.items }));
}

export async function getTalentFolder(companyId: string, folderId: string) {
  const folder = await findTalentFolder(companyId, folderId);
  if (!folder) return null;
  const people = await withPhotoUrls(folder.items.map((i) => ({ ...i.application, addedAt: i.addedAt })));
  return { id: folder.id, name: folder.name, people };
}

/** Pastas da empresa, em quais esta candidatura já está e o nome sugerido. */
export async function getApplicationTalentInfo(companyId: string, applicationId: string) {
  const application = await getCompanyApplication(companyId, applicationId);
  if (!application) return null;
  const folders = await listTalentFolders(companyId);
  const inFolders = await findFolderIdsForApplication(applicationId);
  return {
    folders,
    inFolders,
    suggestedName: application.aiProfile ?? "",
  };
}

/** Pasta pelo nome: reaproveita a que já existe (sem diferenciar caixa/acento). */
async function findOrCreateFolder(companyId: string, rawName: string) {
  const name = normalizeFolderName(rawName);
  if (!name) return null;
  const folders = await findTalentFolders(companyId);
  const existing = folders.find((f) => sameFolderName(f.name, name));
  if (existing) return existing;
  return createTalentFolder(companyId, name);
}

export async function saveToTalentFolder(
  companyId: string,
  applicationId: string,
  target: { folderId?: string; newName?: string }
): Promise<{ ok: true; folderId: string; folderName: string } | { ok: false; error: string }> {
  const application = await getCompanyApplication(companyId, applicationId);
  if (!application) return { ok: false, error: "Candidatura não encontrada." };

  let folder: { id: string; name: string } | null = null;
  if (target.newName !== undefined) {
    folder = await findOrCreateFolder(companyId, target.newName);
    if (!folder) return { ok: false, error: "Dê um nome para a pasta." };
  } else if (target.folderId) {
    const folders = await findTalentFolders(companyId);
    folder = folders.find((f) => f.id === target.folderId) ?? null;
    if (!folder) return { ok: false, error: "Pasta não encontrada." };
  } else {
    return { ok: false, error: "Escolha uma pasta." };
  }

  await addTalentFolderItem(folder.id, applicationId);
  return { ok: true, folderId: folder.id, folderName: folder.name };
}

export async function removeFromTalentFolder(
  companyId: string,
  folderId: string,
  applicationId: string
): Promise<boolean> {
  const folder = await findTalentFolder(companyId, folderId);
  if (!folder) return false;
  await removeTalentFolderItem(folderId, applicationId);
  return true;
}

export async function renameCompanyTalentFolder(
  companyId: string,
  folderId: string,
  rawName: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = normalizeFolderName(rawName);
  if (!name) return { ok: false, error: "Dê um nome para a pasta." };
  const folders = await findTalentFolders(companyId);
  if (!folders.some((f) => f.id === folderId)) return { ok: false, error: "Pasta não encontrada." };
  if (folders.some((f) => f.id !== folderId && sameFolderName(f.name, name))) {
    return { ok: false, error: "Já existe uma pasta com esse nome." };
  }
  await renameTalentFolder(folderId, name);
  return { ok: true };
}

export async function deleteCompanyTalentFolder(companyId: string, folderId: string) {
  const folders = await findTalentFolders(companyId);
  if (!folders.some((f) => f.id === folderId)) return false;
  await deleteTalentFolder(folderId);
  return true;
}
