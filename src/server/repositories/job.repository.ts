import "server-only";

import { prisma } from "@/lib/prisma";

export function findOpenJobsByCompanyId(companyId: string) {
  return prisma.job.findMany({
    where: { companyId, status: "OPEN" },
    orderBy: { createdAt: "desc" },
  });
}

export function findJobById(id: string) {
  return prisma.job.findUnique({ where: { id } });
}

export function findJobsByCompanyId(companyId: string) {
  return prisma.job.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { applications: true } } },
  });
}

export function countJobsByCompanyId(companyId: string, onlyOpen = false) {
  return prisma.job.count({
    where: { companyId, ...(onlyOpen ? { status: "OPEN" as const } : {}) },
  });
}

export function createJob(data: {
  companyId: string;
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

export function updateJob(
  id: string,
  data: Partial<{
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
