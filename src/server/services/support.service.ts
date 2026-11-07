import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { readEnv } from "@/lib/env";
import {
  DEFAULT_AVATAR,
  containsProfanity,
  normalizeAvatar,
  type ActivePrivatePairDTO,
  type AvatarConfig,
  type SupportConversationDTO,
  type SupportMessageDTO,
  type SupportParticipantDTO,
  type SupportReportDTO,
  type SupportSpaceStateDTO,
  type SupportTopicId,
} from "@/server/models/support.model";
import {
  closeAllConversationsOfParticipant,
  createGuestParticipant,
  createSupportConversation,
  createSupportMessageRecord,
  createSupportReportRecord,
  findConversationById,
  findGuestParticipantBySecret,
  findParticipantByCandidate,
  findParticipantById,
  findParticipantByUser,
  listMessagesByConversation,
  listOpenConversationsForCompany,
  listOpenReportsForCompany,
  nextQueueNumberToday,
  resolveSupportReportRecord,
  touchParticipantLastMessage,
  touchParticipantLastSeen,
  updateParticipantAppearance,
  updateParticipantModeration,
  updateSupportConversation,
  upsertAuthenticatedParticipant,
} from "@/server/repositories/support.repository";
import {
  isLiveSupportSpaceEnabled,
  setLiveSupportSpaceEnabled,
} from "@/server/services/company-feature.service";

export interface SupportViewerActor {
  companyId: string;
  staffUser?: {
    id: string;
    name: string | null;
    email: string;
    role: "ADMIN" | "MANAGER";
    companyId: string | null;
  } | null;
  candidate?: {
    id: string;
    name: string;
    email: string;
  } | null;
  guestCookie?: {
    participantId: string;
    secret: string;
  } | null;
}

export function hashGuestSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function generateRandomToken(bytes = 18): string {
  return randomBytes(bytes).toString("hex");
}

function isStaffAuthorizedForCompany(
  staffUser: SupportViewerActor["staffUser"],
  companyId: string
): boolean {
  if (!staffUser) return false;
  if (staffUser.role === "ADMIN") return true;
  return staffUser.role === "MANAGER" && staffUser.companyId === companyId;
}

function isCurrentlyMuted(mutedUntil: Date | null): boolean {
  return Boolean(mutedUntil && mutedUntil.getTime() > Date.now());
}

function toParticipantDTO(row: {
  id: string;
  kind: "GUEST" | "CANDIDATE" | "STAFF";
  displayName: string;
  avatar: unknown;
  mutedUntil: Date | null;
  bannedAt: Date | null;
}): SupportParticipantDTO {
  return {
    id: row.id,
    kind: row.kind,
    displayName: row.displayName,
    avatar: normalizeAvatar(row.avatar),
    isMuted: isCurrentlyMuted(row.mutedUntil),
    isBanned: Boolean(row.bannedAt),
  };
}

function toConversationDTO(row: {
  id: string;
  kind: "SERVICE" | "DM";
  status: "WAITING" | "ACTIVE" | "CLOSED" | "DECLINED";
  topic: string | null;
  queueNumber: number | null;
  desk: number | null;
  createdAt: Date;
  startedAt: Date | null;
  requester: {
    id: string;
    displayName: string;
    kind: "GUEST" | "CANDIDATE" | "STAFF";
    avatar: unknown;
  };
  responder: {
    id: string;
    displayName: string;
    kind: "GUEST" | "CANDIDATE" | "STAFF";
    avatar: unknown;
  } | null;
}): SupportConversationDTO {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    topic: row.topic,
    queueNumber: row.queueNumber,
    desk: row.desk,
    requester: {
      id: row.requester.id,
      displayName: row.requester.displayName,
      kind: row.requester.kind,
      avatar: normalizeAvatar(row.requester.avatar),
    },
    responder: row.responder
      ? {
          id: row.responder.id,
          displayName: row.responder.displayName,
          kind: row.responder.kind,
          avatar: normalizeAvatar(row.responder.avatar),
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
  };
}

/** Dispara aviso em tempo real no canal privado de inbox do destinatário (best-effort) */
async function notifyPrivateInbox(
  inboxKey: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey =
    readEnv("SUPABASE_SERVICE_ROLE_KEY") ?? readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey || !inboxKey) return;

  try {
    await fetch(`${supabaseUrl.replace(/\/+$/, "")}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `espaco-inbox:${inboxKey}`,
            event,
            payload,
          },
        ],
      }),
    });
  } catch {
    // Fallback silencioso: o cliente também sincroniza via Server Action
  }
}

export async function resolveCurrentParticipant(actor: SupportViewerActor) {
  const { companyId, staffUser, candidate, guestCookie } = actor;

  if (staffUser && isStaffAuthorizedForCompany(staffUser, companyId)) {
    const existing = await findParticipantByUser(companyId, staffUser.id);
    if (existing) {
      await touchParticipantLastSeen(companyId, existing.id);
      return existing;
    }
    const defaultStaffName =
      staffUser.name?.trim() ||
      (staffUser.role === "ADMIN" ? "Admin da Plataforma" : "Equipe RH");
    return upsertAuthenticatedParticipant({
      companyId,
      kind: "STAFF",
      userId: staffUser.id,
      displayName: defaultStaffName,
      avatar: { ...DEFAULT_AVATAR, shirt: "#d97706", accessory: "headset" },
      inboxKey: generateRandomToken(18),
    });
  }

  if (candidate) {
    const existing = await findParticipantByCandidate(companyId, candidate.id);
    if (existing) {
      await touchParticipantLastSeen(companyId, existing.id);
      return existing;
    }
    return null;
  }

  if (guestCookie?.participantId && guestCookie?.secret) {
    const found = await findGuestParticipantBySecret(
      companyId,
      guestCookie.participantId,
      hashGuestSecret(guestCookie.secret)
    );
    if (found) {
      await touchParticipantLastSeen(companyId, found.id);
      return found;
    }
  }

  return null;
}

export async function enterSupportSpace(
  actor: SupportViewerActor,
  input: { displayName: string; avatar: AvatarConfig }
): Promise<{
  participant: SupportParticipantDTO & { inboxKey: string };
  newGuestCookie?: { participantId: string; secret: string };
}> {
  const { companyId, staffUser, candidate, guestCookie } = actor;
  const cleanName = input.displayName.trim();

  if (containsProfanity(cleanName)) {
    throw new Error("Escolha um nome ou apelido respeitoso.");
  }

  if (staffUser && isStaffAuthorizedForCompany(staffUser, companyId)) {
    const saved = await upsertAuthenticatedParticipant({
      companyId,
      kind: "STAFF",
      userId: staffUser.id,
      displayName: cleanName,
      avatar: input.avatar,
      inboxKey: generateRandomToken(18),
    });
    return {
      participant: { ...toParticipantDTO(saved), inboxKey: saved.inboxKey },
    };
  }

  if (candidate) {
    const existing = await findParticipantByCandidate(companyId, candidate.id);
    if (existing?.bannedAt) {
      throw new Error("Seu acesso ao espaço desta empresa foi suspenso.");
    }
    const saved = await upsertAuthenticatedParticipant({
      companyId,
      kind: "CANDIDATE",
      candidateId: candidate.id,
      displayName: cleanName,
      avatar: input.avatar,
      inboxKey: generateRandomToken(18),
    });
    return {
      participant: { ...toParticipantDTO(saved), inboxKey: saved.inboxKey },
    };
  }

  if (guestCookie?.participantId && guestCookie?.secret) {
    const existing = await findGuestParticipantBySecret(
      companyId,
      guestCookie.participantId,
      hashGuestSecret(guestCookie.secret)
    );
    if (existing) {
      if (existing.bannedAt) {
        throw new Error("Seu acesso ao espaço desta empresa foi suspenso.");
      }
      const updated = await updateParticipantAppearance({
        companyId,
        participantId: existing.id,
        displayName: cleanName,
        avatar: input.avatar,
      });
      return {
        participant: { ...toParticipantDTO(updated), inboxKey: updated.inboxKey },
      };
    }
  }

  const secret = generateRandomToken(20);
  const created = await createGuestParticipant({
    companyId,
    displayName: cleanName,
    avatar: input.avatar,
    secretHash: hashGuestSecret(secret),
    inboxKey: generateRandomToken(18),
  });

  return {
    participant: { ...toParticipantDTO(created), inboxKey: created.inboxKey },
    newGuestCookie: { participantId: created.id, secret },
  };
}

export async function getSupportSpaceState(
  actor: SupportViewerActor,
  focusedConversationId?: string | null
): Promise<SupportSpaceStateDTO> {
  const { companyId, staffUser, candidate } = actor;
  const isStaff = isStaffAuthorizedForCompany(staffUser, companyId);
  const viewerRole: "GUEST" | "CANDIDATE" | "STAFF" = isStaff
    ? "STAFF"
    : candidate
      ? "CANDIDATE"
      : "GUEST";

  const prefillName = isStaff
    ? staffUser?.name?.trim() || "Equipe RH"
    : candidate?.name?.trim() || null;

  const meRow = await resolveCurrentParticipant(actor);
  const [openConvs, isPublicEnabled] = await Promise.all([
    listOpenConversationsForCompany(companyId),
    isLiveSupportSpaceEnabled(companyId).catch(() => false),
  ]);

  const waitingServiceList = openConvs.filter(
    (c) => c.kind === "SERVICE" && c.status === "WAITING"
  );
  const activeServiceList = openConvs.filter(
    (c) => c.kind === "SERVICE" && c.status === "ACTIVE"
  );
  const activeAllList = openConvs.filter((c) => c.status === "ACTIVE");

  const activePrivatePairs: ActivePrivatePairDTO[] = activeAllList.map((c) => ({
    conversationId: c.id,
    kind: c.kind,
    desk: c.desk,
    requesterId: c.requester.id,
    requesterName: c.requester.displayName,
    responderId: c.responder?.id ?? null,
    responderName: c.responder?.displayName ?? null,
  }));

  let myWaitingTicket: SupportConversationDTO | null = null;
  let myPositionInQueue: number | null = null;
  let myActiveConversation: SupportConversationDTO | null = null;
  let myIncomingDmRequests: SupportConversationDTO[] = [];
  let myOutgoingDmRequest: SupportConversationDTO | null = null;

  if (meRow) {
    const waitingIdx = waitingServiceList.findIndex(
      (c) => c.requesterId === meRow.id
    );
    if (waitingIdx >= 0) {
      myWaitingTicket = toConversationDTO(waitingServiceList[waitingIdx]);
      myPositionInQueue = waitingIdx + 1;
    }

    const activeMine = activeAllList.find(
      (c) =>
        c.requesterId === meRow.id ||
        c.responderId === meRow.id ||
        (isStaff && c.kind === "SERVICE" && c.id === focusedConversationId)
    );
    if (activeMine) {
      myActiveConversation = toConversationDTO(activeMine);
    } else if (isStaff && activeServiceList.length > 0) {
      myActiveConversation = toConversationDTO(activeServiceList[0]);
    }

    myIncomingDmRequests = openConvs
      .filter(
        (c) =>
          c.kind === "DM" &&
          c.status === "WAITING" &&
          c.responderId === meRow.id
      )
      .map(toConversationDTO);

    const outgoingDm = openConvs.find(
      (c) =>
        c.kind === "DM" &&
        c.status === "WAITING" &&
        c.requesterId === meRow.id
    );
    if (outgoingDm) {
      myOutgoingDmRequest = toConversationDTO(outgoingDm);
    }
  }

  let activeMessages: SupportMessageDTO[] = [];
  if (myActiveConversation && meRow) {
    const rawMsgs = await listMessagesByConversation(
      companyId,
      myActiveConversation.id
    );
    activeMessages = rawMsgs.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      senderName: m.sender.displayName,
      senderKind: m.sender.kind,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  let staffOpenReports: SupportReportDTO[] = [];
  if (isStaff) {
    const reports = await listOpenReportsForCompany(companyId);
    staffOpenReports = reports.map((r) => ({
      id: r.id,
      reporterName: r.reporter.displayName,
      targetId: r.target.id,
      targetName: r.target.displayName,
      reason: r.reason,
      excerpt: r.excerpt,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  return {
    isPublicEnabled,
    me: meRow
      ? { ...toParticipantDTO(meRow), inboxKey: meRow.inboxKey }
      : null,
    viewerRole,
    prefillName,
    queueCount: waitingServiceList.length,
    myWaitingTicket,
    myPositionInQueue,
    myActiveConversation,
    myIncomingDmRequests,
    myOutgoingDmRequest,
    activeMessages,
    activePrivatePairs,
    staffQueue: isStaff ? waitingServiceList.map(toConversationDTO) : [],
    staffActiveDesks: isStaff ? activeServiceList.map(toConversationDTO) : [],
    staffOpenReports,
  };
}

export async function joinSupportQueue(
  actor: SupportViewerActor,
  topic: SupportTopicId
): Promise<SupportConversationDTO> {
  const me = await resolveCurrentParticipant(actor);
  if (!me) {
    throw new Error("Entre no espaço antes de retirar uma senha.");
  }
  if (me.bannedAt) {
    throw new Error("Seu acesso ao espaço está suspenso.");
  }

  const openConvs = await listOpenConversationsForCompany(actor.companyId);
  const existing = openConvs.find(
    (c) =>
      c.kind === "SERVICE" &&
      (c.requesterId === me.id || c.responderId === me.id)
  );
  if (existing) {
    return toConversationDTO(existing);
  }

  const queueNumber = await nextQueueNumberToday(actor.companyId);
  const created = await createSupportConversation({
    companyId: actor.companyId,
    kind: "SERVICE",
    status: "WAITING",
    topic,
    queueNumber,
    requesterId: me.id,
  });

  await createSupportMessageRecord({
    companyId: actor.companyId,
    conversationId: created.id,
    senderId: me.id,
    body: `Senha #${queueNumber} retirada (${topic}). Aguardando atendimento da equipe.`,
  });

  return toConversationDTO(created);
}

export async function callServiceTicketToDesk(
  actor: SupportViewerActor,
  conversationId: string,
  desk: number
): Promise<SupportConversationDTO> {
  if (!isStaffAuthorizedForCompany(actor.staffUser, actor.companyId)) {
    throw new Error("Apenas o gestor da empresa ou o admin pode chamar senhas.");
  }
  const staffParticipant = await resolveCurrentParticipant(actor);
  if (!staffParticipant) {
    throw new Error("Participante da equipe não encontrado.");
  }

  const conv = await findConversationById(actor.companyId, conversationId);
  if (!conv || conv.kind !== "SERVICE") {
    throw new Error("Senha de atendimento não encontrada.");
  }

  const normalizedDesk = Math.min(3, Math.max(1, Math.round(desk || 1)));
  const updated = await updateSupportConversation({
    companyId: actor.companyId,
    conversationId: conv.id,
    status: "ACTIVE",
    responderId: staffParticipant.id,
    desk: normalizedDesk,
    startedAt: new Date(),
  });

  await createSupportMessageRecord({
    companyId: actor.companyId,
    conversationId: conv.id,
    senderId: staffParticipant.id,
    body: `Olá ${conv.requester.displayName}! Chamei você para o Balcão ${normalizedDesk}. Como posso ajudar?`,
  });

  const requesterFull = await findParticipantById(
    actor.companyId,
    conv.requesterId
  );
  if (requesterFull?.inboxKey) {
    await notifyPrivateInbox(requesterFull.inboxKey, "ticket_called", {
      conversationId: updated.id,
      desk: normalizedDesk,
      staffName: staffParticipant.displayName,
    });
  }

  return toConversationDTO(updated);
}

export async function requestCandidateDm(
  actor: SupportViewerActor,
  targetParticipantId: string
): Promise<SupportConversationDTO> {
  const me = await resolveCurrentParticipant(actor);
  if (!me) {
    throw new Error("Entre no espaço primeiro.");
  }
  if (me.bannedAt || isCurrentlyMuted(me.mutedUntil)) {
    throw new Error("Você não pode iniciar conversas privadas no momento.");
  }
  if (me.kind === "GUEST") {
    throw new Error(
      "Visitantes anônimos usam o balão público e o Atendimento RH. Faça login como candidato para conversar no privado com colegas!"
    );
  }
  if (me.id === targetParticipantId) {
    throw new Error("Escolha outra pessoa para conversar.");
  }

  const target = await findParticipantById(actor.companyId, targetParticipantId);
  if (!target || target.bannedAt) {
    throw new Error("Participante não encontrado.");
  }
  if (target.kind === "GUEST" && me.kind !== "STAFF") {
    throw new Error(
      "Este visitante está no modo anônimo e só conversa nos balões públicos ou com o RH."
    );
  }

  const openConvs = await listOpenConversationsForCompany(actor.companyId);
  const alreadyOpen = openConvs.find(
    (c) =>
      c.kind === "DM" &&
      ((c.requesterId === me.id && c.responderId === target.id) ||
        (c.requesterId === target.id && c.responderId === me.id))
  );
  if (alreadyOpen) {
    return toConversationDTO(alreadyOpen);
  }

  const status = me.kind === "STAFF" ? "ACTIVE" : "WAITING";
  const created = await createSupportConversation({
    companyId: actor.companyId,
    kind: "DM",
    status,
    requesterId: me.id,
    responderId: target.id,
  });

  await notifyPrivateInbox(target.inboxKey, "dm_invite", {
    conversationId: created.id,
    fromName: me.displayName,
    autoActive: status === "ACTIVE",
  });

  return toConversationDTO(created);
}

export async function respondToCandidateDm(
  actor: SupportViewerActor,
  conversationId: string,
  accept: boolean
): Promise<SupportConversationDTO> {
  const me = await resolveCurrentParticipant(actor);
  if (!me) {
    throw new Error("Sessão não encontrada.");
  }

  const conv = await findConversationById(actor.companyId, conversationId);
  if (!conv || conv.kind !== "DM" || conv.responderId !== me.id) {
    throw new Error("Convite de conversa privada não encontrado.");
  }

  const updated = await updateSupportConversation({
    companyId: actor.companyId,
    conversationId: conv.id,
    status: accept ? "ACTIVE" : "DECLINED",
    startedAt: accept ? new Date() : null,
    closedAt: accept ? null : new Date(),
  });

  const requester = await findParticipantById(actor.companyId, conv.requesterId);
  if (requester?.inboxKey) {
    await notifyPrivateInbox(requester.inboxKey, "dm_response", {
      conversationId: updated.id,
      accepted: accept,
      responderName: me.displayName,
    });
  }

  return toConversationDTO(updated);
}

export async function closeSupportConversation(
  actor: SupportViewerActor,
  conversationId: string
): Promise<void> {
  const me = await resolveCurrentParticipant(actor);
  if (!me) return;

  const conv = await findConversationById(actor.companyId, conversationId);
  if (!conv) return;

  const isStaff = isStaffAuthorizedForCompany(actor.staffUser, actor.companyId);
  const isParty = conv.requesterId === me.id || conv.responderId === me.id;
  if (!isStaff && !isParty) {
    throw new Error("Sem permissão para encerrar esta conversa.");
  }

  await updateSupportConversation({
    companyId: actor.companyId,
    conversationId: conv.id,
    status: "CLOSED",
    closedAt: new Date(),
  });
}

export async function sendPrivateSupportMessage(
  actor: SupportViewerActor,
  conversationId: string,
  body: string
): Promise<SupportMessageDTO> {
  const me = await resolveCurrentParticipant(actor);
  if (!me) {
    throw new Error("Entre no espaço para enviar mensagens.");
  }
  if (me.bannedAt) {
    throw new Error("Seu acesso ao espaço está suspenso.");
  }
  if (isCurrentlyMuted(me.mutedUntil)) {
    throw new Error("Você está temporariamente silenciado pela moderação.");
  }

  const now = new Date();
  if (me.lastMessageAt && now.getTime() - me.lastMessageAt.getTime() < 1200) {
    throw new Error("Aguarde um instante antes de enviar outra mensagem.");
  }

  const cleanBody = body.trim();
  if (!cleanBody) {
    throw new Error("Digite uma mensagem.");
  }
  if (containsProfanity(cleanBody)) {
    throw new Error(
      "Mensagem bloqueada pelo filtro de respeito. Por favor, use termos cordiais."
    );
  }

  const conv = await findConversationById(actor.companyId, conversationId);
  if (!conv || conv.status !== "ACTIVE") {
    throw new Error("Esta conversa não está mais ativa.");
  }

  const isStaff = isStaffAuthorizedForCompany(actor.staffUser, actor.companyId);
  const isParty =
    conv.requesterId === me.id ||
    conv.responderId === me.id ||
    (isStaff && conv.kind === "SERVICE");

  if (!isParty) {
    throw new Error("Apenas os participantes podem ler ou enviar mensagens aqui.");
  }

  const saved = await createSupportMessageRecord({
    companyId: actor.companyId,
    conversationId: conv.id,
    senderId: me.id,
    body: cleanBody,
  });
  await touchParticipantLastMessage(actor.companyId, me.id, now);

  const dto: SupportMessageDTO = {
    id: saved.id,
    conversationId: saved.conversationId,
    senderId: saved.senderId,
    senderName: saved.sender.displayName,
    senderKind: saved.sender.kind,
    body: saved.body,
    createdAt: saved.createdAt.toISOString(),
  };

  const otherId =
    conv.requesterId === me.id ? conv.responderId : conv.requesterId;
  if (otherId) {
    const other = await findParticipantById(actor.companyId, otherId);
    if (other?.inboxKey) {
      await notifyPrivateInbox(other.inboxKey, "private_message", {
        message: dto,
      });
    }
  }

  return dto;
}

export async function submitSupportReport(
  actor: SupportViewerActor,
  input: { targetParticipantId: string; reason: string; excerpt?: string }
): Promise<void> {
  const me = await resolveCurrentParticipant(actor);
  if (!me || me.bannedAt) {
    throw new Error("Entre no espaço para registrar uma denúncia.");
  }
  if (me.id === input.targetParticipantId) {
    throw new Error("Não é possível denunciar a si mesmo.");
  }
  const target = await findParticipantById(
    actor.companyId,
    input.targetParticipantId
  );
  if (!target) {
    throw new Error("Participante não encontrado.");
  }

  await createSupportReportRecord({
    companyId: actor.companyId,
    reporterId: me.id,
    targetId: target.id,
    reason: input.reason.trim(),
    excerpt: input.excerpt?.trim() || null,
  });
}

export async function moderateSupportParticipant(
  actor: SupportViewerActor,
  input: {
    targetParticipantId: string;
    action: "mute" | "unmute" | "ban" | "unban";
  }
): Promise<SupportParticipantDTO> {
  if (!isStaffAuthorizedForCompany(actor.staffUser, actor.companyId)) {
    throw new Error("Apenas o gestor da empresa ou o admin pode moderar.");
  }

  const target = await findParticipantById(
    actor.companyId,
    input.targetParticipantId
  );
  if (!target) {
    throw new Error("Participante não encontrado.");
  }
  if (target.kind === "STAFF") {
    throw new Error("Não é possível aplicar punição a um membro da equipe.");
  }

  let mutedUntil: Date | null | undefined = undefined;
  let bannedAt: Date | null | undefined = undefined;

  if (input.action === "mute") {
    mutedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
  } else if (input.action === "unmute") {
    mutedUntil = null;
  } else if (input.action === "ban") {
    bannedAt = new Date();
    await closeAllConversationsOfParticipant(actor.companyId, target.id);
  } else if (input.action === "unban") {
    bannedAt = null;
  }

  const updated = await updateParticipantModeration({
    companyId: actor.companyId,
    participantId: target.id,
    mutedUntil,
    bannedAt,
  });

  await notifyPrivateInbox(target.inboxKey, "moderation", {
    action: input.action,
  });

  return toParticipantDTO(updated);
}

export async function resolveSupportReport(
  actor: SupportViewerActor,
  reportId: string
): Promise<void> {
  if (!isStaffAuthorizedForCompany(actor.staffUser, actor.companyId)) {
    throw new Error("Sem permissão.");
  }
  await resolveSupportReportRecord(actor.companyId, reportId);
}

export async function toggleSupportSpacePublicVisibility(
  actor: SupportViewerActor,
  enabled: boolean
): Promise<boolean> {
  if (!isStaffAuthorizedForCompany(actor.staffUser, actor.companyId)) {
    throw new Error(
      "Apenas o gestor da empresa ou o admin da plataforma pode ativar ou desativar a sala para candidatos."
    );
  }
  await setLiveSupportSpaceEnabled(actor.companyId, Boolean(enabled));
  return Boolean(enabled);
}


