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
  data: Partial<{
    name: string;
    phone: string | null;
    resumeUrl: string | null;
    birthDate: Date | null;
    city: string | null;
    state: string | null;
    neighborhood: string | null;
    zipCode: string | null;
    street: string | null;
    streetNumber: string | null;
    complement: string | null;
    rg: string | null;
    cpf: string | null;
    bootSize: string | null;
    hasBankAccount: string | null;
    bankNames: string | null;
    bankAccountType: string | null;
    pantsSize: string | null;
    shirtSize: string | null;
    desiredRole: string | null;
    salaryExpectation: string | null;
    workPreference: string | null;
    availability: string | null;
    hasCnh: string | null;
    isPcd: boolean;
    pcdDetails: string | null;
  }>
) {
  return prisma.candidate.update({ where: { id }, data });
}

/** Cadastro rápido virou conta: liga o usuário de login ao candidato. */
export function linkCandidateAuth(id: string, authId: string | null, name: string) {
  return prisma.candidate.update({ where: { id }, data: { authId, name } });
}
