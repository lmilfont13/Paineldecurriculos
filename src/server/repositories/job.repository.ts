import "server-only";

import { prisma } from "@/lib/prisma";
import { HIDDEN_FROM_DIRECTORY_SLUGS } from "@/server/models/company.model";

export function findOpenJobsByCompanyId(companyId: string) {
  return prisma.job.findMany({
    where: { companyId, status: "OPEN", isTalentPool: false },
    orderBy: { createdAt: "desc" },
  });
}

export function findJobById(id: string) {
  return prisma.job.findUnique({ where: { id } });
}

export function findJobsByCompanyId(companyId: string) {
  return prisma.job.findMany({
    where: { companyId, isTalentPool: false },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { applications: true } } },
  });
}

export function countJobsByCompanyId(companyId: string, onlyOpen = false) {
  return prisma.job.count({
    where: { companyId, isTalentPool: false, ...(onlyOpen ? { status: "OPEN" as const } : {}) },
  });
}

export function createJob(data: {
  companyId: string;
  code: string | null;
  title: string;
  description: string;
  requirements: string | null;
  location: string | null;
  contract: "CLT" | "PJ" | "FREELANCE" | "INTERNSHIP";
  workMode: "REMOTE" | "HYBRID" | "ONSITE";
  status: "DRAFT" | "OPEN";
  aiCriteria: string[];
  aiMinScore: number;
  publishedAt: Date | null;
}) {
  return prisma.job.create({ data });
}

export function incrementWhatsappShares(id: string) {
  return prisma.job.update({
    where: { id },
    data: { whatsappShares: { increment: 1 } },
    select: { whatsappShares: true },
  });
}

export function updateJob(
  id: string,
  data: Partial<{
    code: string | null;
    title: string;
    description: string;
    requirements: string | null;
    location: string | null;
    contract: "CLT" | "PJ" | "FREELANCE" | "INTERNSHIP";
    workMode: "REMOTE" | "HYBRID" | "ONSITE";
    status: "DRAFT" | "OPEN" | "PAUSED" | "CLOSED";
    aiCriteria: string[];
    aiMinScore: number;
    publishedAt: Date;
  }>
) {
  return prisma.job.update({ where: { id }, data });
}

/** Exclui a vaga (perguntas da vaga saem em cascata). */
export function deleteJob(id: string) {
  return prisma.job.delete({ where: { id } });
}

export function findTalentPoolJob(companyId: string) {
  return prisma.job.findFirst({ where: { companyId, isTalentPool: true } });
}

export function createTalentPoolJob(companyId: string, companyName: string) {
  return prisma.job.create({
    data: {
      companyId,
      title: "Banco de talentos",
      description:
        `Cadastre seu currículo no banco de talentos da ${companyName}. ` +
        "Quando surgir uma vaga com o seu perfil, a equipe entra em contato com você. " +
        "Você também pode se candidatar a qualquer vaga aberta quando quiser.",
      status: "OPEN",
      aiMinScore: 0,
      isTalentPool: true,
      publishedAt: new Date(),
    },
  });
}

/**
 * Vagas abertas das vitrines públicas, para o sitemap (Google). Só empresas
 * ativas e fora da lista oculta (demo); nunca a vaga oculta do banco de talentos.
 */
export function findPublicOpenJobsForSitemap() {
  return prisma.job.findMany({
    where: {
      status: "OPEN",
      isTalentPool: false,
      company: { isActive: true, slug: { notIn: HIDDEN_FROM_DIRECTORY_SLUGS } },
    },
    orderBy: { updatedAt: "desc" },
    take: 5000,
    select: { id: true, updatedAt: true, company: { select: { slug: true } } },
  });
}
