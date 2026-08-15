import "server-only";

import type { AppStatus } from "@prisma/client";

import {
  receivedNotification,
  stageNotification,
} from "@/server/models/notification.model";
import {
  countUnreadNotifications,
  createNotification,
  findNotificationsByCandidate,
  markNotificationsRead,
} from "@/server/repositories/notification.repository";

/**
 * Um evento, três destinos: a mesma mudança que vira trilha (`StatusEvent`) e
 * e-mail também vira novidade dentro do site. Notificar nunca pode derrubar o
 * fluxo do gestor nem o do candidato — por isso todas as chamadas daqui são
 * fire-and-forget na origem.
 */
export async function notifyStageChange(params: {
  candidateId: string | null;
  applicationId: string;
  to: AppStatus;
  companyName: string;
  jobTitle: string;
}): Promise<void> {
  if (!params.candidateId) return; // candidatura antiga, sem conta ligada
  const content = stageNotification(
    params.to,
    params.companyName,
    params.jobTitle
  );
  if (!content) return;
  await createNotification({
    candidateId: params.candidateId,
    applicationId: params.applicationId,
    type: content.type,
    title: content.title,
    body: content.body,
  });
}

export async function notifyApplicationReceived(params: {
  candidateId: string;
  applicationId: string;
  companyName: string;
  jobTitle: string;
}): Promise<void> {
  const content = receivedNotification(params.companyName, params.jobTitle);
  await createNotification({
    candidateId: params.candidateId,
    applicationId: params.applicationId,
    type: content.type,
    title: content.title,
    body: content.body,
  });
}

export function listCandidateNotifications(candidateId: string) {
  return findNotificationsByCandidate(candidateId);
}

export function countCandidateUnread(candidateId: string) {
  return countUnreadNotifications(candidateId);
}

/** Marca lidas (todas ou um subconjunto), sempre no escopo do dono. */
export async function markRead(
  candidateId: string,
  ids?: string[]
): Promise<number> {
  const { count } = await markNotificationsRead(candidateId, ids);
  return count;
}
