"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  ACCESSORIES,
  CANDIDATE_SYSTEM_GUIDES,
  CAREER_ARCADE_QUIZ,
  DEFAULT_AVATAR,
  HAIR_COLORS,
  HAIR_STYLES,
  HOUSE_RULES,
  PANTS_COLORS,
  QUICK_REACTIONS,
  SHIRT_COLORS,
  SKIN_TONES,
  SUPPORT_ASSISTANT_BOTS,
  SUPPORT_DESK_POSITIONS,
  SUPPORT_ROOMS,
  SUPPORT_ROOM_IDS,
  SUPPORT_TOPICS,
  formatSupportJobContract,
  formatSupportJobWorkMode,
  generateAssistantBotReply,
  resolveRoomFromCoords,
  sanitizePublicBubble,
  type AssistantBotId,
  type AvatarConfig,
  type SupportJobDTO,
  type SupportRoomId,
  type SupportSpaceStateDTO,
  type SupportTopicId,
} from "@/server/models/support.model";
import {
  callServiceTicketAction,
  closeSupportConversationAction,
  enterSupportSpaceAction,
  getSupportSpaceStateAction,
  joinSupportQueueAction,
  moderateParticipantAction,
  reportParticipantAction,
  requestCandidateDmAction,
  resolveReportAction,
  respondCandidateDmAction,
  sendPrivateSupportMessageAction,
  toggleSupportSpacePublicVisibilityAction,
} from "@/server/controllers/support.controller";
import { PixelAvatarSprite } from "./pixel-avatar";
import {
  PixelOfficeCanvas,
  type MapPresenceUser,
  type PublicBubbleItem,
  type ReactionFloatingItem,
} from "./pixel-office-canvas";
import {
  Ban,
  Bell,
  Bot,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  EyeOff,
  Flag,
  Headphones,
  HelpCircle,
  Lock,
  MapPin,
  Megaphone,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Users,
  VolumeX,
  X,
} from "lucide-react";

interface VirtualCareerSpaceProps {
  companySlug: string;
  companyName: string;
  initialState: SupportSpaceStateDTO;
  embeddedInGestorPanel?: boolean;
}

type SidePanelTab = "bots" | "vagas" | "rh" | "orientacoes";

interface BotChatMessage {
  id: string;
  sender: "bot" | "user";
  botId: AssistantBotId;
  text: string;
}

export function VirtualCareerSpace({
  companySlug,
  companyName,
  initialState,
}: VirtualCareerSpaceProps) {
  const [spaceState, setSpaceState] = useState<SupportSpaceStateDTO>(initialState);
  const me = spaceState.me;
  const isStaff = spaceState.viewerRole === "STAFF";
  const openJobs = spaceState.openJobs ?? [];
  const regularJobs = openJobs.filter((j) => !j.isTalentPool);

  // Modal de Guia Rápido ("Como Funciona em 3 Passos")
  const [showFullGuideModal, setShowFullGuideModal] = useState<boolean>(false);

  // Modal de Credencial & Avatar
  const [showAvatarModal, setShowAvatarModal] = useState<boolean>(!initialState.me);
  const [displayNameInput, setDisplayNameInput] = useState<string>(
    initialState.me?.displayName || initialState.prefillName || ""
  );
  const [avatarDraft, setAvatarDraft] = useState<AvatarConfig>(
    initialState.me?.avatar || DEFAULT_AVATAR
  );
  const [rulesAccepted, setRulesAccepted] = useState<boolean>(Boolean(initialState.me));
  const [entryError, setEntryError] = useState<string | null>(null);
  const [entering, setEntering] = useState<boolean>(false);

  // Posição atual no mapa (0..100)
  const [myCoords, setMyCoords] = useState<{ x: number; y: number }>(() =>
    initialState.viewerRole === "STAFF"
      ? SUPPORT_ROOMS.atendimento.spawn
      : SUPPORT_ROOMS.recepcao.spawn
  );
  const currentRoom = resolveRoomFromCoords(myCoords.x, myCoords.y);

  // Participantes sincronizados via Realtime Presence + Broadcast
  const [remoteUsers, setRemoteUsers] = useState<Record<string, MapPresenceUser>>({});
  const [publicBubbles, setPublicBubbles] = useState<PublicBubbleItem[]>([]);
  const [publicFeed, setPublicFeed] = useState<PublicBubbleItem[]>([]);
  const [reactions, setReactions] = useState<ReactionFloatingItem[]>([]);
  const [staffAnnouncement, setStaffAnnouncement] = useState<{
    author: string;
    text: string;
  } | null>(null);

  // Entrada de mensagem pública na sala
  const [bubbleInput, setBubbleInput] = useState("");
  const [isAnnouncementMode, setIsAnnouncementMode] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Painel lateral direito (4 abas claras: Bots IA | Vagas | Atendimento RH | Avisos)
  const [sideTab, setSideTab] = useState<SidePanelTab>(() => {
    if (initialState.myActiveConversation || initialState.viewerRole === "STAFF") {
      return "rh";
    }
    return "bots";
  });

  // Estado do Mural de Vagas
  const [jobSearch, setJobSearch] = useState("");
  const [expandedJobId, setExpandedJobId] = useState<string | null>(
    regularJobs[0]?.id ?? openJobs[0]?.id ?? null
  );

  // Estado dos Bots Assistentes
  const [activeBotId, setActiveBotId] = useState<AssistantBotId>("vagas");
  const [selectedBotJobId, setSelectedBotJobId] = useState<string>(
    regularJobs[0]?.id ?? openJobs[0]?.id ?? ""
  );
  const [botInput, setBotInput] = useState("");
  const [botMessages, setBotMessages] = useState<BotChatMessage[]>(() => {
    return SUPPORT_ASSISTANT_BOTS.map((b) => ({
      id: `welcome_${b.id}`,
      sender: "bot",
      botId: b.id,
      text: b.greeting,
    }));
  });

  const botChatContainerRef = useRef<HTMLDivElement | null>(null);
  const botInputRef = useRef<HTMLInputElement | null>(null);

  // Fila RH e Conversa Privada
  const [selectedTopic, setSelectedTopic] = useState<SupportTopicId>("VAGA");
  const [privateInput, setPrivateInput] = useState("");
  const [busyAction, setBusyAction] = useState(false);

  // Interação ao clicar num participante
  const [selectedUser, setSelectedUser] = useState<MapPresenceUser | null>(null);
  const [reportModalUser, setReportModalUser] = useState<MapPresenceUser | null>(null);
  const [reportReason, setReportReason] = useState("");

  // Modal do Simulado de Entrevista
  const [showArcadeModal, setShowArcadeModal] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizSelected, setQuizSelected] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);

  const realtimeChannelRef = useRef<any>(null);
  const localBcRef = useRef<BroadcastChannel | null>(null);

  const showToast = useCallback((msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => {
      setFeedbackToast((prev) => (prev === msg ? null : prev));
    }, 3800);
  }, []);

  // Auto-scroll suave do chat do Bot sempre que chegar mensagem ou trocar de Bot
  useEffect(() => {
    const el = botChatContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [botMessages, activeBotId, sideTab]);

  // Recarrega estado do servidor (fila, conversas privadas, mensagens, vagas)
  const refreshServerState = useCallback(
    async (focusedConvId?: string | null) => {
      try {
        const fresh = await getSupportSpaceStateAction(
          companySlug,
          focusedConvId ?? spaceState.myActiveConversation?.id
        );
        setSpaceState(fresh);
      } catch {
        // Silencioso em background
      }
    },
    [companySlug, spaceState.myActiveConversation?.id]
  );

  // Limpa balões e reações expiradas a cada segundo
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setPublicBubbles((prev) => prev.filter((b) => b.expiresAt > now));
      setReactions((prev) => prev.filter((r) => r.expiresAt > now));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Polling leve para garantir sincronia de fila e mensagens privadas
  useEffect(() => {
    if (!me) return;
    const interval = setInterval(() => {
      void refreshServerState();
    }, 4500);
    return () => clearInterval(interval);
  }, [me, refreshServerState]);

  // Canal privado de Inbox (Supabase Realtime) para avisos imediatos
  useEffect(() => {
    if (!me?.inboxKey) return;
    let supabase: ReturnType<typeof createClient> | null = null;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    const inboxCh = supabase.channel(`espaco-inbox:${me.inboxKey}`);
    inboxCh
      .on("broadcast", { event: "ticket_called" }, (payload) => {
        const desk = Number(payload?.payload?.desk || 1);
        const pos = SUPPORT_DESK_POSITIONS[desk]?.candidate ?? SUPPORT_ROOMS.atendimento.spawn;
        setMyCoords(pos);
        setSideTab("rh");
        showToast(`🎧 Você foi chamado para atendimento no Balcão ${desk}!`);
        void refreshServerState(payload?.payload?.conversationId);
      })
      .on("broadcast", { event: "dm_invite" }, () => {
        setSideTab("rh");
        showToast("🔒 Você recebeu um convite de conversa privada!");
        void refreshServerState();
      })
      .on("broadcast", { event: "dm_response" }, () => {
        void refreshServerState();
      })
      .on("broadcast", { event: "private_message" }, () => {
        void refreshServerState();
      })
      .on("broadcast", { event: "moderation" }, () => {
        void refreshServerState();
      })
      .subscribe();

    return () => {
      void inboxCh.unsubscribe();
    };
  }, [me?.inboxKey, refreshServerState, showToast]);

  // Conexão ao canal do mapa da empresa (Presence + Broadcast)
  useEffect(() => {
    if (!me) return;

    const handleIncomingEvent = (type: string, data: any) => {
      if (!data) return;
      if (type === "move" && data.participantId && data.participantId !== me.id) {
        setRemoteUsers((prev) => ({
          ...prev,
          [data.participantId]: {
            participantId: data.participantId,
            displayName: data.displayName,
            kind: data.kind,
            avatar: data.avatar,
            x: data.x,
            y: data.y,
            room: resolveRoomFromCoords(data.x, data.y),
          },
        }));
      } else if (type === "bubble" && data.participantId) {
        const item: PublicBubbleItem = {
          id: data.id || `${Date.now()}_${Math.random()}`,
          participantId: data.participantId,
          displayName: data.displayName,
          kind: data.kind,
          text: data.text,
          room: data.room || "recepcao",
          expiresAt: Date.now() + 7000,
        };
        setPublicBubbles((prev) => [
          ...prev.filter((b) => b.participantId !== data.participantId),
          item,
        ]);
        setPublicFeed((prev) => [...prev.slice(-35), item]);
      } else if (type === "reaction" && data.participantId) {
        setReactions((prev) => [
          ...prev.filter((r) => r.participantId !== data.participantId),
          {
            participantId: data.participantId,
            emoji: data.emoji,
            expiresAt: Date.now() + 4000,
          },
        ]);
      } else if (type === "announcement" && data.text) {
        setStaffAnnouncement({ author: data.author || "Equipe RH", text: data.text });
      } else if (type === "state_sync") {
        void refreshServerState();
      }
    };

    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      const bc = new BroadcastChannel(`triagem_espaco_sync_${companySlug}`);
      localBcRef.current = bc;
      bc.onmessage = (ev) => {
        if (ev.data?.type) {
          handleIncomingEvent(ev.data.type, ev.data.payload);
        }
      };
    }

    let supabase: ReturnType<typeof createClient> | null = null;
    try {
      supabase = createClient();
    } catch {
      supabase = null;
    }

    if (supabase) {
      const ch = supabase.channel(`espaco-map:${companySlug}`, {
        config: { presence: { key: me.id }, broadcast: { ack: false } },
      });

      ch.on("presence", { event: "sync" }, () => {
        const state = ch.presenceState<MapPresenceUser>();
        const nextMap: Record<string, MapPresenceUser> = {};
        for (const [key, list] of Object.entries(state)) {
          const first = list[0];
          if (first && key !== me.id) {
            nextMap[key] = {
              participantId: key,
              displayName: first.displayName,
              kind: first.kind,
              avatar: first.avatar,
              x: first.x,
              y: first.y,
              room: resolveRoomFromCoords(first.x, first.y),
            };
          }
        }
        setRemoteUsers(nextMap);
      });

      ch.on("broadcast", { event: "move" }, ({ payload }) =>
        handleIncomingEvent("move", payload)
      );
      ch.on("broadcast", { event: "bubble" }, ({ payload }) =>
        handleIncomingEvent("bubble", payload)
      );
      ch.on("broadcast", { event: "reaction" }, ({ payload }) =>
        handleIncomingEvent("reaction", payload)
      );
      ch.on("broadcast", { event: "announcement" }, ({ payload }) =>
        handleIncomingEvent("announcement", payload)
      );
      ch.on("broadcast", { event: "state_sync" }, ({ payload }) =>
        handleIncomingEvent("state_sync", payload)
      );

      ch.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await ch.track({
            participantId: me.id,
            displayName: me.displayName,
            kind: me.kind,
            avatar: me.avatar,
            x: myCoords.x,
            y: myCoords.y,
            room: resolveRoomFromCoords(myCoords.x, myCoords.y),
          });
        }
      });

      realtimeChannelRef.current = ch;
    }

    return () => {
      if (localBcRef.current) {
        localBcRef.current.close();
        localBcRef.current = null;
      }
      if (realtimeChannelRef.current) {
        void realtimeChannelRef.current.unsubscribe();
        realtimeChannelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companySlug, me?.id]);

  const emitRealtimeEvent = useCallback((type: string, payload: Record<string, unknown>) => {
    try {
      localBcRef.current?.postMessage({ type, payload });
    } catch {}
    try {
      realtimeChannelRef.current?.send({
        type: "broadcast",
        event: type,
        payload,
      });
    } catch {}
  }, []);

  // Movimenta o participante pelo mapa e sincroniza com todos na sala
  const moveAvatarTo = useCallback(
    (x: number, y: number) => {
      setMyCoords({ x, y });
      if (!me) return;
      const payload = {
        participantId: me.id,
        displayName: me.displayName,
        kind: me.kind,
        avatar: me.avatar,
        x,
        y,
        room: resolveRoomFromCoords(x, y),
      };
      emitRealtimeEvent("move", payload);
      try {
        void realtimeChannelRef.current?.track(payload);
      } catch {}
    },
    [emitRealtimeEvent, me]
  );

  // Atalhos de teclado (setas / WASD) quando não estiver digitando em um input
  useEffect(() => {
    if (!me || showAvatarModal || showFullGuideModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      const step = 3.5;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        e.preventDefault();
        moveAvatarTo(myCoords.x, Math.max(14, myCoords.y - step));
      } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        e.preventDefault();
        moveAvatarTo(myCoords.x, Math.min(90, myCoords.y + step));
      } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        moveAvatarTo(Math.max(8, myCoords.x - step), myCoords.y);
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        moveAvatarTo(Math.min(92, myCoords.x + step), myCoords.y);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [me, moveAvatarTo, myCoords.x, myCoords.y, showAvatarModal, showFullGuideModal]);

  // Salvar entrada / credencial do participante
  const handleEnterSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    setEntryError(null);
    setEntering(true);
    try {
      const nextState = await enterSupportSpaceAction(companySlug, {
        displayName: displayNameInput,
        avatar: avatarDraft,
        rulesAccepted,
      });
      setSpaceState(nextState);
      setShowAvatarModal(false);
      showToast("Bem-vindo ao Centro de Carreiras & Suporte ao Vivo!");
    } catch (err: any) {
      setEntryError(err?.message || "Não foi possível entrar no espaço.");
    } finally {
      setEntering(false);
    }
  };

  // Trocar de Bot Assistente e focar imediatamente no chat
  const handleSwitchBot = useCallback(
    (botId: AssistantBotId, customJob?: SupportJobDTO) => {
      setActiveBotId(botId);
      setSideTab("bots");

      if (customJob) {
        setSelectedBotJobId(customJob.id);
        const reply = generateAssistantBotReply({
          botId: "vagas",
          question: "Resumo e requisitos desta vaga",
          selectedJob: customJob,
          openJobs,
          companyName,
        });
        setBotMessages((prev) => [
          ...prev,
          {
            id: `u_${Date.now()}`,
            sender: "user",
            botId: "vagas",
            text: `Quero saber sobre a vaga: ${customJob.title}`,
          },
          {
            id: `b_${Date.now() + 1}`,
            sender: "bot",
            botId: "vagas",
            text: reply,
          },
        ]);
      }

      setTimeout(() => {
        botInputRef.current?.focus();
      }, 80);
    },
    [companyName, openJobs]
  );

  // Enviar pergunta para o Bot Assistente ativo
  const handleAskBotQuestion = (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed) return;
    const selectedJob =
      openJobs.find((j) => j.id === selectedBotJobId) ??
      regularJobs[0] ??
      openJobs[0] ??
      null;

    const reply = generateAssistantBotReply({
      botId: activeBotId,
      question: trimmed,
      selectedJob,
      openJobs,
      companyName,
    });

    setBotMessages((prev) => [
      ...prev.slice(-24),
      {
        id: `usr_${Date.now()}`,
        sender: "user",
        botId: activeBotId,
        text: trimmed,
      },
      {
        id: `bot_${Date.now() + 1}`,
        sender: "bot",
        botId: activeBotId,
        text: reply,
      },
    ]);
    setBotInput("");
  };

  // Enviar balão público na sala ou comunicado da equipe
  const handleSendPublicBubble = (e: React.FormEvent) => {
    e.preventDefault();
    if (!me) {
      setShowAvatarModal(true);
      return;
    }
    if (me.isMuted || me.isBanned) {
      showToast("Você está temporariamente silenciado pela moderação.");
      return;
    }

    const check = sanitizePublicBubble(bubbleInput);
    if (!check.ok) {
      showToast(check.error || "Mensagem inválida.");
      return;
    }

    if (isStaff && isAnnouncementMode) {
      setStaffAnnouncement({ author: me.displayName, text: check.clean });
      emitRealtimeEvent("announcement", {
        author: me.displayName,
        text: check.clean,
      });
      setBubbleInput("");
      return;
    }

    const bubble: PublicBubbleItem = {
      id: `b_${Date.now()}`,
      participantId: me.id,
      displayName: me.displayName,
      kind: me.kind,
      text: check.clean,
      room: currentRoom,
      expiresAt: Date.now() + 7000,
    };

    setPublicBubbles((prev) => [
      ...prev.filter((b) => b.participantId !== me.id),
      bubble,
    ]);
    setPublicFeed((prev) => [...prev.slice(-35), bubble]);
    emitRealtimeEvent("bubble", bubble as unknown as Record<string, unknown>);
    setBubbleInput("");
  };

  const handleSendQuickReaction = (emoji: string) => {
    if (!me) {
      setShowAvatarModal(true);
      return;
    }
    setReactions((prev) => [
      ...prev.filter((r) => r.participantId !== me.id),
      { participantId: me.id, emoji, expiresAt: Date.now() + 4000 },
    ]);
    emitRealtimeEvent("reaction", { participantId: me.id, emoji });
  };

  // Retirar senha na fila de atendimento RH
  const handleJoinQueue = async () => {
    if (!me) {
      setShowAvatarModal(true);
      return;
    }
    setBusyAction(true);
    try {
      const next = await joinSupportQueueAction(companySlug, selectedTopic);
      setSpaceState(next);
      moveAvatarTo(SUPPORT_ROOMS.recepcao.spawn.x, SUPPORT_ROOMS.recepcao.spawn.y);
      emitRealtimeEvent("state_sync", { ts: Date.now() });
      showToast("🎫 Senha retirada! Aguarde o recrutador chamar seu número.");
    } catch (err: any) {
      showToast(err?.message || "Não foi possível entrar na fila.");
    } finally {
      setBusyAction(false);
    }
  };

  // Equipe chama senha para um balcão (1, 2 ou 3)
  const handleCallTicket = async (conversationId: string, desk: number) => {
    setBusyAction(true);
    try {
      const next = await callServiceTicketAction(companySlug, conversationId, desk);
      setSpaceState(next);
      const staffPos = SUPPORT_DESK_POSITIONS[desk]?.staff ?? SUPPORT_ROOMS.atendimento.spawn;
      moveAvatarTo(staffPos.x, staffPos.y);
      setSideTab("rh");
      emitRealtimeEvent("state_sync", { ts: Date.now() });
      showToast(`🎧 Senha chamada para o Balcão ${desk}!`);
    } catch (err: any) {
      showToast(err?.message || "Erro ao chamar senha.");
    } finally {
      setBusyAction(false);
    }
  };

  // Convidar participante para conversa privada
  const handleRequestDm = async (targetUser: MapPresenceUser) => {
    setBusyAction(true);
    try {
      const next = await requestCandidateDmAction(
        companySlug,
        targetUser.participantId
      );
      setSpaceState(next);
      setSelectedUser(null);
      setSideTab("rh");
      emitRealtimeEvent("state_sync", { ts: Date.now() });
      showToast(`🔒 Solicitação de conversa enviada para ${targetUser.displayName}.`);
    } catch (err: any) {
      showToast(err?.message || "Não foi possível iniciar conversa privada.");
    } finally {
      setBusyAction(false);
    }
  };

  const handleRespondDm = async (conversationId: string, accept: boolean) => {
    setBusyAction(true);
    try {
      const next = await respondCandidateDmAction(companySlug, conversationId, accept);
      setSpaceState(next);
      emitRealtimeEvent("state_sync", { ts: Date.now() });
      if (accept) setSideTab("rh");
    } catch (err: any) {
      showToast(err?.message || "Erro ao responder convite.");
    } finally {
      setBusyAction(false);
    }
  };

  const handleCloseConversation = async (conversationId: string) => {
    setBusyAction(true);
    try {
      const next = await closeSupportConversationAction(companySlug, conversationId);
      setSpaceState(next);
      emitRealtimeEvent("state_sync", { ts: Date.now() });
      showToast("Atendimento encerrado.");
    } catch (err: any) {
      showToast(err?.message || "Erro ao encerrar conversa.");
    } finally {
      setBusyAction(false);
    }
  };

  const handleSendPrivateMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeConv = spaceState.myActiveConversation;
    if (!activeConv || !privateInput.trim()) return;
    const textToSend = privateInput;
    setPrivateInput("");
    try {
      const next = await sendPrivateSupportMessageAction(
        companySlug,
        activeConv.id,
        textToSend
      );
      setSpaceState(next);
      emitRealtimeEvent("state_sync", { ts: Date.now() });
    } catch (err: any) {
      setPrivateInput(textToSend);
      showToast(err?.message || "Erro ao enviar mensagem privada.");
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportModalUser || !reportReason.trim()) return;
    setBusyAction(true);
    try {
      const lastBubble = publicFeed
        .filter((b) => b.participantId === reportModalUser.participantId)
        .slice(-1)[0]?.text;
      await reportParticipantAction(companySlug, {
        targetParticipantId: reportModalUser.participantId,
        reason: reportReason,
        excerpt: lastBubble,
      });
      setReportModalUser(null);
      setReportReason("");
      showToast("🛡️ Ocorrência encaminhada à moderação do RH.");
    } catch (err: any) {
      showToast(err?.message || "Não foi possível registrar a denúncia.");
    } finally {
      setBusyAction(false);
    }
  };

  const handleModerate = async (
    targetParticipantId: string,
    action: "mute" | "unmute" | "ban" | "unban"
  ) => {
    setBusyAction(true);
    try {
      const next = await moderateParticipantAction(companySlug, {
        targetParticipantId,
        action,
      });
      setSpaceState(next);
      setSelectedUser(null);
      emitRealtimeEvent("state_sync", { ts: Date.now() });
      showToast("Medida de moderação aplicada.");
    } catch (err: any) {
      showToast(err?.message || "Erro ao moderar participante.");
    } finally {
      setBusyAction(false);
    }
  };

  const handleTogglePublicVisibility = async () => {
    const nextEnabled = !spaceState.isPublicEnabled;
    setBusyAction(true);
    try {
      const next = await toggleSupportSpacePublicVisibilityAction(
        companySlug,
        nextEnabled
      );
      setSpaceState(next);
      showToast(
        nextEnabled
          ? "🟢 Sala LIBERADA para os candidatos no portal público!"
          : "🔒 Sala em Modo Homologação (oculta para candidatos no portal)."
      );
    } catch (err: any) {
      showToast(err?.message || "Não foi possível alterar a visibilidade.");
    } finally {
      setBusyAction(false);
    }
  };

  // Lista unificada de participantes no mapa (eu + remotos)
  const allUsersOnMap: MapPresenceUser[] = [
    ...(me
      ? [
          {
            participantId: me.id,
            displayName: me.displayName,
            kind: me.kind,
            avatar: me.avatar,
            x: myCoords.x,
            y: myCoords.y,
            room: currentRoom,
          },
        ]
      : []),
    ...Object.values(remoteUsers),
  ];

  // Filtro do Mural de Vagas
  const filteredJobs = openJobs.filter((job) => {
    if (!jobSearch.trim()) return true;
    const term = jobSearch.toLowerCase();
    return (
      job.title.toLowerCase().includes(term) ||
      (job.location && job.location.toLowerCase().includes(term)) ||
      (job.code && job.code.toLowerCase().includes(term)) ||
      formatSupportJobWorkMode(job.workMode).toLowerCase().includes(term)
    );
  });

  const currentBot =
    SUPPORT_ASSISTANT_BOTS.find((b) => b.id === activeBotId) ??
    SUPPORT_ASSISTANT_BOTS[0];

  const activeBotMessages = botMessages.filter((m) => m.botId === activeBotId);

  return (
    <div className="space-y-3">
      {/* ─── TOAST DE FEEDBACK ─── */}
      {feedbackToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-stone-800 bg-stone-950 px-4 py-2 text-xs font-semibold text-white shadow-xl animate-in fade-in slide-in-from-bottom-4">
          {feedbackToast}
        </div>
      )}

      {/* ─── COMUNICADO OFICIAL DO RH (QUANDO ATIVO) ─── */}
      {staffAnnouncement && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-950">
          <div className="flex items-center gap-2">
            <Megaphone className="size-4 text-blue-700 shrink-0" />
            <span>
              <strong>Comunicado RH ({staffAnnouncement.author}):</strong>{" "}
              {staffAnnouncement.text}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setStaffAnnouncement(null)}
            className="rounded p-1 text-blue-700 hover:bg-blue-100"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* ─── BARRA ÚNICA DE COMANDO (NÍVEL MICHELIN · ZERO POLUIÇÃO) ─── */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-stone-200 bg-white px-3.5 py-2.5 shadow-2xs">
        {/* Esquerda: Passo a Passo Rápido em 3 Pílulas Claras */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSideTab("bots")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              sideTab === "bots"
                ? "bg-stone-900 text-white shadow-2xs"
                : "bg-stone-100 text-stone-700 hover:bg-stone-200/80"
            }`}
          >
            <span className="flex size-4 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
              1
            </span>
            <span>🤖 Tirar Dúvidas (Bots IA)</span>
          </button>

          <button
            type="button"
            onClick={() => setSideTab("vagas")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              sideTab === "vagas"
                ? "bg-stone-900 text-white shadow-2xs"
                : "bg-stone-100 text-stone-700 hover:bg-stone-200/80"
            }`}
          >
            <span className="flex size-4 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
              2
            </span>
            <span>💼 Mural de Vagas ({openJobs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSideTab("rh")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              sideTab === "rh"
                ? "bg-stone-900 text-white shadow-2xs"
                : "bg-stone-100 text-stone-700 hover:bg-stone-200/80"
            }`}
          >
            <span className="flex size-4 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
              3
            </span>
            <span>🎧 Atendimento RH ({spaceState.queueCount})</span>
            {(spaceState.myActiveConversation ||
              spaceState.myIncomingDmRequests.length > 0) && (
              <span className="size-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setSideTab("orientacoes")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              sideTab === "orientacoes"
                ? "bg-stone-900 text-white shadow-2xs"
                : "bg-stone-100 text-stone-700 hover:bg-stone-200/80"
            }`}
          >
            <Bell className="size-3.5" />
            <span>Onde Ver Avisos</span>
          </button>
        </div>

        {/* Direita: Status Online + Como Funciona + Avatar + Toggle Homologação (Gestor) */}
        <div className="flex flex-wrap items-center gap-2">
          {isStaff && (
            <button
              type="button"
              disabled={busyAction}
              onClick={handleTogglePublicVisibility}
              title={
                spaceState.isPublicEnabled
                  ? "Sala visível para candidatos. Clique para voltar ao Modo Homologação."
                  : "Sala oculta para candidatos (Modo Homologação). Clique para liberar no portal."
              }
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                spaceState.isPublicEnabled
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                  : "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
              }`}
            >
              {spaceState.isPublicEnabled ? (
                <>
                  <Eye className="size-3.5 text-emerald-600" />
                  <span>Público Ativo (Pausar)</span>
                </>
              ) : (
                <>
                  <EyeOff className="size-3.5 text-amber-600" />
                  <span>Modo Teste · Liberar p/ Candidatos</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowFullGuideModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
          >
            <HelpCircle className="size-3.5 text-blue-600" />
            <span>Como Funciona</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (me) {
                setDisplayNameInput(me.displayName);
                setAvatarDraft(me.avatar);
              }
              setShowAvatarModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50"
          >
            <Sparkles className="size-3.5 text-amber-500" />
            <span>Meu Avatar</span>
          </button>
        </div>
      </div>

      {/* ─── GRID PRINCIPAL: MAPA LIMPO (7 COLUNAS) + CENTRAL DE CONCIERGE (5 COLUNAS) ─── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-start">
        {/* COLUNA ESQUERDA: MAPA INTERATIVO + BARRA COMPACTA DE SETORES & FALA (7 colunas) */}
        <div className="lg:col-span-7 space-y-2.5">
          <PixelOfficeCanvas
            meId={me?.id || ""}
            users={allUsersOnMap}
            bubbles={publicBubbles}
            reactions={reactions}
            activePrivatePairs={spaceState.activePrivatePairs}
            queueCount={spaceState.queueCount}
            openJobCount={openJobs.length}
            activeBotId={sideTab === "bots" ? activeBotId : undefined}
            onMoveTo={moveAvatarTo}
            onSelectUser={(u) => setSelectedUser(u)}
            onOpenArcadeQuiz={() => {
              moveAvatarTo(SUPPORT_ROOMS.jogos.spawn.x, SUPPORT_ROOMS.jogos.spawn.y);
              setShowArcadeModal(true);
            }}
            onOpenQueuePanel={() => {
              moveAvatarTo(
                SUPPORT_ROOMS.recepcao.spawn.x,
                SUPPORT_ROOMS.recepcao.spawn.y
              );
              setSideTab("rh");
            }}
            onOpenJobBoard={() => {
              setSideTab("vagas");
            }}
            onOpenGuidesPanel={() => {
              setSideTab("orientacoes");
            }}
            onSelectBot={(botId) => {
              handleSwitchBot(botId);
              const bot = SUPPORT_ASSISTANT_BOTS.find((b) => b.id === botId);
              if (bot) {
                showToast(`🤖 Conversando com ${bot.name} no painel ao lado.`);
              }
            }}
          />

          {/* Barra Compacta: Navegação de Ambientes + Mensagem na Sala */}
          <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-2xs space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1">
                {SUPPORT_ROOM_IDS.map((roomId) => {
                  const room = SUPPORT_ROOMS[roomId];
                  const active = currentRoom === roomId;
                  return (
                    <button
                      key={roomId}
                      type="button"
                      onClick={() => moveAvatarTo(room.spawn.x, room.spawn.y)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                        active
                          ? "bg-stone-900 text-white"
                          : "bg-stone-100 text-stone-600 hover:bg-stone-200/70"
                      }`}
                    >
                      <span>{room.icon}</span>
                      <span>{room.shortName}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSendQuickReaction(emoji)}
                    className="rounded-lg border border-stone-200/80 bg-stone-50 px-1.5 py-0.5 text-xs transition hover:scale-110 hover:bg-stone-100"
                    title="Enviar reação no mapa"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSendPublicBubble} className="flex items-center gap-2">
              {isStaff && (
                <button
                  type="button"
                  onClick={() => setIsAnnouncementMode((v) => !v)}
                  className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-2 text-xs font-semibold transition ${
                    isAnnouncementMode
                      ? "border-blue-700 bg-blue-700 text-white"
                      : "border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  <Megaphone className="size-3.5" />
                  <span>Aviso</span>
                </button>
              )}

              <input
                type="text"
                value={bubbleInput}
                onChange={(e) => setBubbleInput(e.target.value)}
                maxLength={140}
                placeholder={
                  isAnnouncementMode
                    ? "Digite um comunicado oficial para toda a sala..."
                    : `Falar abertamente em ${SUPPORT_ROOMS[currentRoom].shortName}...`
                }
                className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:bg-white focus:outline-none"
              />

              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-stone-800"
              >
                <Send className="size-3.5" />
                <span>Falar na Sala</span>
              </button>
            </form>
          </div>

          {/* Card de Inspeção quando clica em um Participante no Mapa */}
          {selectedUser && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm animate-in fade-in">
              <div className="flex items-center gap-3">
                <PixelAvatarSprite
                  avatar={selectedUser.avatar}
                  kind={selectedUser.kind}
                  size={36}
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-stone-900">
                      {selectedUser.displayName}
                    </span>
                    <span className="rounded bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-700">
                      {selectedUser.kind === "STAFF"
                        ? "Equipe RH"
                        : selectedUser.kind === "CANDIDATE"
                          ? "✓ Candidato"
                          : "Visitante"}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500">
                    Setor: {SUPPORT_ROOMS[selectedUser.room].name}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {me && selectedUser.participantId !== me.id && (
                  <>
                    {me.kind !== "GUEST" &&
                      (selectedUser.kind !== "GUEST" || isStaff) && (
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={() => handleRequestDm(selectedUser)}
                          className="inline-flex items-center gap-1 rounded-lg bg-stone-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-stone-800"
                        >
                          <Lock className="size-3 text-amber-300" />
                          <span>Conversar no Privado</span>
                        </button>
                      )}

                    <button
                      type="button"
                      onClick={() => setReportModalUser(selectedUser)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      <Flag className="size-3" />
                      <span>Reportar</span>
                    </button>

                    {isStaff && selectedUser.kind !== "STAFF" && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            handleModerate(selectedUser.participantId, "mute")
                          }
                          className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-900"
                        >
                          Silenciar
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleModerate(selectedUser.participantId, "ban")
                          }
                          className="rounded-lg bg-red-600 px-2 py-1.5 text-xs font-semibold text-white"
                        >
                          Suspender
                        </button>
                      </>
                    )}
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* COLUNA DIREITA: CONCIERGE CORPORATIVO DE 4 ABAS (5 colunas) */}
        <div className="lg:col-span-5 flex flex-col rounded-2xl border border-stone-200 bg-white shadow-xs overflow-hidden">
          {/* Navegação Limpa de 4 Abas */}
          <div className="grid grid-cols-4 border-b border-stone-100 bg-stone-50/80 p-1.5 gap-1">
            <button
              type="button"
              onClick={() => setSideTab("bots")}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-semibold transition ${
                sideTab === "bots"
                  ? "bg-stone-900 text-white shadow-2xs"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              }`}
            >
              <Bot className="size-3.5 shrink-0" />
              <span className="truncate">Bots IA</span>
            </button>

            <button
              type="button"
              onClick={() => setSideTab("vagas")}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-semibold transition ${
                sideTab === "vagas"
                  ? "bg-stone-900 text-white shadow-2xs"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              }`}
            >
              <Briefcase className="size-3.5 shrink-0" />
              <span className="truncate">Vagas ({openJobs.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setSideTab("rh")}
              className={`relative flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-semibold transition ${
                sideTab === "rh"
                  ? "bg-stone-900 text-white shadow-2xs"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              }`}
            >
              <Headphones className="size-3.5 shrink-0" />
              <span className="truncate">RH ({spaceState.queueCount})</span>
              {(spaceState.myActiveConversation ||
                spaceState.myIncomingDmRequests.length > 0) && (
                <span className="size-2 rounded-full bg-amber-400 animate-ping" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setSideTab("orientacoes")}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-semibold transition ${
                sideTab === "orientacoes"
                  ? "bg-stone-900 text-white shadow-2xs"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              }`}
            >
              <Bell className="size-3.5 shrink-0" />
              <span className="truncate">Avisos</span>
            </button>
          </div>

          {/* ─── ABA 1: CHAT DIRETO COM OS BOTS ASSISTENTES (FOCO EM CONVERSAR SEM POLUIÇÃO) ─── */}
          {sideTab === "bots" && (
            <div className="flex flex-col h-[500px]">
              {/* Seletor Horizontal Compacto dos 3 Bots (Sem textos cortados!) */}
              <div className="border-b border-stone-100 bg-stone-50/50 px-3.5 py-2.5 space-y-2">
                <div className="grid grid-cols-3 gap-1.5">
                  {SUPPORT_ASSISTANT_BOTS.map((bot) => {
                    const active = bot.id === activeBotId;
                    const firstName = bot.name.split("·")[0].trim();
                    return (
                      <button
                        key={bot.id}
                        type="button"
                        onClick={() => handleSwitchBot(bot.id)}
                        className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
                          active
                            ? "border-stone-900 bg-white shadow-2xs ring-1 ring-stone-900"
                            : "border-stone-200/80 bg-white/60 hover:bg-white"
                        }`}
                      >
                        <PixelAvatarSprite avatar={bot.avatar} kind="STAFF" size={26} />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-stone-900 leading-none">
                            {firstName}
                          </p>
                          <p className="mt-0.5 text-[10px] font-medium text-blue-700 truncate">
                            {bot.badge}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Seletor enxuto de vaga quando está na Clara (Bot de Vagas) */}
                {activeBotId === "vagas" && openJobs.length > 0 && (
                  <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-2.5 py-1.5">
                    <span className="text-[11px] font-semibold text-stone-500 shrink-0">
                      Vaga em foco:
                    </span>
                    <select
                      value={selectedBotJobId}
                      onChange={(e) => setSelectedBotJobId(e.target.value)}
                      className="flex-1 bg-transparent text-xs font-semibold text-stone-900 focus:outline-none truncate"
                    >
                      {openJobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.isTalentPool ? `[Banco de Talentos] ${j.title}` : j.title} (
                          {formatSupportJobWorkMode(j.workMode)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Janela de Conversa Ampla e Limpa (Auto-Scroll) */}
              <div
                ref={botChatContainerRef}
                className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[#faf9f7]"
              >
                <div className="flex items-center justify-between text-[11px] text-stone-400 pb-1 border-b border-stone-200/60">
                  <span>
                    Conversando com <strong className="text-stone-700">{currentBot.name}</strong>
                  </span>
                  {activeBotMessages.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setBotMessages((prev) =>
                          prev.filter(
                            (m) => m.botId !== activeBotId || m.id.startsWith("welcome_")
                          )
                        )
                      }
                      className="inline-flex items-center gap-1 text-stone-500 hover:text-stone-800"
                    >
                      <RotateCcw className="size-3" />
                      <span>Limpar</span>
                    </button>
                  )}
                </div>

                {activeBotMessages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${
                      m.sender === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line ${
                        m.sender === "user"
                          ? "bg-stone-900 text-white rounded-br-xs"
                          : "border border-stone-200/90 bg-white text-stone-800 shadow-2xs rounded-bl-xs"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Rodapé Fixo do Chat: Sugestões Rápidas em Pílulas + Campo de Digitação Sempre Visível */}
              <div className="border-t border-stone-200 bg-white p-3 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {currentBot.quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleAskBotQuestion(prompt)}
                      className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-medium text-stone-700 transition hover:border-stone-900 hover:bg-stone-900 hover:text-white"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAskBotQuestion(botInput);
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    ref={botInputRef}
                    type="text"
                    value={botInput}
                    onChange={(e) => setBotInput(e.target.value)}
                    placeholder={`Digite sua dúvida para ${currentBot.name.split("·")[0].trim()}...`}
                    className="flex-1 rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:bg-white focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800"
                  >
                    <Send className="size-3.5" />
                    <span>Enviar</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ─── ABA 2: MURAL DE VAGAS CORPORATIVO ─── */}
          {sideTab === "vagas" && (
            <div className="flex flex-col h-[500px] p-4 space-y-3 overflow-y-auto">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-stone-900">
                    Oportunidades Abertas ({openJobs.length})
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Clique em uma vaga para ler os requisitos, perguntar ao Bot ou se candidatar.
                  </p>
                </div>
                <Link
                  href={`/${companySlug}/vagas`}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[11px] font-semibold text-stone-700 hover:bg-stone-100"
                >
                  <span>Ver todas</span>
                  <ExternalLink className="size-3" />
                </Link>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={jobSearch}
                  onChange={(e) => setJobSearch(e.target.value)}
                  placeholder="Filtrar por cargo, cidade ou modalidade..."
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 pl-8 pr-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:bg-white focus:outline-none"
                />
              </div>

              {filteredJobs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-stone-200 p-6 text-center text-xs text-stone-500">
                  Nenhuma vaga encontrada para o filtro informado.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredJobs.map((job) => {
                    const isExpanded = expandedJobId === job.id;
                    const reqBullets = job.requirements
                      ? job.requirements
                          .split("\n")
                          .map((l) => l.replace(/^[-•*]\s*/, "").trim())
                          .filter(Boolean)
                      : [];

                    return (
                      <div
                        key={job.id}
                        className={`rounded-xl border transition ${
                          isExpanded
                            ? "border-stone-900 bg-white shadow-2xs"
                            : "border-stone-200 bg-white hover:border-stone-300"
                        }`}
                      >
                        <div
                          onClick={() =>
                            setExpandedJobId(isExpanded ? null : job.id)
                          }
                          className="cursor-pointer p-3 flex items-start justify-between gap-2"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                  job.isTalentPool
                                    ? "bg-indigo-50 text-indigo-800"
                                    : "bg-emerald-50 text-emerald-800"
                                }`}
                              >
                                {job.isTalentPool ? "Banco de Talentos" : "Aberta"}
                              </span>
                              <span className="text-[11px] font-medium text-stone-500">
                                {formatSupportJobWorkMode(job.workMode)} ·{" "}
                                {formatSupportJobContract(job.contract)}
                              </span>
                              {job.location && (
                                <span className="inline-flex items-center gap-0.5 text-[11px] text-stone-500">
                                  <MapPin className="size-3" />
                                  {job.location}
                                </span>
                              )}
                            </div>
                            <h4 className="text-xs font-bold text-stone-900">
                              {job.title}
                            </h4>
                          </div>

                          <span className="text-stone-400 mt-1">
                            {isExpanded ? (
                              <ChevronUp className="size-4" />
                            ) : (
                              <ChevronDown className="size-4" />
                            )}
                          </span>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-stone-100 px-3 pb-3 pt-2.5 space-y-2.5 text-xs">
                            <p className="text-[11px] leading-relaxed text-stone-600 whitespace-pre-line">
                              {job.description.length > 260
                                ? `${job.description.slice(0, 260).trim()}...`
                                : job.description}
                            </p>

                            {reqBullets.length > 0 && (
                              <div className="rounded-lg bg-stone-50 p-2.5 space-y-1">
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                                  Requisitos principais:
                                </span>
                                <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-stone-700">
                                  {reqBullets.slice(0, 4).map((req, i) => (
                                    <li key={i}>{req}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <div className="flex items-center gap-2 pt-1">
                              <Link
                                href={
                                  job.isTalentPool
                                    ? `/${companySlug}/vagas/${job.id}/candidatar`
                                    : `/${companySlug}/vagas/${job.id}`
                                }
                                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-stone-900 px-3 py-2 text-xs font-semibold text-white hover:bg-stone-800"
                              >
                                <span>Candidatar-se</span>
                                <ExternalLink className="size-3" />
                              </Link>

                              <button
                                type="button"
                                onClick={() => handleSwitchBot("vagas", job)}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-100"
                              >
                                <Bot className="size-3.5 text-blue-600" />
                                <span>Perguntar ao Bot</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── ABA 3: ATENDIMENTO RH UNIFICADO (FILA + CHAT PRIVADO 🔒 + PARTICIPANTES) ─── */}
          {sideTab === "rh" && (
            <div className="flex flex-col h-[500px] p-4 space-y-4 overflow-y-auto">
              {/* Convites de conversa privada recebidos */}
              {spaceState.myIncomingDmRequests.length > 0 && (
                <div className="space-y-2">
                  {spaceState.myIncomingDmRequests.map((req) => (
                    <div
                      key={req.id}
                      className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2"
                    >
                      <p className="text-xs font-bold text-stone-900">
                        🔒 {req.requester.displayName} convidou você para uma conversa privada
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRespondDm(req.id, true)}
                          className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-bold text-white"
                        >
                          Aceitar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRespondDm(req.id, false)}
                          className="flex-1 rounded-lg bg-stone-200 py-1.5 text-xs font-bold text-stone-700"
                        >
                          Recusar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Se houver conversa privada ativa (Balcão RH ou DM), exibe o Chat Privado 🔒 direto aqui! */}
              {spaceState.myActiveConversation ? (
                <div className="flex flex-1 flex-col rounded-xl border border-stone-200 bg-stone-50/50 p-3">
                  <div className="flex items-center justify-between border-b border-stone-200 pb-2.5 mb-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                        <Lock className="size-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">
                          {spaceState.myActiveConversation.kind === "SERVICE"
                            ? `Balcão ${spaceState.myActiveConversation.desk || 1} · ${spaceState.myActiveConversation.requester.displayName}`
                            : `Conversa Privada · ${spaceState.myActiveConversation.requester.displayName}`}
                        </span>
                      </div>
                      <p className="text-[10px] text-stone-500">
                        Chat confidencial (🔒). Apenas vocês dois leem estas mensagens.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleCloseConversation(spaceState.myActiveConversation!.id)
                      }
                      className="shrink-0 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-50"
                    >
                      Encerrar
                    </button>
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto py-2 min-h-[200px]">
                    {spaceState.activeMessages.length === 0 ? (
                      <p className="text-center text-xs text-stone-400 py-8">
                        Envie uma mensagem abaixo para iniciar o atendimento.
                      </p>
                    ) : (
                      spaceState.activeMessages.map((m) => {
                        const mine = m.senderId === me?.id;
                        return (
                          <div
                            key={m.id}
                            className={`flex flex-col ${
                              mine ? "items-end" : "items-start"
                            }`}
                          >
                            <span className="text-[10px] font-semibold text-stone-400 mb-0.5">
                              {m.senderName}
                            </span>
                            <div
                              className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs ${
                                mine
                                  ? "bg-stone-900 text-white"
                                  : "border border-stone-200 bg-white text-stone-900"
                              }`}
                            >
                              {m.body}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <form
                    onSubmit={handleSendPrivateMessage}
                    className="mt-2 flex items-center gap-2 pt-2 border-t border-stone-200"
                  >
                    <input
                      type="text"
                      value={privateInput}
                      onChange={(e) => setPrivateInput(e.target.value)}
                      maxLength={500}
                      placeholder="Escrever mensagem confidencial 🔒..."
                      className="flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="rounded-xl bg-stone-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-stone-800"
                    >
                      Enviar
                    </button>
                  </form>
                </div>
              ) : isStaff ? (
                /* Console de Fila do Gestor / RH */
                <div className="space-y-3">
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                    <h3 className="text-xs font-bold text-stone-900">
                      🎧 Fila de Atendimento nos Balcões 1 a 3
                    </h3>
                    <p className="mt-0.5 text-[11px] text-stone-500">
                      Chame o próximo candidato da fila para iniciar a conversa confidencial.
                    </p>
                  </div>

                  {spaceState.staffQueue.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-stone-200 p-6 text-center text-xs text-stone-400">
                      Nenhum candidato aguardando na fila neste momento.
                    </div>
                  ) : (
                    spaceState.staffQueue.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="rounded-xl border border-stone-200 bg-white p-3 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-stone-900 px-2 py-0.5 text-xs font-bold text-amber-300">
                              #{ticket.queueNumber}
                            </span>
                            <div>
                              <p className="text-xs font-bold text-stone-900">
                                {ticket.requester.displayName}
                              </p>
                              <p className="text-[10px] text-stone-500">
                                Assunto: {ticket.topic}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
                          {[1, 2, 3].map((deskNum) => (
                            <button
                              key={deskNum}
                              type="button"
                              disabled={busyAction}
                              onClick={() => handleCallTicket(ticket.id, deskNum)}
                              className="rounded-lg bg-stone-900 py-1.5 text-[11px] font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
                            >
                              Chamar B{deskNum}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                /* Visão Limpa do Candidato para Retirar Senha */
                <div className="space-y-3">
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-3.5">
                    <h3 className="text-xs font-bold text-stone-900">
                      🎧 Falar Individualmente com um Recrutador (1:1)
                    </h3>
                    <p className="mt-1 text-[11px] leading-relaxed text-stone-600">
                      Retire uma senha gratuita. Quando o recrutador chamar seu número para o Balcão 1, 2 ou 3, sua conversa privada (🔒) abrirá aqui mesmo.
                    </p>
                  </div>

                  {spaceState.myWaitingTicket ? (
                    <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4 text-center space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                        Sua Senha na Fila
                      </span>
                      <p className="text-3xl font-black text-stone-900">
                        #{spaceState.myWaitingTicket.queueNumber}
                      </p>
                      <p className="text-xs font-semibold text-amber-900">
                        Posição: {spaceState.myPositionInQueue}º · Assunto:{" "}
                        {spaceState.myWaitingTicket.topic}
                      </p>
                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={() =>
                          handleCloseConversation(spaceState.myWaitingTicket!.id)
                        }
                        className="text-[11px] font-semibold text-rose-700 underline"
                      >
                        Cancelar senha
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <label className="block text-xs font-semibold text-stone-700">
                        Qual é o assunto do seu atendimento?
                      </label>
                      <div className="grid grid-cols-1 gap-1.5">
                        {SUPPORT_TOPICS.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setSelectedTopic(t.id)}
                            className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                              selectedTopic === t.id
                                ? "border-stone-900 bg-stone-900 text-white"
                                : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                            }`}
                          >
                            <span>{t.icon}</span>
                            <span>{t.label}</span>
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={handleJoinQueue}
                        className="w-full rounded-xl bg-stone-900 py-2.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-stone-800 disabled:opacity-50"
                      >
                        🎫 Retirar Senha de Atendimento RH
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Lista Compacta de Pessoas Online na Sala */}
              <div className="pt-3 border-t border-stone-100 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-700 flex items-center gap-1.5">
                    <Users className="size-3.5 text-stone-400" />
                    <span>Pessoas na Sala ({allUsersOnMap.length})</span>
                  </span>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {allUsersOnMap.map((u) => (
                    <div
                      key={u.participantId}
                      onClick={() => setSelectedUser(u)}
                      className="flex items-center justify-between rounded-xl border border-stone-200/80 bg-stone-50/60 px-2.5 py-1.5 cursor-pointer hover:bg-stone-100"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <PixelAvatarSprite avatar={u.avatar} kind={u.kind} size={24} />
                        <span className="truncate text-xs font-semibold text-stone-900">
                          {u.displayName} {u.participantId === me?.id && "(Você)"}
                        </span>
                      </div>
                      <span className="text-[10px] font-medium text-stone-500">
                        {SUPPORT_ROOMS[u.room].shortName}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ocorrências pendentes (apenas Gestor / Admin) */}
              {isStaff && spaceState.staffOpenReports.length > 0 && (
                <div className="pt-2 border-t border-stone-200 space-y-2">
                  <h4 className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
                    <ShieldAlert className="size-3.5" />
                    <span>Ocorrências ({spaceState.staffOpenReports.length})</span>
                  </h4>
                  {spaceState.staffOpenReports.map((rep) => (
                    <div
                      key={rep.id}
                      className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs space-y-1"
                    >
                      <p className="font-bold text-rose-950">
                        {rep.targetName} (por {rep.reporterName})
                      </p>
                      <p className="text-[11px] text-rose-900">{rep.reason}</p>
                      <div className="flex gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleModerate(rep.targetId, "mute")}
                          className="rounded bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white"
                        >
                          Silenciar
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const next = await resolveReportAction(companySlug, rep.id);
                            setSpaceState(next);
                          }}
                          className="ml-auto rounded bg-stone-800 px-2 py-0.5 text-[10px] font-bold text-white"
                        >
                          Arquivar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── ABA 4: ONDE ACOMPANHAR AVISOS NO SISTEMA ─── */}
          {sideTab === "orientacoes" && (
            <div className="flex flex-col h-[500px] p-4 space-y-3 overflow-y-auto">
              <div>
                <h3 className="text-xs font-bold text-stone-900">
                  🔔 Onde Acompanhar Avisos e Etapas no Sistema
                </h3>
                <p className="mt-0.5 text-[11px] text-stone-500">
                  Veja como saber quando seu currículo avançou ou quando o RH enviou uma solicitação:
                </p>
              </div>

              <div className="space-y-2.5">
                {CANDIDATE_SYSTEM_GUIDES.map((guide) => (
                  <div
                    key={guide.id}
                    className="rounded-xl border border-stone-200 bg-stone-50/50 p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                        {guide.step}
                      </span>
                      {guide.linkType === "fila" ? (
                        <button
                          type="button"
                          onClick={() => setSideTab("rh")}
                          className="text-[11px] font-semibold text-stone-900 underline"
                        >
                          {guide.ctaLabel} →
                        </button>
                      ) : (
                        <Link
                          href={
                            guide.linkType === "notificacoes"
                              ? `/${companySlug}/notificacoes`
                              : guide.linkType === "candidaturas"
                                ? `/${companySlug}/minhas-candidaturas`
                                : `/${companySlug}/vagas`
                          }
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-900 underline"
                        >
                          <span>{guide.ctaLabel}</span>
                          <ExternalLink className="size-3" />
                        </Link>
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-stone-900">{guide.title}</h4>
                    <p className="text-[11px] leading-relaxed text-stone-600">
                      {guide.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── MODAL "COMO FUNCIONA EM 3 PASSOS" (MANUAL LIMPO E DIRETO) ─── */}
      {showFullGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-stone-900">
                  Como funciona o Espaço de Suporte & Carreiras
                </h2>
                <p className="text-xs text-stone-500">
                  Guia rápido em 3 passos para aproveitar todos os recursos da sala.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFullGuideModal(false)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex gap-3 rounded-xl border border-stone-200 bg-stone-50/70 p-3.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-stone-900 text-xs font-bold text-white">
                  1
                </span>
                <div>
                  <h3 className="text-xs font-bold text-stone-900">
                    Tire Dúvidas Imediatas com os Bots IA (Aba &ldquo;Bots IA&rdquo;)
                  </h3>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-stone-600">
                    Escolha entre <strong>Clara</strong> (dúvidas sobre as vagas abertas), <strong>Heitor</strong> (como acompanhar avisos e status no sistema) ou <strong>Helena</strong> (currículo PDF). Basta clicar nas perguntas sugeridas ou digitar no campo inferior.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 rounded-xl border border-stone-200 bg-stone-50/70 p-3.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-stone-900 text-xs font-bold text-white">
                  2
                </span>
                <div>
                  <h3 className="text-xs font-bold text-stone-900">
                    Consulte o Mural de Vagas (Aba &ldquo;Vagas&rdquo;)
                  </h3>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-stone-600">
                    Veja todas as vagas abertas da <strong>{companyName}</strong>, leia os requisitos e clique em <strong>Candidatar-se</strong> ou <strong>Perguntar ao Bot</strong>.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 rounded-xl border border-stone-200 bg-stone-50/70 p-3.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-stone-900 text-xs font-bold text-white">
                  3
                </span>
                <div>
                  <h3 className="text-xs font-bold text-stone-900">
                    Fale 1:1 com o RH ou Acompanhe Avisos (Abas &ldquo;RH&rdquo; e &ldquo;Avisos&rdquo;)
                  </h3>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-stone-600">
                    Precisa falar com um recrutador humano? Retire uma senha na aba <strong>RH</strong>. E para saber se avançou no processo seletivo, acompanhe sempre o <strong>Sino de Notificações</strong> e a página <strong>Minhas Candidaturas</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowFullGuideModal(false)}
                className="rounded-xl bg-stone-900 px-5 py-2 text-xs font-semibold text-white hover:bg-stone-800"
              >
                Entendi, começar agora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL DE CREDENCIAL & AVATAR ─── */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleEnterSpace}
            className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-stone-900">
                  Identificação na Sala · {companyName}
                </h2>
                <p className="text-xs text-stone-500">
                  Personalize seu avatar para acessar os Bots, Mural de Vagas e Suporte RH.
                </p>
              </div>
              {me && (
                <button
                  type="button"
                  onClick={() => setShowAvatarModal(false)}
                  className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"
                >
                  <X className="size-5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-4 rounded-xl border border-stone-200 bg-stone-50 p-3.5">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white">
                <PixelAvatarSprite
                  avatar={avatarDraft}
                  kind={spaceState.viewerRole}
                  size={52}
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <label className="block text-xs font-bold text-stone-800">
                  Seu Nome
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={32}
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  placeholder="Ex.: Mariana Silva..."
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-900 focus:border-stone-900 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <span className="font-semibold text-stone-700 block mb-1">Tom de pele:</span>
                <div className="flex gap-2">
                  {SKIN_TONES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setAvatarDraft((d) => ({ ...d, skin: color }))}
                      style={{ backgroundColor: color }}
                      className={`size-6 rounded-full border ${
                        avatarDraft.skin === color
                          ? "border-stone-950 scale-110 ring-2 ring-stone-900"
                          : "border-stone-300"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <span className="font-semibold text-stone-700 block mb-1">Cabelo:</span>
                  <div className="flex flex-wrap gap-1">
                    {HAIR_STYLES.map((style) => (
                      <button
                        key={style}
                        type="button"
                        onClick={() => setAvatarDraft((d) => ({ ...d, hair: style }))}
                        className={`rounded-md border px-2 py-1 text-[11px] font-semibold capitalize ${
                          avatarDraft.hair === style
                            ? "border-stone-900 bg-stone-900 text-white"
                            : "border-stone-200 bg-stone-50 text-stone-700"
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="font-semibold text-stone-700 block mb-1">Acessório:</span>
                  <div className="flex flex-wrap gap-1">
                    {ACCESSORIES.map((acc) => (
                      <button
                        key={acc}
                        type="button"
                        onClick={() =>
                          setAvatarDraft((d) => ({ ...d, accessory: acc }))
                        }
                        className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                          avatarDraft.accessory === acc
                            ? "border-stone-900 bg-stone-900 text-white"
                            : "border-stone-200 bg-stone-50 text-stone-700"
                        }`}
                      >
                        {acc === "none" && "Nenhum"}
                        {acc === "headset" && "🎧"}
                        {acc === "glasses" && "👓"}
                        {acc === "cap" && "🧢"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <span className="font-semibold text-stone-700 block mb-1">Cor Cabelo:</span>
                  <div className="flex flex-wrap gap-1">
                    {HAIR_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setAvatarDraft((d) => ({ ...d, hairColor: c }))}
                        style={{ backgroundColor: c }}
                        className={`size-4 rounded-full border ${
                          avatarDraft.hairColor === c
                            ? "ring-2 ring-stone-900 scale-110"
                            : "border-stone-300"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <span className="font-semibold text-stone-700 block mb-1">Camisa:</span>
                  <div className="flex flex-wrap gap-1">
                    {SHIRT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setAvatarDraft((d) => ({ ...d, shirt: c }))}
                        style={{ backgroundColor: c }}
                        className={`size-4 rounded-full border ${
                          avatarDraft.shirt === c
                            ? "ring-2 ring-stone-900 scale-110"
                            : "border-stone-300"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <span className="font-semibold text-stone-700 block mb-1">Calça:</span>
                  <div className="flex flex-wrap gap-1">
                    {PANTS_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setAvatarDraft((d) => ({ ...d, pants: c }))}
                        style={{ backgroundColor: c }}
                        className={`size-4 rounded-full border ${
                          avatarDraft.pants === c
                            ? "ring-2 ring-stone-900 scale-110"
                            : "border-stone-300"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <label className="flex items-start gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={rulesAccepted}
                onChange={(e) => setRulesAccepted(e.target.checked)}
                className="mt-0.5 size-4 rounded border-stone-400 accent-stone-900"
              />
              <span className="text-[11px] leading-snug text-stone-700">
                Concordo em manter comunicação cordial e não compartilhar dados sensíveis (CPF/RG) no chat aberto da sala.
              </span>
            </label>

            {entryError && (
              <p className="rounded-lg bg-rose-50 border border-rose-200 p-2 text-xs font-semibold text-rose-700">
                {entryError}
              </p>
            )}

            <button
              type="submit"
              disabled={entering || !rulesAccepted}
              className="w-full rounded-xl bg-stone-900 py-2.5 text-xs font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50"
            >
              {entering ? "Entrando..." : "Confirmar e Entrar"}
            </button>
          </form>
        </div>
      )}

      {/* ─── MODAL DO SIMULADO DE ENTREVISTA ─── */}
      {showArcadeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 text-stone-900 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-blue-600" />
                <h3 className="text-sm font-bold text-stone-900">
                  Simulado Rápido de Entrevista
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowArcadeModal(false)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"
              >
                <X className="size-5" />
              </button>
            </div>

            {(() => {
              const q = CAREER_ARCADE_QUIZ[quizIndex];
              if (!q) return null;
              return (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-stone-500">
                    Questão {quizIndex + 1} de {CAREER_ARCADE_QUIZ.length} · Pontos:{" "}
                    <span className="font-bold text-stone-900">{quizScore}</span>
                  </p>
                  <p className="text-sm font-bold text-stone-900">{q.question}</p>

                  <div className="space-y-2">
                    {q.options.map((opt, idx) => {
                      const chosen = quizSelected === idx;
                      const isCorrect = idx === q.correctIndex;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            if (quizSelected !== null) return;
                            setQuizSelected(idx);
                            if (isCorrect) setQuizScore((s) => s + 100);
                          }}
                          className={`w-full rounded-xl border p-3 text-left text-xs font-semibold transition ${
                            quizSelected === null
                              ? "border-stone-200 bg-stone-50 hover:border-stone-900"
                              : isCorrect
                                ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                                : chosen
                                  ? "border-rose-400 bg-rose-50 text-rose-900"
                                  : "border-stone-200 bg-stone-50 opacity-60"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>

                  {quizSelected !== null && (
                    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-800 space-y-2">
                      <p>💡 {q.tip}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setQuizSelected(null);
                          setQuizIndex((i) => (i + 1) % CAREER_ARCADE_QUIZ.length);
                        }}
                        className="w-full rounded-lg bg-stone-900 py-2 text-xs font-semibold text-white"
                      >
                        Próxima Questão →
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ─── MODAL DE REPORTE DE CONDUTA ─── */}
      {reportModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4">
          <form
            onSubmit={handleReportSubmit}
            className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-rose-800">
                🚩 Reportar conduta de {reportModalUser.displayName}
              </h4>
              <button
                type="button"
                onClick={() => setReportModalUser(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="size-4" />
              </button>
            </div>
            <textarea
              required
              minLength={3}
              maxLength={240}
              rows={3}
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Descreva brevemente o ocorrido..."
              className="w-full rounded-xl border border-stone-200 p-2.5 text-xs"
            />
            <button
              type="submit"
              disabled={busyAction}
              className="w-full rounded-xl bg-rose-600 py-2 text-xs font-bold text-white hover:bg-rose-700"
            >
              Enviar à Moderação
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
