import "server-only";

import { prisma } from "@/lib/prisma";

/** Recados salvos da empresa, os mais usados primeiro. */
export function findTemplatesByCompany(companyId: string) {
  return prisma.messageTemplate.findMany({
    where: { companyId },
    orderBy: [{ useCount: "desc" }, { updatedAt: "desc" }],
    take: 30,
    select: { id: true, subject: true, body: true },
  });
}

export function findTemplate(companyId: string, subjectKey: string) {
  return prisma.messageTemplate.findUnique({
    where: { companyId_subjectKey: { companyId, subjectKey } },
    select: { body: true },
  });
}

/** Um modelo por assunto e empresa: reenviar com o mesmo assunto atualiza o texto. */
export function saveTemplate(
  companyId: string,
  subject: string,
  subjectKey: string,
  body: string
) {
  return prisma.messageTemplate.upsert({
    where: { companyId_subjectKey: { companyId, subjectKey } },
    create: { companyId, subject, subjectKey, body },
    update: { subject, body, useCount: { increment: 1 } },
  });
}
