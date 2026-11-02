import "server-only";

import { createTalentPoolJob, findTalentPoolJob } from "@/server/repositories/job.repository";
import {
  addTalentFolderItem,
  createTalentFolder,
  findTalentFolders,
} from "@/server/repositories/talent.repository";
import { sameFolderName } from "@/server/models/talent.model";

/** Pasta onde caem os cadastros feitos sem vaga. */
export const SPONTANEOUS_FOLDER = "Cadastros espontâneos";

/**
 * Vaga oculta que recebe os cadastros sem vaga. Criada na primeira vez e
 * reaproveitada depois; não aparece nas listas de vagas.
 */
export async function getTalentPoolJobId(companyId: string, companyName: string): Promise<string> {
  const existing = await findTalentPoolJob(companyId);
  if (existing) return existing.id;
  return (await createTalentPoolJob(companyId, companyName)).id;
}

/**
 * Cadastro sem vaga: guarda a pessoa na pasta do banco de talentos. Assim,
 * quando uma vaga abrir, o stand-by já a confere. Nunca lança.
 */
export async function addToSpontaneousFolder(companyId: string, applicationId: string): Promise<void> {
  try {
    const folders = await findTalentFolders(companyId);
    const folder =
      folders.find((f) => sameFolderName(f.name, SPONTANEOUS_FOLDER)) ??
      (await createTalentFolder(companyId, SPONTANEOUS_FOLDER, null));
    await addTalentFolderItem(folder.id, applicationId);
  } catch (error) {
    console.error("[banco de talentos] Não foi possível guardar o cadastro:", error);
  }
}
