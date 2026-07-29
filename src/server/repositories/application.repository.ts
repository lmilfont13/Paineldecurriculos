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

/** Dedupe (CA6): candidato só se candidata uma vez por vaga. */
export function findApplicationByCandidateAndJob(
  candidateId: string,
  jobId: string
) {
  return prisma.application.findUnique({
    where: { candidateId_jobId: { candidateId, jobId } },
  });
}

/** Última candidatura do candidato na empresa — pré-preenche extras (CA3). */
export function findLatestApplicationWithAnswers(
  candidateId: string,
  companyId: string
) {
  return prisma.application.findFirst({
    where: { candidateId, companyId },
    orderBy: { createdAt: "desc" },
    include: { answers: true },
  });
}

/** Caminhos de currículo no Storage ligados ao candidato (CA8). */
export async function findResumePathsByCandidate(candidateId: string) {
  const apps = await prisma.application.findMany({
    where: { candidateId, resumeUrl: { not: null } },
    select: { resumeUrl: true },
  });
  return apps.map((a) => a.resumeUrl!).filter(Boolean);
}

/**
 * CA8 (LGPD): anonimiza as candidaturas do candidato — a empresa mantém o
 * registro do processo, mas sem dados pessoais.
 */
export function anonymizeApplicationsByCandidate(candidateId: string) {
  return prisma.application.updateMany({
    where: { candidateId },
    data: {
      name: "Candidato(a) — conta excluída",
      email: "conta-excluida",
      phone: null,
      resumeUrl: null,
    },
  });
}

/** Candidaturas do candidato em todas as empresas (CA4). */
export function findApplicationsByCandidate(candidateId: string) {
  return prisma.application.findMany({
    where: { candidateId },
    orderBy: { createdAt: "desc" },
    include: {
      job: { select: { title: true } },
      company: { select: { name: true, slug: true } },
    },
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
      statusEvents: { orderBy: { createdAt: "asc" } },
    },
  });
}

/** Trilha de status (histórico do gestor + timeline do candidato). */
export function createStatusEvent(data: {
  applicationId: string;
  from: "PENDING" | "INTERVIEW" | "APPROVED" | "REJECTED" | null;
  to: "PENDING" | "INTERVIEW" | "APPROVED" | "REJECTED";
  actor: "candidato" | "gestor" | "sistema";
}) {
  return prisma.statusEvent.create({ data });
}

export function findStatusEvents(applicationId: string) {
  return prisma.statusEvent.findMany({
    where: { applicationId },
    orderBy: { createdAt: "asc" },
  });
}

export function updateManagerNotes(id: string, managerNotes: string | null) {
  return prisma.application.update({ where: { id }, data: { managerNotes } });
}

/** Candidatura do candidato (detalhe da timeline), com posse verificada. */
export function findApplicationForCandidate(
  candidateId: string,
  applicationId: string
) {
  return prisma.application.findFirst({
    where: { id: applicationId, candidateId },
    include: {
      job: { select: { title: true } },
      company: { select: { name: true, slug: true } },
      answers: { include: { field: true } },
      statusEvents: { orderBy: { createdAt: "asc" } },
    },
  });
}

export function deleteApplication(id: string) {
  return prisma.application.delete({ where: { id } });
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
  candidateId: string;
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
