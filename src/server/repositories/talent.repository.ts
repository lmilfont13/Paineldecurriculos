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
      job: { select: { id: true, title: true, status: true } },
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

/** Liga a pasta à vaga criada a partir dela. */
export function setTalentFolderJob(id: string, jobId: string) {
  return prisma.talentFolder.update({ where: { id }, data: { jobId } });
}

/** Pastas que deram origem a esta vaga (banner no hub da vaga). */
export function findTalentFoldersByJob(companyId: string, jobId: string) {
  return prisma.talentFolder.findMany({
    where: { companyId, jobId },
    include: { _count: { select: { items: true } } },
  });
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
