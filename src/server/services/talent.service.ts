import "server-only";

import { AI_MODEL_ID, geminiGenerate } from "@/lib/gemini";
import { buildFolderBrief, parseJobDraft } from "@/server/models/job-draft.model";
import {
  FOLDER_SEPARATOR,
  folderArea,
  normalizeFolderName,
  sameFolderName,
  suggestFolderName,
  type TalentFolderSummary,
} from "@/server/models/talent.model";
import {
  addTalentFolderItem,
  createTalentFolder,
  deleteTalentFolder,
  findFolderIdsForApplication,
  findTalentFolder,
  findTalentFolders,
  findTalentFoldersByJob,
  removeTalentFolderItem,
  renameTalentFolder,
  setTalentFolderJob,
} from "@/server/repositories/talent.repository";
import { findJobById } from "@/server/repositories/job.repository";
import { createCompanyJob } from "@/server/services/job.service";
import { getCompanyApplication } from "@/server/services/application.service";
import { withPhotoUrls } from "@/server/services/resume-photo.service";

/**
 * Banco de talentos: o gestor guarda, em pastas por perfil, candidatos que não
 * servem para a vaga em que se inscreveram mas podem servir para outras.
 * Guardar não muda a etapa nem avisa o candidato.
 */

export async function listTalentFolders(companyId: string): Promise<TalentFolderSummary[]> {
  const folders = await findTalentFolders(companyId);
  return folders.map((f) => ({
    id: f.id,
    name: f.name,
    area: f.area,
    jobId: f.jobId,
    count: f._count.items,
  }));
}

export async function getTalentFolder(companyId: string, folderId: string) {
  const folder = await findTalentFolder(companyId, folderId);
  if (!folder) return null;
  const people = await withPhotoUrls(folder.items.map((i) => ({ ...i.application, addedAt: i.addedAt })));
  return { id: folder.id, name: folder.name, area: folder.area, job: folder.job, people };
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
    suggestedName: suggestFolderName({ area: application.aiArea, role: application.aiProfile }),
    suggestedArea: application.aiArea,
    level: application.aiLevel,
  };
}

/** Pasta pelo nome: reaproveita a que já existe (sem diferenciar caixa/acento). */
async function findOrCreateFolder(companyId: string, rawName: string, area: string | null) {
  const name = normalizeFolderName(rawName);
  if (!name) return null;
  const folders = await findTalentFolders(companyId);
  const existing = folders.find((f) => sameFolderName(f.name, name));
  if (existing) return existing;
  // Área: a do currículo, se o nome começa por ela; senão o prefixo "Área · ".
  const parsed = folderArea({ name });
  const fromName = name.includes(FOLDER_SEPARATOR) ? parsed : null;
  return createTalentFolder(companyId, name, fromName ?? area ?? null);
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
    folder = await findOrCreateFolder(
      companyId,
      target.newName,
      sameFolderName(target.newName, suggestFolderName({ area: application.aiArea, role: application.aiProfile }))
        ? application.aiArea
        : null
    );
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

/** Pastas que deram origem a esta vaga. */
export async function listFoldersForJob(companyId: string, jobId: string) {
  const folders = await findTalentFoldersByJob(companyId, jobId);
  return folders.map((f) => ({ id: f.id, name: f.name, count: f._count.items }));
}

const JOB_DRAFT_PROMPT = `Você ajuda um recrutador a abrir uma vaga para um perfil de candidatos que ele já tem guardado.
Escreva em português do Brasil, linguagem simples e direta, sem exageros.
Não cite nome, gênero, idade, foto, origem nem qualquer dado pessoal, e não peça nada disso.
Não invente salário, benefícios ou empresa: deixe esses pontos para o recrutador completar.
Retorne JSON: { "title": "título da vaga", "description": "o que a pessoa vai fazer, em 1 parágrafo e uma lista de atividades", "requirements": ["requisito", "..."], "criteria": ["3 a 6 critérios curtos para a IA avaliar"], "minScore": 60 }`;

function mostCommon<T>(values: T[]): T | null {
  const map = new Map<T, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/**
 * Sugere a vaga para o perfil da pasta: a IA escreve um rascunho a partir dos
 * perfis guardados (agregados, sem dados pessoais) e ele é salvo como
 * RASCUNHO para o gestor revisar. Se a pasta já gerou uma vaga que ainda
 * existe, devolve essa em vez de criar outra.
 */
export async function createJobFromFolder(
  companyId: string,
  folderId: string
): Promise<{ ok: true; jobId: string; existed: boolean } | { ok: false; error: string }> {
  const folder = await findTalentFolder(companyId, folderId);
  if (!folder) return { ok: false, error: "Pasta não encontrada." };
  if (folder.jobId) {
    const existing = await findJobById(folder.jobId);
    if (existing && existing.companyId === companyId) {
      return { ok: true, jobId: existing.id, existed: true };
    }
  }
  if (folder.items.length === 0) {
    return { ok: false, error: "A pasta está vazia. Guarde pelo menos um candidato antes." };
  }

  const apps = folder.items.map((i) => i.application);
  const brief = buildFolderBrief({
    name: folder.name,
    area: folder.area,
    people: apps.map((a) => ({ aiProfile: a.aiProfile, aiLevel: a.aiLevel, jobTitle: a.job.title })),
  });
  const fallbackTitle = folder.name.split(FOLDER_SEPARATOR).pop()?.trim() || folder.name;

  let raw = "";
  try {
    raw = await geminiGenerate({ system: JOB_DRAFT_PROMPT, prompt: brief, maxTokens: 1200, json: true });
  } catch (error) {
    console.error(`[talentos] Falha ao gerar rascunho de vaga (${AI_MODEL_ID}):`, error);
    return { ok: false, error: "A IA não respondeu agora. Tente de novo em instantes." };
  }
  const draft = parseJobDraft(raw, fallbackTitle);

  const job = await createCompanyJob(
    companyId,
    {
      title: draft.title,
      description: draft.description,
      requirements: draft.requirements,
      location: mostCommon(apps.map((a) => a.job.location).filter((l): l is string => !!l)) ?? "",
      contract: mostCommon(apps.map((a) => a.job.contract)) ?? "CLT",
      workMode: mostCommon(apps.map((a) => a.job.workMode)) ?? "ONSITE",
      aiCriteria: draft.aiCriteria,
      aiMinScore: draft.aiMinScore,
    },
    false
  );
  await setTalentFolderJob(folder.id, job.id);
  return { ok: true, jobId: job.id, existed: false };
}
