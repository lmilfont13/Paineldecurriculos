import type { AppStatus } from "@prisma/client";
import { removeNulChars } from "@/server/models/text.model";
import "server-only";

import { Prisma, type AIState } from "@prisma/client";

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

const ACTIVE_RUN_STATUSES = ["QUEUED", "RUNNING"] as const;
const ANALYZING_AI_STATES = ["WAITING", "PROCESSING"] as const;

/**
 * Watchdog: execuções QUEUED/RUNNING paradas há mais que o limite viram
 * FAILED (a função foi congelada ou o evento nunca chegou). Candidaturas
 * presas em "Analisando…" voltam como FAILED para o gestor poder reanalisar.
 * Regra 2: só mexe em aiState, nunca em AppStatus.
 */
export async function failStaleAgentRuns(
  cutoff: Date,
  reason: string,
  companyId?: string
): Promise<{ runs: number; applications: number }> {
  const scope = companyId ? { companyId } : {};
  const now = new Date();

  const runs = await prisma.agentRun.updateMany({
    where: {
      ...scope,
      status: { in: [...ACTIVE_RUN_STATUSES] },
      OR: [
        { startedAt: { lt: cutoff } },
        { startedAt: null, createdAt: { lt: cutoff } },
      ],
    },
    data: { status: "FAILED", error: reason, finishedAt: now },
  });

  const applications = await prisma.application.updateMany({
    where: {
      ...scope,
      aiState: { in: [...ANALYZING_AI_STATES] },
      updatedAt: { lt: cutoff },
    },
    data: { aiState: "FAILED" },
  });

  return { runs: runs.count, applications: applications.count };
}

/** Candidaturas por IDs, sempre filtradas pelo tenant (para o relatório gerencial). */
export function findApplicationsByIds(companyId: string, ids: string[]) {
  return prisma.application.findMany({
    where: { companyId, id: { in: ids } },
    select: { id: true },
  });
}

/** Estado da IA de algumas candidaturas do tenant (polling leve da UI). */
export function findAiStates(companyId: string, ids: string[]) {
  return prisma.application.findMany({
    where: { companyId, id: { in: ids } },
    select: { id: true, aiState: true },
  });
}

/** Execuções ativas do tenant (polling leve da tela de agentes). */
export function findActiveAgentRuns(companyId: string) {
  return prisma.agentRun.findMany({
    where: { companyId, status: { in: [...ACTIVE_RUN_STATUSES] } },
    select: { id: true, status: true, summary: true },
  });
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

  // Sequencial: com connection_limit=1 o Promise.all só enfileira.
  // Números reais: a simulação (isDemo) fica de fora.
  const applications = await prisma.application.findMany({
    where: { companyId, isDemo: false },
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
  });
  const communications = await prisma.statusEvent.count({
    where: {
      createdAt: { gte: since },
      application: { companyId, isDemo: false },
    },
  });
  const runs = await prisma.agentRun.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      application: {
        select: { name: true, job: { select: { title: true } } },
      },
    },
  });

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
  // A leitura da Inteligência olha só candidaturas reais (sem simulação).
  const applications = await prisma.application.findMany({
    where: { companyId, isDemo: false },
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
  filters?: { since?: Date; status?: AppStatus }
) {
  return prisma.application.count({
    where: {
      companyId,
      isDemo: false,
      ...(filters?.since ? { createdAt: { gte: filters.since } } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
    },
  });
}

/** Pendentes por vaga (badge "N novas" da lista E2). */
export async function countPendingGroupedByJob(companyId: string) {
  const groups = await prisma.application.groupBy({
    by: ["jobId"],
    where: { companyId, status: "PENDING", isDemo: false },
    _count: { _all: true },
  });
  return new Map(groups.map((g) => [g.jobId, g._count._all]));
}

/**
 * Candidaturas com a vaga (para score vs. aiMinScore e listas do gestor).
 * `includeDemo: false` tira a simulação (painel e números).
 */
export function findApplicationsByCompany(
  companyId: string,
  options: { includeDemo?: boolean } = {}
) {
  return prisma.application.findMany({
    where: {
      companyId,
      ...(options.includeDemo === false ? { isDemo: false } : {}),
    },
    orderBy: [{ aiScore: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    include: { job: { select: { id: true, title: true, code: true, aiMinScore: true } } },
    omit: { resumeText: true },
  });
}

/** Data de nascimento e texto do currículo de uma vaga, só para calcular a idade exibida ao gestor. */
export function findAgeSourcesForJob(companyId: string, jobId: string) {
  return prisma.application.findMany({
    where: { companyId, jobId },
    select: { id: true, birthDate: true, resumeText: true },
  });
}

/** Busca avançada de CVs (nível Michelin): dados enriquecidos para busca facetada e snippets. */
export function findApplicationsForCvSearch(companyId: string) {
  return prisma.application.findMany({
    where: { companyId },
    orderBy: [{ aiScore: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    include: {
      job: {
        select: {
          id: true,
          title: true,
          location: true,
          workMode: true,
          contract: true,
          aiMinScore: true,
        },
      },
      answers: {
        select: {
          value: true,
          field: {
            select: {
              label: true,
              type: true,
            },
          },
        },
      },
    },
  });
}

/** Busca por conteúdo: ids das candidaturas do tenant cujo nome/e-mail/currículo contêm o termo. */
export async function searchApplicationIds(companyId: string, term: string) {
  const rows = await prisma.application.findMany({
    where: {
      companyId,
      OR: [
        { resumeText: { contains: term, mode: "insensitive" } },
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { aiProfile: { contains: term, mode: "insensitive" } },
        { aiArea: { contains: term, mode: "insensitive" } },
      ],
    },
    select: { id: true },
    take: 500,
  });
  return rows.map((r) => r.id);
}

export function updateApplicationResumeText(id: string, resumeText: string) {
  return prisma.application.update({ where: { id }, data: { resumeText: removeNulChars(resumeText) } });
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
    where: {
      candidateId,
      OR: [{ resumeUrl: { not: null } }, { photoPath: { not: null } }],
    },
    select: { resumeUrl: true, photoPath: true },
  });
  // Currículos e fotos recortadas (LGPD: tudo sai junto com a conta).
  return apps.flatMap((a) => [a.resumeUrl, a.photoPath]).filter((p): p is string => !!p);
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
      photoPath: null,
      // pré-entrevista: dados pessoais e sensíveis também saem (LGPD)
      maritalStatus: null,
      hasChildren: null,
      childrenCount: null,
      professionalSummary: null,
      rg: null,
      cpf: null,
      infoRequestedFields: [],
      infoRequestedAt: null,
      infoAnsweredAt: null,
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
          code: true,
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
  from: AppStatus | null;
  to: AppStatus;
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

/** Corrige o texto de respostas da candidatura (só as que pertencem a ela). */
export function updateAnswerValues(applicationId: string, updates: { id: string; value: string }[]) {
  return prisma.$transaction(
    updates.map((u) =>
      prisma.answer.updateMany({ where: { id: u.id, applicationId }, data: { value: removeNulChars(u.value) ?? "" } })
    )
  );
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
    aiModel?: string | null;
    aiChecklist?: Prisma.InputJsonValue | typeof Prisma.DbNull;
    aiProfile?: string | null;
    aiArea?: string | null;
    aiLevel?: string | null;
    resumeText?: string | null;
    aiState: "WAITING" | "PROCESSING" | "DONE" | "FAILED" | "NO_RESUME";
  }
) {
  // Texto de PDF pode trazer U+0000, que o Postgres recusa: sem isto a análise
  // inteira falhava na hora de salvar o resultado.
  const clean = {
    ...data,
    aiReasoning: removeNulChars(data.aiReasoning),
    aiProfile: removeNulChars(data.aiProfile),
    aiArea: removeNulChars(data.aiArea),
    aiLevel: removeNulChars(data.aiLevel),
    resumeText: removeNulChars(data.resumeText),
    aiChecklist:
      data.aiChecklist === Prisma.DbNull ? data.aiChecklist : removeNulChars(data.aiChecklist),
  };
  return prisma.application.update({ where: { id }, data: clean });
}

export function updateApplicationStatus(
  id: string,
  status: AppStatus
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
  birthDate?: Date | null;
  city?: string | null;
  state?: string | null;
  neighborhood?: string | null;
  desiredRole?: string | null;
  salaryExpectation?: string | null;
  workPreference?: string | null;
  availability?: string | null;
  hasCnh?: string | null;
  isPcd?: boolean;
  pcdDetails?: string | null;
  aiState: AIState;
  answers: { fieldId: string; value: string }[];
  isDemo?: boolean;
  preRegistered?: boolean;
}) {
  const { answers, ...application } = data;
  return prisma.application.create({
    data: {
      ...application,
      answers: { create: answers },
    },
  });
}
/** Candidaturas da sala de simulação (para "Limpar simulação"). */
export async function findDemoApplicationIds(companyId: string) {
  const rows = await prisma.application.findMany({
    where: { companyId, isDemo: true },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Foto recortada do currículo (null quando o PDF não tem foto). */
export function updateApplicationPhoto(id: string, photoPath: string | null) {
  return prisma.application.update({ where: { id }, data: { photoPath } });
}

/** IDs das candidaturas de uma vaga do tenant (exclusão da vaga). */
export async function findApplicationIdsByJob(companyId: string, jobId: string) {
  const rows = await prisma.application.findMany({
    where: { companyId, jobId },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/**
 * Candidaturas reais (não demonstração) para a sala de simulação: mais
 * recentes primeiro, de uma vaga ou de todas.
 */
export function findRealApplicationsForSimulation(
  companyId: string,
  jobId: string | null,
  limit: number
) {
  return prisma.application.findMany({
    where: { companyId, isDemo: false, ...(jobId ? { jobId } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, name: true },
  });
}

/** Quantas candidaturas reais cada vaga tem (seletor da sala). */
export async function countRealApplicationsByJob(companyId: string) {
  const rows = await prisma.application.groupBy({
    by: ["jobId"],
    where: { companyId, isDemo: false },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.jobId, r._count._all]));
}

/** Análise de perfil sob demanda (não mexe em etapa nem na nota da vaga). */
export function updateApplicationCareer(id: string, aiCareer: Prisma.InputJsonValue) {
  return prisma.application.update({ where: { id }, data: { aiCareer: removeNulChars(aiCareer) } });
}

/**
 * O candidato completou o cadastro rápido feito pelo gestor: troca dados,
 * currículo e respostas e volta a candidatura para a fila da IA.
 */
export function completePreRegisteredApplication(
  id: string,
  data: {
    name: string;
    phone: string | null;
    resumeUrl: string | null;
    birthDate?: Date | null;
    city?: string | null;
    state?: string | null;
    neighborhood?: string | null;
    desiredRole?: string | null;
    salaryExpectation?: string | null;
    workPreference?: string | null;
    availability?: string | null;
    hasCnh?: string | null;
    isPcd?: boolean;
    pcdDetails?: string | null;
    answers: { fieldId: string; value: string }[];
  }
) {
  const { answers, ...rest } = data;
  return prisma.$transaction(async (tx) => {
    await tx.answer.deleteMany({ where: { applicationId: id } });
    return tx.application.update({
      where: { id },
      data: {
        ...rest,
        preRegistered: false,
        aiState: "WAITING",
        answers: { create: answers },
      },
    });
  });
}

/** Currículo anexado pelo gestor (ex.: recebido por e-mail). */
export function updateApplicationResume(id: string, resumeUrl: string) {
  return prisma.application.update({ where: { id }, data: { resumeUrl, aiState: "WAITING" } });
}

/** Registra o pedido de pré-entrevista (quais perguntas e quando); reabre a resposta. */
export function updateInfoRequest(
  id: string,
  data: { infoRequestedFields: string[]; infoRequestedAt: Date }
) {
  return prisma.application.update({
    where: { id },
    data: { ...data, infoAnsweredAt: null },
  });
}

/** Grava o que o candidato respondeu (só as chaves pedidas chegam aqui). */
export function updateInfoAnswers(
  id: string,
  data: {
    maritalStatus?: string;
    hasChildren?: boolean;
    childrenCount?: number | null;
    professionalSummary?: string;
    rg?: string;
    cpf?: string;
    infoAnsweredAt: Date;
  }
) {
  return prisma.application.update({ where: { id }, data });
}

/** Outras candidaturas da mesma pessoa (pelo e-mail) na empresa, para o aviso da ficha. */
export function findOtherApplicationsByEmail(companyId: string, email: string, excludeId: string) {
  return prisma.application.findMany({
    where: {
      companyId,
      id: { not: excludeId },
      isDemo: false,
      email: { equals: email.trim(), mode: "insensitive" },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      status: true,
      createdAt: true,
      job: { select: { title: true, code: true } },
    },
  });
}

/** Candidaturas de uma vaga com o material que a análise comparativa lê. */
export function findApplicationsForShortlist(companyId: string, jobId: string) {
  return prisma.application.findMany({
    where: { companyId, jobId, isDemo: false },
    select: {
      id: true,
      name: true,
      status: true,
      aiScore: true,
      aiReasoning: true,
      aiProfile: true,
      aiArea: true,
      aiLevel: true,
      aiChecklist: true,
      resumeText: true,
    },
  });
}

/** Candidaturas de uma vaga com a avaliação já gravada, para o relatório da diretoria. */
export function findApplicationsForReport(companyId: string, jobId: string) {
  return prisma.application.findMany({
    where: { companyId, jobId, isDemo: false },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      status: true,
      aiScore: true,
      aiReasoning: true,
      aiProfile: true,
      aiArea: true,
      aiLevel: true,
      aiChecklist: true,
      salaryExpectation: true,
      availability: true,
      city: true,
      neighborhood: true,
      createdAt: true,
    },
  });
}

/** Candidaturas da empresa (só as dela) com o necessário para um recado em massa. */
export function findApplicationsForBulkMessage(companyId: string, ids: string[]) {
  return prisma.application.findMany({
    where: { companyId, id: { in: ids } },
    select: {
      id: true,
      name: true,
      email: true,
      candidateId: true,
      isDemo: true,
      job: { select: { title: true, code: true } },
    },
  });
}

/** Candidaturas reais da empresa (todas as vagas) para o relatório geral em PDF. */
export function findApplicationsForPortfolio(companyId: string) {
  return prisma.application.findMany({
    where: { companyId, isDemo: false },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      jobId: true,
      name: true,
      email: true,
      status: true,
      aiScore: true,
      aiReasoning: true,
      aiProfile: true,
      aiArea: true,
      aiLevel: true,
      aiChecklist: true,
      salaryExpectation: true,
      availability: true,
      city: true,
      neighborhood: true,
      hasCnh: true,
      workPreference: true,
      createdAt: true,
    },
  });
}
