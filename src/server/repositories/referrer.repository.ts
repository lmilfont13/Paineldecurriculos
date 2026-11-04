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
    map[r.source ?? "desconhecido"] = r._count;
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
    map[r.source ?? "desconhecido"] = r._count;
  }
  return map;
}
