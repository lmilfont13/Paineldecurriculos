import "server-only";

import { runInBackground } from "@/lib/background";
import {
  STANDBY_CANDIDATE_JOBS_LIMIT,
  STANDBY_JOB_LIMIT,
  pickByRelevance,
  relevance,
} from "@/server/models/standby.model";
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
  findStandbyPool,
  findTalentMatchesForApplication,
  findTalentMatchesForJob,
  removeTalentFolderItem,
  renameTalentFolder,
  upsertTalentMatch,
} from "@/server/repositories/talent.repository";
import { findJobById, findOpenJobsByCompanyId } from "@/server/repositories/job.repository";
import { scoreApplicationAgainstJob } from "@/server/services/ai.service";
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
    count: f._count.items,
  }));
}

export async function getTalentFolder(companyId: string, folderId: string) {
  const folder = await findTalentFolder(companyId, folderId);
  if (!folder) return null;
  const people = await withPhotoUrls(folder.items.map((i) => ({ ...i.application, addedAt: i.addedAt })));
  return { id: folder.id, name: folder.name, area: folder.area, people };
}

/** Pastas da empresa, em quais esta candidatura já está e o nome sugerido. */
export async function getApplicationTalentInfo(companyId: string, applicationId: string) {
  const application = await getCompanyApplication(companyId, applicationId);
  if (!application) return null;
  const folders = await listTalentFolders(companyId);
  const inFolders = await findFolderIdsForApplication(applicationId);
  const matches = await findTalentMatchesForApplication(applicationId);
  return {
    folders,
    inFolders,
    matches: matches
      .filter((m) => m.job.status === "OPEN")
      .map((m) => ({
        jobId: m.job.id,
        jobTitle: m.job.title,
        minScore: m.job.aiMinScore,
        score: m.score,
        state: m.state,
      })),
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
): Promise<
  { ok: true; folderId: string; folderName: string; analyzed: number } | { ok: false; error: string }
> {
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
  // Stand-by: já confere o candidato com as vagas abertas parecidas.
  const analyzed = await analyzeStandbyForApplication(companyId, applicationId);
  return { ok: true, folderId: folder.id, folderName: folder.name, analyzed };
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


export async function scoreStandby(
  companyId: string,
  applicationId: string,
  job: { id: string; title: string; aiCriteria: string[]; requirements: string | null }
) {
  const base = { companyId, applicationId, jobId: job.id };
  await upsertTalentMatch({ ...base, state: "PROCESSING" });
  try {
    const result = await scoreApplicationAgainstJob(applicationId, job);
    if (!result) {
      await upsertTalentMatch({ ...base, state: "NO_RESUME", score: null, reasoning: null });
      return;
    }
    await upsertTalentMatch({ ...base, state: "DONE", score: result.score, reasoning: result.reasoning });
  } catch (error) {
    console.error("[stand-by] Falha ao analisar:", error);
    await upsertTalentMatch({ ...base, state: "FAILED" });
  }
}

/**
 * Candidato entrou em stand-by: analisa contra as vagas abertas mais
 * parecidas com o perfil dele (menos a vaga em que se inscreveu). Usa o
 * mesmo prompt da nota (regra 3) e não mexe na candidatura original (regra 2).
 */
export async function analyzeStandbyForApplication(
  companyId: string,
  applicationId: string
): Promise<number> {
  const pool = await findStandbyPool(companyId);
  const person = pool.find((p) => p.id === applicationId);
  if (!person) return 0;
  const jobs = (await findOpenJobsByCompanyId(companyId)).filter((j) => j.id !== person.jobId);
  const picked = pickByRelevance(
    jobs.map((job) => ({ item: job, relevance: relevance(job, person) })),
    STANDBY_CANDIDATE_JOBS_LIMIT
  );
  for (const job of picked) await scoreStandby(companyId, applicationId, job);
  return picked.length;
}

/**
 * Vaga nova ou reaberta: procura no banco de talentos quem está em stand-by
 * com perfil parecido e analisa contra esta vaga.
 */
export async function analyzeStandbyForJob(companyId: string, jobId: string): Promise<number> {
  const job = await findJobById(jobId);
  if (!job || job.companyId !== companyId) return 0;
  const pool = (await findStandbyPool(companyId)).filter((p) => p.jobId !== jobId);
  const picked = pickByRelevance(
    pool.map((person) => ({ item: person, relevance: relevance(job, person) })),
    STANDBY_JOB_LIMIT
  );
  for (const person of picked) await scoreStandby(companyId, person.id, job);
  return picked.length;
}

/** Ao publicar uma vaga: confere o banco de talentos em segundo plano. */
export function queueStandbyForJob(companyId: string, jobId: string) {
  runInBackground("banco de talentos para a vaga", () =>
    analyzeStandbyForJob(companyId, jobId).then(() => undefined)
  );
}

/** Candidatos em stand-by analisados para a vaga (hub da vaga). */
export async function getStandbyForJob(companyId: string, jobId: string) {
  const matches = await findTalentMatchesForJob(companyId, jobId);
  const pool = await findStandbyPool(companyId);
  const people = await withPhotoUrls(
    matches.map((m) => ({
      id: m.application.id,
      name: m.application.name,
      phone: m.application.phone,
      aiProfile: m.application.aiProfile,
      aiLevel: m.application.aiLevel,
      photoPath: m.application.photoPath,
      originalJobTitle: m.application.job.title,
      folders: m.application.talentItems.map((t) => t.folder),
      score: m.score,
      reasoning: m.reasoning,
      state: m.state,
    }))
  );
  return { people, poolSize: pool.filter((p) => p.jobId !== jobId).length };
}
