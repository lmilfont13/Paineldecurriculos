/**
 * Acesso a dados de indicadores (Referrer). Único lugar que importa Prisma
 * para esta entidade (regra 6 — camada de repository).
 */

import { prisma } from "@/lib/prisma";

// ── Queries ────────────────────────────────────────────────────────

export async function findReferrersByCompany(companyId: string) {
  return prisma.referrer.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  });
}

export async function findReferrerByCode(companyId: string, code: string) {
  return prisma.referrer.findUnique({
    where: { companyId_code: { companyId, code } },
  });
}

export async function findReferrerById(id: string) {
  return prisma.referrer.findUnique({ where: { id } });
}

/** Conta candidaturas por indicador (para o ranking). */
export async function countApplicationsByReferrer(
  companyId: string,
  referrerCodes: string[],
) {
  if (referrerCodes.length === 0) return {};
  const rows = await prisma.application.groupBy({
    by: ["referrerCode"],
    where: {
      companyId,
      referrerCode: { in: referrerCodes },
      isDemo: false,
    },
    _count: true,
  });
  const map: Record<string, number> = {};
  for (const r of rows) {
    if (r.referrerCode) map[r.referrerCode] = r._count;
  }
  return map;
}

/** Conta contratações (APPROVED) por indicador. */
export async function countHiredByReferrer(
  companyId: string,
  referrerCodes: string[],
) {
  if (referrerCodes.length === 0) return {};
  const rows = await prisma.application.groupBy({
    by: ["referrerCode"],
    where: {
      companyId,
      referrerCode: { in: referrerCodes },
      status: "APPROVED",
      isDemo: false,
    },
    _count: true,
  });
  const map: Record<string, number> = {};
  for (const r of rows) {
    if (r.referrerCode) map[r.referrerCode] = r._count;
  }
  return map;
}

// ── Mutations ──────────────────────────────────────────────────────

export async function createReferrer(data: {
  companyId: string;
  name: string;
  code: string;
}) {
  return prisma.referrer.create({ data });
}

export async function deleteReferrer(id: string) {
  return prisma.referrer.delete({ where: { id } });
}

// ── Relatórios de origem ───────────────────────────────────────────

/** Candidaturas por fonte para uma vaga (para o painel de resultados). */
export async function countApplicationsBySource(
  companyId: string,
  jobId: string,
) {
  const rows = await prisma.application.groupBy({
    by: ["source"],
    where: { companyId, jobId, isDemo: false },
    _count: true,
  });
  const map: Record<string, number> = {};
  for (const r of rows) {
    const key = r.source ?? "direto";
    map[key] = (map[key] ?? 0) + r._count;
  }
  return map;
}

/** Funil por status para uma vaga (quantos em cada etapa). */
export async function countApplicationsByStatus(
  companyId: string,
  jobId: string,
) {
  const rows = await prisma.application.groupBy({
    by: ["status"],
    where: { companyId, jobId, isDemo: false },
    _count: true,
  });
  const map: Record<string, number> = {};
  for (const r of rows) {
    map[r.status] = r._count;
  }
  return map;
}

/** Tempo médio (em dias) entre candidatura e aprovação para uma vaga. */
export async function avgTimeToHire(companyId: string, jobId: string) {
  const approved = await prisma.application.findMany({
    where: { companyId, jobId, status: "APPROVED", isDemo: false },
    select: { createdAt: true, updatedAt: true },
  });
  if (approved.length === 0) return null;
  const total = approved.reduce((sum, a) => {
    return sum + (a.updatedAt.getTime() - a.createdAt.getTime());
  }, 0);
  return Math.round(total / approved.length / (1000 * 60 * 60 * 24));
}

/** Candidaturas por dia para uma vaga (últimos 30 dias). */
export async function applicationsPerDay(companyId: string, jobId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const rows = await prisma.application.findMany({
    where: { companyId, jobId, isDemo: false, createdAt: { gte: since } },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const map: Record<string, number> = {};
  for (const r of rows) {
    const day = r.createdAt.toISOString().slice(0, 10);
    map[day] = (map[day] ?? 0) + 1;
  }
  return map;
}

/** Candidaturas por fonte para toda a empresa. */
export async function countApplicationsBySourceCompany(companyId: string) {
  const rows = await prisma.application.groupBy({
    by: ["source"],
    where: { companyId, isDemo: false },
    _count: true,
  });
  const map: Record<string, number> = {};
  for (const r of rows) {
    const key = r.source ?? "direto";
    map[key] = (map[key] ?? 0) + r._count;
  }
  return map;
}
