import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let fakePublicEnabled = false;
vi.mock("@/server/services/company-feature.service", () => ({
  isLiveSupportSpaceEnabled: vi.fn(async () => fakePublicEnabled),
  setLiveSupportSpaceEnabled: vi.fn(async (_companyId: string, enabled: boolean) => {
    fakePublicEnabled = enabled;
  }),
}));

const fakeParticipants = new Map<string, any>();
const fakeConversations = new Map<string, any>();
const fakeMessages: any[] = [];

vi.mock("@/server/repositories/support.repository", () => ({
  findParticipantById: vi.fn(async (companyId: string, id: string) => {
    const p = fakeParticipants.get(id);
    return p && p.companyId === companyId ? p : null;
  }),
  findParticipantByCandidate: vi.fn(
    async (companyId: string, candidateId: string) => {
      for (const p of fakeParticipants.values()) {
        if (p.companyId === companyId && p.candidateId === candidateId) return p;
      }
      return null;
    }
  ),
  findParticipantByUser: vi.fn(async (companyId: string, userId: string) => {
    for (const p of fakeParticipants.values()) {
      if (p.companyId === companyId && p.userId === userId) return p;
    }
    return null;
  }),
  findGuestParticipantBySecret: vi.fn(
    async (companyId: string, id: string, secretHash: string) => {
      const p = fakeParticipants.get(id);
      if (p && p.companyId === companyId && p.secretHash === secretHash) {
        return p;
      }
      return null;
    }
  ),
  upsertAuthenticatedParticipant: vi.fn(async (params: any) => {
    const id = `part_${params.kind}_${params.candidateId || params.userId}`;
    const row = {
      id,
      companyId: params.companyId,
      kind: params.kind,
      displayName: params.displayName,
      avatar: params.avatar,
      candidateId: params.candidateId ?? null,
      userId: params.userId ?? null,
      secretHash: null,
      inboxKey: params.inboxKey,
      mutedUntil: null,
      bannedAt: null,
      lastMessageAt: null,
      createdAt: new Date(),
      lastSeenAt: new Date(),
    };
    fakeParticipants.set(id, row);
    return row;
  }),
  createGuestParticipant: vi.fn(async (params: any) => {
    const id = `guest_${fakeParticipants.size + 1}`;
    const row = {
      id,
      companyId: params.companyId,
      kind: "GUEST",
      displayName: params.displayName,
      avatar: params.avatar,
      candidateId: null,
      userId: null,
      secretHash: params.secretHash,
      inboxKey: params.inboxKey,
      mutedUntil: null,
      bannedAt: null,
      lastMessageAt: null,
      createdAt: new Date(),
      lastSeenAt: new Date(),
    };
    fakeParticipants.set(id, row);
    return row;
  }),
  updateParticipantAppearance: vi.fn(async (params: any) => {
    const p = fakeParticipants.get(params.participantId);
    p.displayName = params.displayName;
    p.avatar = params.avatar;
    return p;
  }),
  touchParticipantLastSeen: vi.fn(async () => {}),
  touchParticipantLastMessage: vi.fn(
    async (_companyId: string, id: string, at: Date) => {
      const p = fakeParticipants.get(id);
      if (p) p.lastMessageAt = at;
    }
  ),
  updateParticipantModeration: vi.fn(async (params: any) => {
    const p = fakeParticipants.get(params.participantId);
    if (params.mutedUntil !== undefined) p.mutedUntil = params.mutedUntil;
    if (params.bannedAt !== undefined) p.bannedAt = params.bannedAt;
    return p;
  }),
  listOpenConversationsForCompany: vi.fn(async (companyId: string) => {
    return Array.from(fakeConversations.values()).filter(
      (c) =>
        c.companyId === companyId &&
        (c.status === "WAITING" || c.status === "ACTIVE")
    );
  }),
  findConversationById: vi.fn(async (companyId: string, id: string) => {
    const c = fakeConversations.get(id);
    return c && c.companyId === companyId ? c : null;
  }),
  nextQueueNumberToday: vi.fn(async () => fakeConversations.size + 1),
  createSupportConversation: vi.fn(async (params: any) => {
    const id = `conv_${fakeConversations.size + 1}`;
    const requester = fakeParticipants.get(params.requesterId);
    const responder = params.responderId
      ? fakeParticipants.get(params.responderId)
      : null;
    const row = {
      id,
      companyId: params.companyId,
      kind: params.kind,
      status: params.status ?? "WAITING",
      topic: params.topic ?? null,
      queueNumber: params.queueNumber ?? null,
      desk: null,
      requesterId: params.requesterId,
      responderId: params.responderId ?? null,
      createdAt: new Date(),
      startedAt: null,
      closedAt: null,
      requester,
      responder,
    };
    fakeConversations.set(id, row);
    return row;
  }),
  updateSupportConversation: vi.fn(async (params: any) => {
    const c = fakeConversations.get(params.conversationId);
    c.status = params.status;
    if (params.responderId !== undefined) {
      c.responderId = params.responderId;
      c.responder = params.responderId
        ? fakeParticipants.get(params.responderId)
        : null;
    }
    if (params.desk !== undefined) c.desk = params.desk;
    if (params.startedAt !== undefined) c.startedAt = params.startedAt;
    if (params.closedAt !== undefined) c.closedAt = params.closedAt;
    return c;
  }),
  closeAllConversationsOfParticipant: vi.fn(async () => {}),
  listMessagesByConversation: vi.fn(
    async (_companyId: string, conversationId: string) =>
      fakeMessages.filter((m) => m.conversationId === conversationId)
  ),
  createSupportMessageRecord: vi.fn(async (params: any) => {
    const sender = fakeParticipants.get(params.senderId);
    const msg = {
      id: `msg_${fakeMessages.length + 1}`,
      conversationId: params.conversationId,
      senderId: params.senderId,
      body: params.body,
      createdAt: new Date(),
      sender: { displayName: sender.displayName, kind: sender.kind },
    };
    fakeMessages.push(msg);
    return msg;
  }),
  createSupportReportRecord: vi.fn(async () => ({ id: "rep_1" })),
  listOpenReportsForCompany: vi.fn(async () => []),
  resolveSupportReportRecord: vi.fn(async () => {}),
}));

import { DEFAULT_AVATAR } from "@/server/models/support.model";
import {
  callServiceTicketToDesk,
  enterSupportSpace,
  getSupportSpaceState,
  joinSupportQueue,
  requestCandidateDm,
  sendPrivateSupportMessage,
  toggleSupportSpacePublicVisibility,
} from "./support.service";

describe("support.service", () => {
  beforeEach(() => {
    fakeParticipants.clear();
    fakeConversations.clear();
    fakeMessages.length = 0;
    fakePublicEnabled = false;
  });

  it("permite visitante anônimo entrar na fila do RH, mas impede DM com outros candidatos", async () => {
    const guestRes = await enterSupportSpace(
      { companyId: "comp_1" },
      { displayName: "Visitante Curioso", avatar: DEFAULT_AVATAR }
    );
    expect(guestRes.participant.kind).toBe("GUEST");
    expect(guestRes.newGuestCookie).toBeDefined();

    const candRes = await enterSupportSpace(
      {
        companyId: "comp_1",
        candidate: { id: "cand_1", name: "Vanessa Freitas", email: "v@test.com" },
      },
      { displayName: "Vanessa Freitas", avatar: DEFAULT_AVATAR }
    );
    expect(candRes.participant.kind).toBe("CANDIDATE");

    const guestActor = {
      companyId: "comp_1",
      guestCookie: guestRes.newGuestCookie!,
    };

    // Anônimo consegue retirar senha para falar com o RH
    const ticket = await joinSupportQueue(guestActor, "VAGA");
    expect(ticket.kind).toBe("SERVICE");
    expect(ticket.queueNumber).toBe(1);

    // Mas anônimo NÃO pode chamar candidato no privado
    await expect(
      requestCandidateDm(guestActor, candRes.participant.id)
    ).rejects.toThrow(/anônimos/i);
  });

  it("permite tanto gestor da empresa quanto admin da plataforma chamar senha para o balcão", async () => {
    const guestRes = await enterSupportSpace(
      { companyId: "comp_1" },
      { displayName: "Carlos", avatar: DEFAULT_AVATAR }
    );
    const guestActor = {
      companyId: "comp_1",
      guestCookie: guestRes.newGuestCookie!,
    };
    const ticket = await joinSupportQueue(guestActor, "CANDIDATURA");

    // Admin da plataforma (sem companyId fixo) atende no Balcão 2
    const adminActor = {
      companyId: "comp_1",
      staffUser: {
        id: "admin_1",
        name: "Luciano Admin",
        email: "admin@triagem.com",
        role: "ADMIN" as const,
        companyId: null,
      },
    };

    const active = await callServiceTicketToDesk(adminActor, ticket.id, 2);
    expect(active.status).toBe("ACTIVE");
    expect(active.desk).toBe(2);

    // Visitante responde no privado para o atendente
    const msg = await sendPrivateSupportMessage(
      guestActor,
      active.id,
      "Olá, gostaria de saber sobre a vaga de analista!"
    );
    expect(msg.body).toContain("analista");
  });

  it("permite ao gestor/admin desativar e ativar a sala para os candidatos (Modo Teste)", async () => {
    const managerActor = {
      companyId: "comp_1",
      staffUser: {
        id: "mgr_1",
        name: "Gestor RH",
        email: "rh@empresa.com",
        role: "MANAGER" as const,
        companyId: "comp_1",
      },
    };

    const initialState = await getSupportSpaceState(managerActor);
    expect(initialState.isPublicEnabled).toBe(false);

    // Gestor libera para os candidatos
    const enabled = await toggleSupportSpacePublicVisibility(managerActor, true);
    expect(enabled).toBe(true);

    const afterEnable = await getSupportSpaceState(managerActor);
    expect(afterEnable.isPublicEnabled).toBe(true);

    // Visitante não pode alterar essa configuração
    await expect(
      toggleSupportSpacePublicVisibility({ companyId: "comp_1" }, false)
    ).rejects.toThrow(/gestor/i);
  });
});

