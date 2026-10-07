import "server-only";

import type { AIState } from "@prisma/client";

import { prisma } from "@/lib/prisma";



export async function createAgentRun(data: {
  companyId: string;
  applicationId?: string;
  agent: "TRIAGE" | "COMMUNICATION" | "INTELLIGENCE";
  eventName: string;
}) {
  return prisma.agentRun.create({
    data: { ...data, status: "QUEUED" },
  });
}

export async function updateAgentRun(
  id: string,
  data: {
    status?: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
    attempts?: number;
    durationMs?: number;
    summary?: string;
    error?: string;
    startedAt?: Date;
    finishedAt?: Date;
  }
) {
  return prisma.agentRun.update({ where: { id }, data });
}

export async function getAgentRuns(companyId: string) {
  return prisma.agentRun.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      application: { select: { name: true, job: { select: { title: true } } } },
    },
  });
}

export async function getAgentCenterData(companyId: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [applications, communications, runs] = await Promise.all([
    prisma.application.findMany({
      where: { companyId },
      orderBy: { updatedAt: "desc" },
      take: 500,
      select: {
        id: true,
        name: true,
        status: true,
        aiState: true,
        aiScore: true,
        createdAt: true,
        updatedAt: true,
        job: { select: { title: true } },
      },
    }),
    prisma.statusEvent.count({
      where: {
        createdAt: { gte: since },
        application: { companyId },
      },
    }),
    prisma.agentRun.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        application: {
          select: { name: true, job: { select: { title: true } } },
        },
      },
    }),
  ]);

  const recentApplications = applications.slice(0, 6);
  const recentRuns = runs;
  const totalRuns = runs.filter((run) => run.createdAt >= since).length;
  const succeeded = runs.filter((run) => run.createdAt >= since && run.status === "SUCCEEDED").length;
  const failed = runs.filter((run) => run.createdAt >= since && run.status === "FAILED").length;
  const queued = runs.filter((run) => run.status === "QUEUED").length;
  const running = runs.filter((run) => run.status === "RUNNING").length;

  return {
    windowLabel: "Últimos 7 dias",
    submitted: applications.filter((a) => a.createdAt >= since).length,
    aiDone: applications.filter((a) => a.aiState === "DONE" && a.updatedAt >= since).length,
    aiProcessing: applications.filter((a) => a.aiState === "PROCESSING").length,
    aiFailed: applications.filter((a) => a.aiState === "FAILED").length,
    communications,
    recentApplications,
    runs: recentRuns,
    runMetrics: { total: totalRuns, succeeded, failed, queued, running },
  };
}

export async function getCompanyIntelligenceSnapshot(companyId: string) {
  const applications = await prisma.application.findMany({
    where: { companyId },
    select: {
      status: true,
      aiState: true,
      aiScore: true,
      createdAt: true,
      job: {
        select: {
          title: true,
          aiMinScore: true,
          aiCriteria: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const byJob = new Map<string, {
    total: number;
    analyzed: number;
    qualified: number;
    pending: number;
    interview: number;
    approved: number;
    rejected: number;
    scoreSum: number;
    scored: number;
    minScore: number;
  }>();

  for (const app of applications) {
    const current = byJob.get(app.job.title) ?? {
      total: 0, analyzed: 0, qualified: 0, pending: 0, interview: 0,
      approved: 0, rejected: 0, scoreSum: 0, scored: 0, minScore: app.job.aiMinScore,
    };

    current.total += 1;
    if (app.aiState === "DONE") current.analyzed += 1;
    if (app.aiScore !== null) {
      current.scored += 1;
      current.scoreSum += app.aiScore;
      if (app.aiScore >= app.job.aiMinScore) current.qualified += 1;
    }
    if (app.status === "PENDING") current.pending += 1;
    if (app.status === "INTERVIEW") current.interview += 1;
    if (app.status === "APPROVED") current.approved += 1;
    if (app.status === "REJECTED") current.rejected += 1;
    byJob.set(app.job.title, current);
  }

  const jobs = Array.from(byJob.entries()).map(([title, value]) => ({
    title,
    ...value,
    averageScore: value.scored ? Math.round(value.scoreSum / value.scored) : null,
    qualificationRate: value.scored ? Math.round((value.qualified / value.scored) * 100) : null,
  }));

  return {
    totalApplications: applications.length,
    analyzed: applications.filter((a) => a.aiState === "DONE").length,
    processing: applications.filter((a) => a.aiState === "PROCESSING").length,
    failed: applications.filter((a) => a.aiState === "FAILED").length,
    averageScore: (() => {
      const scored = applications.filter((a) => a.aiScore !== null);
      return scored.length ? Math.round(scored.reduce((sum, a) => sum + (a.aiScore ?? 0), 0) / scored.length) : null;
    })(),
    jobs,
  };
}

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

/** IDs de vagas em que o candidato já tem candidatura (para indicador na lista). */
export async function findAppliedJobIds(
  candidateId: string,
  jobIds: string[]
): Promise<string[]> {
  const rows = await prisma.application.findMany({
    where: { candidateId, jobId: { in: jobIds } },
    select: { jobId: true },
  });
  return rows.map((r) => r.jobId);
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
      company: { select: { id: true, name: true, slug: true, primaryColor: true, logoUrl: true } },
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

/** Combina (ou remarca) a conversa da candidatura. */
export function updateInterview(
  id: string,
  data: {
    interviewAt: Date;
    interviewMode: string;
    interviewLocation: string | null;
    status?: "INTERVIEW";
  }
) {
  return prisma.application.update({ where: { id }, data });
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
      notifications: {
        where: { type: "MANAGER_MESSAGE" },
        orderBy: { createdAt: "desc" },
      },
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