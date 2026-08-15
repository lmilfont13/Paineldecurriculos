import "server-only";

import type { NotificationType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export function createNotification(data: {
  candidateId: string;
  applicationId: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
}) {
  return prisma.notification.create({ data });
}

/** Novidades do candidato, mais recentes primeiro. */
export function findNotificationsByCandidate(
  candidateId: string,
  take = 50
) {
  return prisma.notification.findMany({
    where: { candidateId },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      application: {
        select: { id: true, job: { select: { title: true } } },
      },
    },
  });
}

export function countUnreadNotifications(candidateId: string) {
  return prisma.notification.count({
    where: { candidateId, readAt: null },
  });
}

/** Marca como lida — sempre no escopo do candidato dono. */
export function markNotificationsRead(candidateId: string, ids?: string[]) {
  return prisma.notification.updateMany({
    where: {
      candidateId,
      readAt: null,
      ...(ids?.length ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  });
}
