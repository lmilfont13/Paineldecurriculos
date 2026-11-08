import "server-only";

import { prisma } from "@/lib/prisma";

export async function findApplicationsForBirthdays(companyId: string) {
  return prisma.application.findMany({
    where: {
      companyId,
      isDemo: false,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      candidateId: true,
      name: true,
      email: true,
      phone: true,
      photoPath: true,
      birthDate: true,
      resumeText: true,
      job: {
        select: {
          title: true,
          code: true,
        },
      },
    },
  });
}
