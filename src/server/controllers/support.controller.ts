"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  enterSpaceSchema,
  moderateParticipantSchema,
  reportParticipantSchema,
  requestTicketSchema,
  sendSupportMessageSchema,
  type AssistantBotId,
  type AvatarConfig,
  type SupportSpaceStateDTO,
} from "@/server/models/support.model";
import { getSessionUser } from "@/server/services/auth.service";
import { getSessionCandidate } from "@/server/services/candidate.service";
import { getPublicCompanyBySlug } from "@/server/services/company.service";
import {
  askSupportBotAi,
  callServiceTicketToDesk,
  closeSupportConversation,
  enterSupportSpace,
  getSupportSpaceState,
  joinSupportQueue,
  moderateSupportParticipant,
  requestCandidateDm,
  resolveSupportReport,
  respondToCandidateDm,
  sendPrivateSupportMessage,
  submitSupportReport,
  toggleSupportSpacePublicVisibility,
  type SupportViewerActor,
} from "@/server/services/support.service";

function guestCookieName(companyId: string): string {
  return `triagem_espaco_${companyId}`;
}

async function resolveViewerActor(slug: string): Promise<SupportViewerActor> {
  const company = await getPublicCompanyBySlug(slug);
  if (!company) {
    throw new Error("Empresa não encontrada.");
  }

  const [staffUser, candidate, cookieStore] = await Promise.all([
    getSessionUser(),
    getSessionCandidate(),
    cookies(),
  ]);

  let guestCookie: { participantId: string; secret: string } | null = null;
  const rawCookie = cookieStore.get(guestCookieName(company.id))?.value;
  if (rawCookie) {
    const [participantId, secret] = rawCookie.split(":");
    if (participantId && secret) {
      guestCookie = { participantId, secret };
    }
  }

  return {
    companyId: company.id,
    staffUser,
    candidate,
    guestCookie,
  };
}

export async function getSupportSpaceStateAction(
  slug: string,
  focusedConversationId?: string | null
): Promise<SupportSpaceStateDTO> {
  const actor = await resolveViewerActor(slug);
  return getSupportSpaceState(actor, focusedConversationId);
}

export async function enterSupportSpaceAction(
  slug: string,
  rawInput: { displayName: string; avatar: AvatarConfig; rulesAccepted: boolean }
): Promise<SupportSpaceStateDTO> {
  const parsed = enterSpaceSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }

  const actor = await resolveViewerActor(slug);
  const result = await enterSupportSpace(actor, {
    displayName: parsed.data.displayName,
    avatar: parsed.data.avatar,
  });

  if (result.newGuestCookie) {
    const cookieStore = await cookies();
    cookieStore.set(
      guestCookieName(actor.companyId),
      `${result.newGuestCookie.participantId}:${result.newGuestCookie.secret}`,
      {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 dias
      }
    );
    actor.guestCookie = result.newGuestCookie;
  }

  return getSupportSpaceState(actor);
}

export async function joinSupportQueueAction(
  slug: string,
  rawTopic: string
): Promise<SupportSpaceStateDTO> {
  const parsed = requestTicketSchema.safeParse({ topic: rawTopic });
  if (!parsed.success) {
    throw new Error("Selecione o assunto da sua dúvida.");
  }

  const actor = await resolveViewerActor(slug);
  await joinSupportQueue(actor, parsed.data.topic);
  return getSupportSpaceState(actor);
}

export async function callServiceTicketAction(
  slug: string,
  conversationId: string,
  desk: number
): Promise<SupportSpaceStateDTO> {
  const actor = await resolveViewerActor(slug);
  const called = await callServiceTicketToDesk(actor, conversationId, desk);
  return getSupportSpaceState(actor, called.id);
}

export async function requestCandidateDmAction(
  slug: string,
  targetParticipantId: string
): Promise<SupportSpaceStateDTO> {
  const actor = await resolveViewerActor(slug);
  const dm = await requestCandidateDm(actor, targetParticipantId);
  return getSupportSpaceState(actor, dm.id);
}

export async function respondCandidateDmAction(
  slug: string,
  conversationId: string,
  accept: boolean
): Promise<SupportSpaceStateDTO> {
  const actor = await resolveViewerActor(slug);
  const updated = await respondToCandidateDm(actor, conversationId, accept);
  return getSupportSpaceState(actor, accept ? updated.id : undefined);
}

export async function closeSupportConversationAction(
  slug: string,
  conversationId: string
): Promise<SupportSpaceStateDTO> {
  const actor = await resolveViewerActor(slug);
  await closeSupportConversation(actor, conversationId);
  return getSupportSpaceState(actor);
}

export async function sendPrivateSupportMessageAction(
  slug: string,
  conversationId: string,
  body: string
): Promise<SupportSpaceStateDTO> {
  const parsed = sendSupportMessageSchema.safeParse({ conversationId, body });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Mensagem inválida.");
  }

  const actor = await resolveViewerActor(slug);
  await sendPrivateSupportMessage(
    actor,
    parsed.data.conversationId,
    parsed.data.body
  );
  return getSupportSpaceState(actor, parsed.data.conversationId);
}

export async function reportParticipantAction(
  slug: string,
  rawInput: { targetParticipantId: string; reason: string; excerpt?: string }
): Promise<{ ok: true }> {
  const parsed = reportParticipantSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }

  const actor = await resolveViewerActor(slug);
  await submitSupportReport(actor, parsed.data);
  return { ok: true };
}

export async function moderateParticipantAction(
  slug: string,
  rawInput: {
    targetParticipantId: string;
    action: "mute" | "unmute" | "ban" | "unban";
  }
): Promise<SupportSpaceStateDTO> {
  const parsed = moderateParticipantSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new Error("Ação de moderação inválida.");
  }

  const actor = await resolveViewerActor(slug);
  await moderateSupportParticipant(actor, parsed.data);
  return getSupportSpaceState(actor);
}

export async function resolveReportAction(
  slug: string,
  reportId: string
): Promise<SupportSpaceStateDTO> {
  const actor = await resolveViewerActor(slug);
  await resolveSupportReport(actor, reportId);
  return getSupportSpaceState(actor);
}

export async function toggleSupportSpacePublicVisibilityAction(
  slug: string,
  enabled: boolean
): Promise<SupportSpaceStateDTO> {
  const actor = await resolveViewerActor(slug);
  await toggleSupportSpacePublicVisibility(actor, enabled);
  revalidatePath("/", "layout");
  return getSupportSpaceState(actor);
}

export async function askSupportBotAiAction(
  slug: string,
  input: {
    botId: AssistantBotId;
    question: string;
    selectedJobId?: string | null;
    companyName: string;
  }
): Promise<{ bubbleText: string; fullReply: string; botName: string }> {
  const actor = await resolveViewerActor(slug);
  return askSupportBotAi(actor, input);
}



