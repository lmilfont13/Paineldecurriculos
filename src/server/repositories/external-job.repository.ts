/**
 * Acesso a dados de vagas externas (ExternalJob). Único lugar que importa
 * Prisma para esta entidade (regra 6). Todo acesso é filtrado por companyId.
 */

import { prisma } from "@/lib/prisma";
import type { ExternalJobCandidate } from "@/server/models/external-job.model";

export async function findExternalJobsByCompany(companyId: string) {
  return prisma.externalJob.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
}

export async function findPublishedExternalJobs(companyId: string, take = 60) {
  return prisma.externalJob.findMany({
    where: { companyId, isPublished: true },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      title: true,
      employer: true,
      location: true,
      description: true,
      source: true,
      applyUrl: true,
      postedLabel: true,
      scheduleType: true,
      viewsCount: true,
      clicksCount: true,
    },
  });
}

export async function findExistingExternalIds(companyId: string, externalIds: string[]) {
  if (externalIds.length === 0) return [];
  const rows = await prisma.externalJob.findMany({
    where: { companyId, externalId: { in: externalIds } },
    select: { externalId: true },
  });
  return rows.map((r) => r.externalId);
}

/** Insere ignorando as que já existem (unique companyId+externalId). */
export async function insertExternalJobs(companyId: string, items: ExternalJobCandidate[]) {
  const result = await prisma.externalJob.createMany({
    data: items.map((item) => ({ ...item, companyId })),
    skipDuplicates: true,
  });
  return result.count;
}

export async function setExternalJobPublished(companyId: string, id: string, isPublished: boolean) {
  const result = await prisma.externalJob.updateMany({
    where: { id, companyId },
    data: { isPublished },
  });
  return result.count;
}

export async function deleteExternalJob(companyId: string, id: string) {
  const result = await prisma.externalJob.deleteMany({ where: { id, companyId } });
  return result.count;
}

export async function incrementExternalJobViews(ids: string[]) {
  if (ids.length === 0) return 0;
  const result = await prisma.externalJob.updateMany({
    where: { id: { in: ids } },
    data: { viewsCount: { increment: 1 } },
  });
  return result.count;
}

export async function incrementExternalJobClick(id: string) {
  const result = await prisma.externalJob.updateMany({
    where: { id },
    data: { clicksCount: { increment: 1 } },
  });
  return result.count;
}

