import "server-only";

import type { AIState } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export function countApplicationsByJobId(jobId: string) {
  return prisma.application.count({ where: { jobId } });
}

export function countApplicationsByCompany(
  companyId: string,
  filters?: { since?: Date; status?: "PENDING" | "INTERVIEW" | "APPROVED" | "REJECTED" }
) {
  return prisma.application.count({
    where: {
      companyId,
      ...(filters?.since ? { createdAt: { gte: filters.since } } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
    },
  });
}

/** Pendentes por vaga (badge "N novas" da lista E2). */
export async function countPendingGroupedByJob(companyId: string) {
  const groups = await prisma.application.groupBy({
    by: ["jobId"],
    where: { companyId, status: "PENDING" },
    _count: { _all: true },
  });
  return new Map(groups.map((g) => [g.jobId, g._count._all]));
}

/** Candidaturas com a vaga (para score vs. aiMinScore e listas do gestor). */
export function findApplicationsByCompany(companyId: string) {
  return prisma.application.findMany({
    where: { companyId },
    orderBy: [{ aiScore: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    include: { job: { select: { id: true, title: true, aiMinScore: true } } },
  });
}

export function findApplicationById(id: string) {
  return prisma.application.findUnique({
    where: { id },
    include: {
      job: {
        select: {
          id: true,
          title: true,
          aiMinScore: true,
          aiCriteria: true,
          requirements: true,
        },
      },
      answers: { include: { field: true } },
    },
  });
}

/** Regra 2: a IA só escreve aiScore/aiReasoning/aiState — nunca AppStatus. */
export function updateApplicationAi(
  id: string,
  data: {
    aiScore?: number | null;
    aiReasoning?: string | null;
    aiState: "WAITING" | "PROCESSING" | "DONE" | "FAILED" | "NO_RESUME";
  }
) {
  return prisma.application.update({ where: { id }, data });
}

export function updateApplicationStatus(
  id: string,
  status: "PENDING" | "INTERVIEW" | "APPROVED" | "REJECTED"
) {
  return prisma.application.update({ where: { id }, data: { status } });
}

export function createApplication(data: {
  jobId: string;
  companyId: string;
  name: string;
  email: string;
  phone: string | null;
  resumeUrl: string | null;
  aiState: AIState;
  answers: { fieldId: string; value: string }[];
}) {
  const { answers, ...application } = data;
  return prisma.application.create({
    data: {
      ...application,
      answers: { create: answers },
    },
  });
}
