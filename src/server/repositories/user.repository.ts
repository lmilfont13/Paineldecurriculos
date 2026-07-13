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

export function prismaCreateManagerUser(data: {
  email: string;
  name: string;
  companyId: string;
}) {
  return prisma.user.create({
    data: { ...data, role: "MANAGER" },
  });
}
