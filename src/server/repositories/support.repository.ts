import "server-only";

import type {
  Prisma,
  SupportConversationKind,
  SupportConversationStatus,
  SupportParticipantKind,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AvatarConfig } from "@/server/models/support.model";

const participantBasicSelect = {
  id: true,
  companyId: true,
  kind: true,
  displayName: true,
  avatar: true,
  candidateId: true,
  userId: true,
  secretHash: true,
  inboxKey: true,
  mutedUntil: true,
  bannedAt: true,
  lastMessageAt: true,
  createdAt: true,
  lastSeenAt: true,
} satisfies Prisma.SupportParticipantSelect;

const conversationWithPartiesSelect = {
  id: true,
  companyId: true,
  kind: true,
  status: true,
  topic: true,
  queueNumber: true,
  desk: true,
  requesterId: true,
  responderId: true,
  createdAt: true,
  startedAt: true,
  closedAt: true,
  requester: {
    select: {
      id: true,
      displayName: true,
      kind: true,
      avatar: true,
    },
  },
  responder: {
    select: {
      id: true,
      displayName: true,
      kind: true,
      avatar: true,
    },
  },
} satisfies Prisma.SupportConversationSelect;

export async function findParticipantById(companyId: string, id: string) {
  return prisma.supportParticipant.findFirst({
    where: { id, companyId },
    select: participantBasicSelect,
  });
}

export async function findParticipantByCandidate(
  companyId: string,
  candidateId: string
) {
  return prisma.supportParticipant.findUnique({
    where: { companyId_candidateId: { companyId, candidateId } },
    select: participantBasicSelect,
  });
}

export async function findParticipantByUser(companyId: string, userId: string) {
  return prisma.supportParticipant.findUnique({
    where: { companyId_userId: { companyId, userId } },
    select: participantBasicSelect,
  });
}

export async function findGuestParticipantBySecret(
  companyId: string,
  participantId: string,
  secretHash: string
) {
  return prisma.supportParticipant.findFirst({
    where: {
      id: participantId,
      companyId,
      kind: "GUEST",
      secretHash,
    },
    select: participantBasicSelect,
  });
}

export async function upsertAuthenticatedParticipant(params: {
  companyId: string;
  kind: "CANDIDATE" | "STAFF";
  candidateId?: string;
  userId?: string;
  displayName: string;
  avatar: AvatarConfig;
  inboxKey: string;
}) {
  if (params.kind === "CANDIDATE" && params.candidateId) {
    return prisma.supportParticipant.upsert({
      where: {
        companyId_candidateId: {
          companyId: params.companyId,
          candidateId: params.candidateId,
        },
      },
      create: {
        companyId: params.companyId,
        kind: "CANDIDATE",
        candidateId: params.candidateId,
        displayName: params.displayName,
        avatar: params.avatar as unknown as Prisma.InputJsonValue,
        inboxKey: params.inboxKey,
        lastSeenAt: new Date(),
      },
      update: {
        displayName: params.displayName,
        avatar: params.avatar as unknown as Prisma.InputJsonValue,
        lastSeenAt: new Date(),
      },
      select: participantBasicSelect,
    });
  }

  if (params.kind === "STAFF" && params.userId) {
    return prisma.supportParticipant.upsert({
      where: {
        companyId_userId: {
          companyId: params.companyId,
          userId: params.userId,
        },
      },
      create: {
        companyId: params.companyId,
        kind: "STAFF",
        userId: params.userId,
        displayName: params.displayName,
        avatar: params.avatar as unknown as Prisma.InputJsonValue,
        inboxKey: params.inboxKey,
        lastSeenAt: new Date(),
      },
      update: {
        displayName: params.displayName,
        avatar: params.avatar as unknown as Prisma.InputJsonValue,
        lastSeenAt: new Date(),
      },
      select: participantBasicSelect,
    });
  }

  throw new Error("Participante autenticado inválido.");
}

export async function createGuestParticipant(params: {
  companyId: string;
  displayName: string;
  avatar: AvatarConfig;
  secretHash: string;
  inboxKey: string;
}) {
  return prisma.supportParticipant.create({
    data: {
      companyId: params.companyId,
      kind: "GUEST",
      displayName: params.displayName,
      avatar: params.avatar as unknown as Prisma.InputJsonValue,
      secretHash: params.secretHash,
      inboxKey: params.inboxKey,
      lastSeenAt: new Date(),
    },
    select: participantBasicSelect,
  });
}

export async function updateParticipantAppearance(params: {
  companyId: string;
  participantId: string;
  displayName: string;
  avatar: AvatarConfig;
}) {
  return prisma.supportParticipant.update({
    where: { id: params.participantId, companyId: params.companyId },
    data: {
      displayName: params.displayName,
      avatar: params.avatar as unknown as Prisma.InputJsonValue,
      lastSeenAt: new Date(),
    },
    select: participantBasicSelect,
  });
}

export async function touchParticipantLastSeen(
  companyId: string,
  participantId: string
) {
  await prisma.supportParticipant.updateMany({
    where: { id: participantId, companyId },
    data: { lastSeenAt: new Date() },
  });
}

export async function touchParticipantLastMessage(
  companyId: string,
  participantId: string,
  at: Date
) {
  await prisma.supportParticipant.updateMany({
    where: { id: participantId, companyId },
    data: { lastMessageAt: at, lastSeenAt: at },
  });
}

export async function updateParticipantModeration(params: {
  companyId: string;
  participantId: string;
  mutedUntil?: Date | null;
  bannedAt?: Date | null;
}) {
  return prisma.supportParticipant.update({
    where: { id: params.participantId, companyId: params.companyId },
    data: {
      ...(params.mutedUntil !== undefined ? { mutedUntil: params.mutedUntil } : {}),
      ...(params.bannedAt !== undefined ? { bannedAt: params.bannedAt } : {}),
    },
    select: participantBasicSelect,
  });
}

export async function listOpenConversationsForCompany(companyId: string) {
  return prisma.supportConversation.findMany({
    where: {
      companyId,
      status: { in: ["WAITING", "ACTIVE"] },
    },
    orderBy: [{ queueNumber: "asc" }, { createdAt: "asc" }],
    select: conversationWithPartiesSelect,
  });
}

export async function findConversationById(
  companyId: string,
  conversationId: string
) {
  return prisma.supportConversation.findFirst({
    where: { id: conversationId, companyId },
    select: conversationWithPartiesSelect,
  });
}

export async function nextQueueNumberToday(companyId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const agg = await prisma.supportConversation.aggregate({
    where: {
      companyId,
      kind: "SERVICE",
      createdAt: { gte: startOfDay },
    },
    _max: { queueNumber: true },
  });
  return (agg._max.queueNumber ?? 0) + 1;
}

export async function createSupportConversation(params: {
  companyId: string;
  kind: SupportConversationKind;
  status?: SupportConversationStatus;
  topic?: string | null;
  queueNumber?: number | null;
  requesterId: string;
  responderId?: string | null;
}) {
  return prisma.supportConversation.create({
    data: {
      companyId: params.companyId,
      kind: params.kind,
      status: params.status ?? "WAITING",
      topic: params.topic ?? null,
      queueNumber: params.queueNumber ?? null,
      requesterId: params.requesterId,
      responderId: params.responderId ?? null,
    },
    select: conversationWithPartiesSelect,
  });
}

export async function updateSupportConversation(params: {
  companyId: string;
  conversationId: string;
  status: SupportConversationStatus;
  responderId?: string | null;
  desk?: number | null;
  startedAt?: Date | null;
  closedAt?: Date | null;
}) {
  return prisma.supportConversation.update({
    where: { id: params.conversationId, companyId: params.companyId },
    data: {
      status: params.status,
      ...(params.responderId !== undefined ? { responderId: params.responderId } : {}),
      ...(params.desk !== undefined ? { desk: params.desk } : {}),
      ...(params.startedAt !== undefined ? { startedAt: params.startedAt } : {}),
      ...(params.closedAt !== undefined ? { closedAt: params.closedAt } : {}),
    },
    select: conversationWithPartiesSelect,
  });
}

export async function closeAllConversationsOfParticipant(
  companyId: string,
  participantId: string
) {
  await prisma.supportConversation.updateMany({
    where: {
      companyId,
      status: { in: ["WAITING", "ACTIVE"] },
      OR: [{ requesterId: participantId }, { responderId: participantId }],
    },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
    },
  });
}

export async function listMessagesByConversation(
  companyId: string,
  conversationId: string,
  limit = 80
) {
  return prisma.supportMessage.findMany({
    where: { companyId, conversationId },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      body: true,
      createdAt: true,
      sender: {
        select: {
          displayName: true,
          kind: true,
        },
      },
    },
  });
}

export async function createSupportMessageRecord(params: {
  companyId: string;
  conversationId: string;
  senderId: string;
  body: string;
}) {
  return prisma.supportMessage.create({
    data: {
      companyId: params.companyId,
      conversationId: params.conversationId,
      senderId: params.senderId,
      body: params.body,
    },
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      body: true,
      createdAt: true,
      sender: {
        select: {
          displayName: true,
          kind: true,
        },
      },
    },
  });
}

export async function createSupportReportRecord(params: {
  companyId: string;
  reporterId: string;
  targetId: string;
  reason: string;
  excerpt?: string | null;
}) {
  return prisma.supportReport.create({
    data: {
      companyId: params.companyId,
      reporterId: params.reporterId,
      targetId: params.targetId,
      reason: params.reason,
      excerpt: params.excerpt ?? null,
    },
    select: { id: true },
  });
}

export async function listOpenReportsForCompany(companyId: string) {
  return prisma.supportReport.findMany({
    where: { companyId, resolvedAt: null },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      reason: true,
      excerpt: true,
      createdAt: true,
      reporter: { select: { displayName: true } },
      target: { select: { id: true, displayName: true } },
    },
  });
}

export async function resolveSupportReportRecord(
  companyId: string,
  reportId: string
) {
  await prisma.supportReport.updateMany({
    where: { id: reportId, companyId },
    data: { resolvedAt: new Date() },
  });
}

export type { SupportParticipantKind };

