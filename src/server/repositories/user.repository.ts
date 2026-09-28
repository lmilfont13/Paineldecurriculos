import "server-only";

import { prisma } from "@/lib/prisma";

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export function findManagerByCompanyId(companyId: string) {
  return prisma.user.findFirst({
    where: { companyId, role: "MANAGER" },
    select: { email: true, name: true },
  });
}

export function findUsersByCompany(companyId: string) {
  return prisma.user.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
}

export function prismaCreateManagerUser(data: {
  email: string;
  name: string;
  companyId: string;
}) {
  return prisma.user.create({
    data: { ...data, role: "MANAGER" },
  });
}

export function deleteUserById(id: string) {
  return prisma.user.delete({ where: { id } });
}
