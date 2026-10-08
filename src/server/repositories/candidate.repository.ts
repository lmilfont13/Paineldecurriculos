import "server-only";

import { prisma } from "@/lib/prisma";

export function findCandidateByEmail(email: string) {
  return prisma.candidate.findUnique({ where: { email } });
}

export function createCandidate(data: {
  email: string;
  name: string;
  authId: string | null;
}) {
  return prisma.candidate.create({ data });
}

export function deleteCandidate(id: string) {
  return prisma.candidate.delete({ where: { id } });
}

export function updateCandidate(
  id: string,
  data: Partial<{ name: string; phone: string | null; resumeUrl: string | null }>
) {
  return prisma.candidate.update({ where: { id }, data });
}

/** Cadastro rápido virou conta: liga o usuário de login ao candidato. */
export function linkCandidateAuth(id: string, authId: string | null, name: string) {
  return prisma.candidate.update({ where: { id }, data: { authId, name } });
}
