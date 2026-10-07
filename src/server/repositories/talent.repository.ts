import "server-only";

import { prisma } from "@/lib/prisma";

/** Pastas do banco de talentos da empresa, com quantos candidatos cada. */
export function findTalentFolders(companyId: string) {
  return prisma.talentFolder.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    include: { _count: { select: { items: true } } },
  });
}

/** Uma pasta do tenant com os candidatos (regra 1: companyId no filtro). */
export function findTalentFolder(companyId: string, folderId: string) {
  return prisma.talentFolder.findFirst({
    where: { id: folderId, companyId },
    include: {
      items: {
        orderBy: { addedAt: "desc" },
        include: {
          application: {
            select: {
              id: true,
              name: true,
              aiScore: true,
              aiState: true,
              aiProfile: true,
              aiArea: true,
              aiLevel: true,
              photoPath: true,
              status: true,
              talentMatches: {
                where: { state: "DONE", job: { status: "OPEN" } },
                orderBy: { score: "desc" },
                take: 1,
                select: { score: true, job: { select: { id: true, title: true, aiMinScore: true } } },
              },
              createdAt: true,
              job: {
                select: {
                  title: true,
                  aiMinScore: true,
                  location: true,
                  contract: true,
                  workMode: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

export function createTalentFolder(companyId: string, name: string, area: string | null) {
  return prisma.talentFolder.create({ data: { companyId, name, area } });
}

export function renameTalentFolder(id: string, name: string) {
  return prisma.talentFolder.update({ where: { id }, data: { name } });
}

/** Apaga a pasta; os candidatos continuam no sistema (só sai o vínculo). */
export function deleteTalentFolder(id: string) {
  return prisma.talentFolder.delete({ where: { id } });
}

export function addTalentFolderItem(folderId: string, applicationId: string) {
  return prisma.talentFolderItem.upsert({
    where: { folderId_applicationId: { folderId, applicationId } },
    create: { folderId, applicationId },
    update: {},
  });
}

export function removeTalentFolderItem(folderId: string, applicationId: string) {
  return prisma.talentFolderItem.deleteMany({ where: { folderId, applicationId } });
}

/** Em quais pastas a candidatura está. */
export function findFolderIdsForApplication(applicationId: string) {
  return prisma.talentFolderItem
    .findMany({ where: { applicationId }, select: { folderId: true } })
    .then((rows) => rows.map((r) => r.folderId));
}

/**
 * Candidatos em stand-by: todos os que estão em alguma pasta do banco de
 * talentos da empresa, com o perfil e as pastas de cada um.
 */
export async function findStandbyPool(companyId: string) {
  const items = await prisma.talentFolderItem.findMany({
    where: { folder: { companyId } },
    select: {
      folder: { select: { name: true } },
      application: {
        select: {
          id: true,
          name: true,
          phone: true,
          jobId: true,
          aiProfile: true,
          aiArea: true,
          aiLevel: true,
        },
      },
    },
  });
  const byApp = new Map<
    string,
    (typeof items)[number]["application"] & { folderNames: string[] }
  >();
  for (const item of items) {
    const current = byApp.get(item.application.id);
    if (current) current.folderNames.push(item.folder.name);
    else byApp.set(item.application.id, { ...item.application, folderNames: [item.folder.name] });
  }
  return [...byApp.values()];
}

export function upsertTalentMatch(data: {
  companyId: string;
  applicationId: string;
  jobId: string;
  state: "WAITING" | "PROCESSING" | "DONE" | "FAILED" | "NO_RESUME";
  score?: number | null;
  reasoning?: string | null;
}) {
  const { companyId, applicationId, jobId, ...rest } = data;
  return prisma.talentMatch.upsert({
    where: { applicationId_jobId: { applicationId, jobId } },
    create: { companyId, applicationId, jobId, ...rest },
    update: rest,
  });
}

/** Stand-by analisados para uma vaga (melhor nota primeiro). */
export function findTalentMatchesForJob(companyId: string, jobId: string) {
  return prisma.talentMatch.findMany({
    where: { companyId, jobId },
    orderBy: [{ score: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
    include: {
      application: {
        select: {
          id: true,
          name: true,
          phone: true,
          aiProfile: true,
          aiLevel: true,
          photoPath: true,
          job: { select: { title: true } },
          talentItems: { select: { folder: { select: { id: true, name: true } } } },
        },
      },
    },
  });
}

/** Vagas em que um candidato em stand-by foi analisado. */
export function findTalentMatchesForApplication(applicationId: string) {
  return prisma.talentMatch.findMany({
    where: { applicationId },
    orderBy: [{ score: { sort: "desc", nulls: "last" } }],
    include: { job: { select: { id: true, title: true, status: true, aiMinScore: true } } },
  });
}
