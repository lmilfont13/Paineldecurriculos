import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** Avaliações de uma candidatura, sempre dentro da empresa (regra 1). */
export function findInterviewEvaluations(companyId: string, applicationId: string) {
  return prisma.interviewEvaluation.findMany({
    where: { companyId, applicationId },
    orderBy: { updatedAt: "desc" },
  });
}

/** Cria ou atualiza a avaliação deste avaliador para esta candidatura. */
export function upsertInterviewEvaluation(data: {
  companyId: string;
  applicationId: string;
  evaluatorId: string;
  evaluatorName: string | null;
  evaluatorEmail: string;
  criteria: Prisma.InputJsonValue;
  recommendation: string | null;
  summary: string | null;
}) {
  const { companyId, applicationId, evaluatorId, ...rest } = data;
  return prisma.interviewEvaluation.upsert({
    where: { applicationId_evaluatorId: { applicationId, evaluatorId } },
    create: { companyId, applicationId, evaluatorId, ...rest },
    update: rest,
  });
}

/** LGPD: ao excluir a conta, as avaliações (opiniões sobre a pessoa) saem junto. */
export function deleteInterviewEvaluationsByCandidate(candidateId: string) {
  return prisma.interviewEvaluation.deleteMany({ where: { application: { candidateId } } });
}
