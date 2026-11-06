import "server-only";

import { prisma } from "@/lib/prisma";
import type { GlobalSearchResult } from "@/server/models/search.model";

export async function findGlobalGestorItems(
  companyId: string,
  rawQuery: string
): Promise<GlobalSearchResult> {
  const query = rawQuery.trim();

  // Se a busca estiver vazia, retorna vagas recentes da empresa e lista vazia de candidatos
  if (!query) {
    const jobs = await prisma.job.findMany({
      where: { companyId, isTalentPool: false },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        code: true,
        status: true,
        _count: { select: { applications: true } },
      },
    });

    return {
      candidates: [],
      jobs: jobs.map((j) => ({
        id: j.id,
        title: j.title,
        code: j.code,
        status: j.status,
        applicationsCount: j._count.applications,
      })),
    };
  }

  // Busca candidatos por nome ou e-mail dentro da empresa
  const candidates = await prisma.application.findMany({
    where: {
      companyId,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      aiScore: true,
      job: { select: { id: true, title: true } },
    },
  });

  // Busca vagas por título ou código dentro da empresa
  const jobs = await prisma.job.findMany({
    where: {
      companyId,
      isTalentPool: false,
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { code: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: {
      id: true,
      title: true,
      code: true,
      status: true,
      _count: { select: { applications: true } },
    },
  });

  return {
    candidates: candidates.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      jobId: c.job.id,
      jobTitle: c.job.title,
      status: c.status,
      aiScore: c.aiScore,
    })),
    jobs: jobs.map((j) => ({
      id: j.id,
      title: j.title,
      code: j.code,
      status: j.status,
      applicationsCount: j._count.applications,
    })),
  };
}

