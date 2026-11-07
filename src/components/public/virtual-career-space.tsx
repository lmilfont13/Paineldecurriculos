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
  HOW_IT_WORKS_STEPS,
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
  Compass,
  ExternalLink,
  Eye,
  EyeOff,
  Flag,
  Headphones,
  HelpCircle,
  Lock,
  MapPin,
  Megaphone,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  UserCheck,
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

type SidePanelTab = "vagas" | "bots" | "orientacoes" | "rh" | "privado";

interface BotChatMessage {
  id: string;
  sender: "bot" | "user";
  botId: AssistantBotId;
  text: string;
  timestamp: string;
}

export function VirtualCareerSpace({
  companySlug,
  companyName,
  initialState,
  embeddedInGestorPanel = false,
}: VirtualCareerSpaceProps) {
  const [spaceState, setSpaceState] = useState<SupportSpaceStateDTO>(initialState);
  const me = spaceState.me;
  const isStaff = spaceState.viewerRole === "STAFF";
  const openJobs = spaceState.openJobs ?? [];
  const regularJobs = openJobs.filter((j) => !j.isTalentPool);
  const talentPoolJob = openJobs.find((j) => j.isTalentPool) ?? null;

  // Guia "Como Funciona" (visível por padrão para orientar candidatos com clareza)
  const [showHowItWorksBanner, setShowHowItWorksBanner] = useState<boolean>(
    !embeddedInGestorPanel
  );
  const [showFullGuideModal, setShowFullGuideModal] = useState<boolean>(false);

  // Modal de Entrada / Credencial e Avatar Corporativo
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

  // Painel lateral direito (5 abas corporativas)
  const [sideTab, setSideTab] = useState<SidePanelTab>(() => {
    if (initialState.myActiveConversation) return "privado";
    if (initialState.viewerRole === "STAFF") return "rh";
    return "vagas";
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
    const defaultBot = SUPPORT_ASSISTANT_BOTS[0];
    return [
      {
        id: "welcome_vagas",
        sender: "bot",
        botId: "vagas",
        text: defaultBot.greeting,
        timestamp: "Agora",
      },
    ];
  });

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
    }, 4200);
  }, []);

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

  // Polling leve para garantir sincronia de fila e mensagens privadas em qualquer rede
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
        setSideTab("privado");
        showToast(`🎧 Você foi chamado para atendimento no Balcão ${desk}!`);
        void refreshServerState(payload?.payload?.conversationId);
      })
      .on("broadcast", { event: "dm_invite" }, () => {
        setSideTab("privado");
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
        moveAvatarTo(myCoords.x, Math.max(10, myCoords.y - step));
      } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        e.preventDefault();
        moveAvatarTo(myCoords.x, Math.min(92, myCoords.y + step));
      } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        moveAvatarTo(Math.max(6, myCoords.x - step), myCoords.y);
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        moveAvatarTo(Math.min(94, myCoords.x + step), myCoords.y);
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
      showToast("Credencial confirmada. Bem-vindo ao Centro de Suporte & Carreiras!");
    } catch (err: any) {
      setEntryError(err?.message || "Não foi possível entrar no espaço.");
    } finally {
      setEntering(false);
    }
  };

  // Interagir com um dos 3 Bots Assistentes
  const handleSwitchBot = useCallback((botId: AssistantBotId, customJob?: SupportJobDTO) => {
    setActiveBotId(botId);
    setSideTab("bots");
    const bot = SUPPORT_ASSISTANT_BOTS.find((b) => b.id === botId) ?? SUPPORT_ASSISTANT_BOTS[0];
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
          text: `Gostaria de saber sobre a vaga: ${customJob.title}`,
          timestamp: "Agora",
        },
        {
          id: `b_${Date.now() + 1}`,
          sender: "bot",
          botId: "vagas",
          text: reply,
          timestamp: "Agora",
        },
      ]);
      return;
    }

    setBotMessages((prev) => {
      const alreadyHasGreeting = prev.some(
        (m) => m.sender === "bot" && m.botId === botId
      );
      if (alreadyHasGreeting) return prev;
      return [
        ...prev,
        {
          id: `welcome_${botId}_${Date.now()}`,
          sender: "bot",
          botId,
          text: bot.greeting,
          timestamp: "Agora",
        },
      ];
    });
  }, [companyName, openJobs]);

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
      ...prev.slice(-20),
      {
        id: `usr_${Date.now()}`,
        sender: "user",
        botId: activeBotId,
        text: trimmed,
        timestamp: "Agora",
      },
      {
        id: `bot_${Date.now() + 1}`,
        sender: "bot",
        botId: activeBotId,
        text: reply,
        timestamp: "Agora",
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
      showToast("🎫 Senha registrada! Aguarde o chamado do recrutador para o balcão.");
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
      setSideTab("privado");
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
      setSideTab("privado");
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
      if (accept) setSideTab("privado");
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
      showToast("Atendimento / conversa privada encerrada.");
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

  // Alternar se a sala está visível para os candidatos ou oculta em Modo Teste
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
          : "🔒 Sala em Modo Teste Interno (oculta para candidatos no portal)."
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

  return (
    <div className="space-y-4">
      {/* ─── TOAST CORPORATIVO DE NOTIFICAÇÃO ─── */}
      {feedbackToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xl animate-in fade-in slide-in-from-bottom-4">
          {feedbackToast}
        </div>
      )}

      {/* ─── COMUNICADO OFICIAL DA EQUIPE RH ─── */}
      {staffAnnouncement && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/90 px-4 py-3 text-xs text-blue-950 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-white">
              <Megaphone className="size-4" />
            </span>
            <div>
              <span className="font-bold">
                Comunicado Oficial RH ({staffAnnouncement.author}):{" "}
              </span>
              <span className="font-medium">{staffAnnouncement.text}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStaffAnnouncement(null)}
            className="rounded-lg p-1 text-blue-700 hover:bg-blue-100"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* ─── CONTROLE DE VISIBILIDADE PARA CANDIDATOS (EXCLUSIVO GESTOR / ADMIN) ─── */}
      {isStaff && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-2xs transition ${
            spaceState.isPublicEnabled
              ? "border-emerald-200 bg-emerald-50/80 text-emerald-950"
              : "border-amber-200 bg-amber-50/80 text-amber-950"
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-lg font-bold ${
                spaceState.isPublicEnabled
                  ? "bg-emerald-600 text-white"
                  : "bg-amber-500 text-slate-950"
              }`}
            >
              {spaceState.isPublicEnabled ? (
                <Eye className="size-4" />
              ) : (
                <EyeOff className="size-4" />
              )}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider">
                  {spaceState.isPublicEnabled
                    ? "Ambiente Público Ativo para Candidatos"
                    : "Ambiente em Modo de Homologação / Teste Interno"}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    spaceState.isPublicEnabled
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-amber-100 text-amber-900 border border-amber-300"
                  }`}
                >
                  {spaceState.isPublicEnabled
                    ? "Visível no Portal"
                    : "Oculto no Portal de Vagas"}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-600">
                {spaceState.isPublicEnabled
                  ? "Candidatos podem acessar o Mural de Vagas, Bots Assistentes e retirar senha para os Balcões 1 a 3."
                  : "Apenas gestores e administradores visualizam a sala. Ative quando desejar abrir o suporte público."}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={busyAction}
            onClick={handleTogglePublicVisibility}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold shadow-2xs transition disabled:opacity-50 ${
              spaceState.isPublicEnabled
                ? "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            {spaceState.isPublicEnabled ? (
              <>
                <EyeOff className="size-3.5" />
                <span>Pausar Acesso Público (Modo Teste)</span>
              </>
            ) : (
              <>
                <Eye className="size-3.5" />
                <span>Liberar Acesso Público para Candidatos</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* ─── GUIA RÁPIDO CORPORATIVO: "COMO FUNCIONA O ATENDIMENTO AO VIVO" (CLARO E EXPLICATIVO) ─── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-900 px-4 py-2.5 text-white">
          <div className="flex items-center gap-2">
            <Compass className="size-4 text-sky-400" />
            <span className="text-xs font-bold tracking-wide">
              Guia de Navegação · Como utilizar o Centro de Carreiras & Suporte ao Vivo
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFullGuideModal(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-sky-200 hover:bg-white/15"
            >
              <HelpCircle className="size-3.5" />
              <span>Manual Completo da Sala</span>
            </button>
            <button
              type="button"
              onClick={() => setShowHowItWorksBanner((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <span>{showHowItWorksBanner ? "Recolher guia" : "Expandir guia"}</span>
              {showHowItWorksBanner ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </button>
          </div>
        </div>

        {showHowItWorksBanner && (
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 bg-slate-50/60">
            {HOW_IT_WORKS_STEPS.map((step) => {
              const isCurrentTab = sideTab === step.actionTab;
              return (
                <div
                  key={step.number}
                  className={`flex flex-col justify-between rounded-xl border p-3.5 transition ${
                    isCurrentTab
                      ? "border-blue-600 bg-blue-50/40 shadow-2xs"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                        PASSO {step.number}
                      </span>
                      {step.actionTab === "vagas" && (
                        <span className="text-[11px] font-bold text-blue-700">
                          {openJobs.length} {openJobs.length === 1 ? "vaga" : "vagas"}
                        </span>
                      )}
                      {step.actionTab === "bots" && (
                        <span className="text-[11px] font-bold text-emerald-700">
                          3 Bots Online
                        </span>
                      )}
                    </div>
                    <h3 className="text-xs font-bold text-slate-900">{step.title}</h3>
                    <p className="text-[11px] leading-relaxed text-slate-600">
                      {step.summary}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSideTab(step.actionTab)}
                    className={`mt-3 w-full rounded-lg py-1.5 text-[11px] font-bold transition ${
                      isCurrentTab
                        ? "bg-blue-700 text-white"
                        : "border border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200"
                    }`}
                  >
                    {step.actionLabel} →
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── BARRA DE SETORES CORPORATIVOS & CREDENCIAL DE ACESSO ─── */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Setores:
          </span>
          {SUPPORT_ROOM_IDS.map((roomId) => {
            const room = SUPPORT_ROOMS[roomId];
            const active = currentRoom === roomId;
            return (
              <button
                key={roomId}
                type="button"
                onClick={() => moveAvatarTo(room.spawn.x, room.spawn.y)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white shadow-2xs"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span>{room.icon}</span>
                <span>{room.shortName}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
            <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
            {allUsersOnMap.length} online
          </span>

          <button
            type="button"
            onClick={() => {
              if (me) {
                setDisplayNameInput(me.displayName);
                setAvatarDraft(me.avatar);
              }
              setShowAvatarModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            <Sparkles className="size-3.5 text-blue-600" />
            <span>Meu Perfil & Avatar</span>
          </button>
        </div>
      </div>

      {/* ─── GRID PRINCIPAL: PLANTA INTERATIVA (7 COLUNAS) + CENTRAL CORPORATIVA (5 COLUNAS) ─── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* COLUNA ESQUERDA: PLANTA INTERATIVA DO ESCRITÓRIO (7 colunas) */}
        <div className="lg:col-span-7 space-y-3">
          <PixelOfficeCanvas
            meId={me?.id || ""}
            users={allUsersOnMap}
            bubbles={publicBubbles}
            reactions={reactions}
            activePrivatePairs={spaceState.activePrivatePairs}
            queueCount={spaceState.queueCount}
            openJobCount={openJobs.length}
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
              showToast("📋 Mural de Vagas aberto no painel ao lado.");
            }}
            onOpenGuidesPanel={() => {
              setSideTab("orientacoes");
              showToast("🔔 Guia de Acompanhamento e Avisos aberto no painel ao lado.");
            }}
            onSelectBot={(botId) => {
              handleSwitchBot(botId);
              const bot = SUPPORT_ASSISTANT_BOTS.find((b) => b.id === botId);
              if (bot) {
                showToast(`🤖 Conectado a ${bot.name}. Faça sua pergunta ao lado!`);
              }
            }}
          />

          {/* Barra de Comunicação Pública no Ambiente + Reações */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs space-y-2.5">
            <form onSubmit={handleSendPublicBubble} className="flex flex-wrap items-center gap-2">
              {isStaff && (
                <button
                  type="button"
                  onClick={() => setIsAnnouncementMode((v) => !v)}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-xs font-bold transition ${
                    isAnnouncementMode
                      ? "border-blue-700 bg-blue-700 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                  title="Alternar entre mensagem na sala e Comunicado Oficial no topo"
                >
                  <Megaphone className="size-3.5" />
                  <span>Comunicado RH</span>
                </button>
              )}

              <input
                type="text"
                value={bubbleInput}
                onChange={(e) => setBubbleInput(e.target.value)}
                maxLength={140}
                placeholder={
                  isAnnouncementMode
                    ? "Digite um comunicado oficial da equipe RH para toda a sala..."
                    : `Mensagem rápida no setor ${SUPPORT_ROOMS[currentRoom].shortName} (visível a todos na sala)...`
                }
                className="min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none"
              />

              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                <Send className="size-3.5" />
                <span>Enviar na Sala</span>
              </button>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-semibold text-slate-400 mr-1">
                  Interações:
                </span>
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSendQuickReaction(emoji)}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-sm transition hover:bg-slate-100"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <span className="text-[11px] text-slate-500">
                💡 Clique nos pontos do mapa para se deslocar · Para assuntos pessoais, use a{" "}
                <button
                  type="button"
                  onClick={() => setSideTab("rh")}
                  className="font-semibold text-blue-700 underline"
                >
                  Fila RH (Privado 🔒)
                </button>
              </span>
            </div>
          </div>

          {/* Card de Inspeção quando clica em um Participante no Mapa */}
          {selectedUser && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white p-3.5 shadow-sm animate-in fade-in">
              <div className="flex items-center gap-3">
                <PixelAvatarSprite
                  avatar={selectedUser.avatar}
                  kind={selectedUser.kind}
                  size={40}
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-900">
                      {selectedUser.displayName}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                      {selectedUser.kind === "STAFF"
                        ? "Equipe RH"
                        : selectedUser.kind === "CANDIDATE"
                          ? "✓ Candidato Identificado"
                          : "Visitante"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Setor atual: {SUPPORT_ROOMS[selectedUser.room].name}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {me && selectedUser.participantId !== me.id && (
                  <>
                    {me.kind !== "GUEST" &&
                      (selectedUser.kind !== "GUEST" || isStaff) && (
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={() => handleRequestDm(selectedUser)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          <Lock className="size-3.5 text-sky-400" />
                          <span>Conversa Privada</span>
                        </button>
                      )}

                    <button
                      type="button"
                      onClick={() => setReportModalUser(selectedUser)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      <Flag className="size-3.5" />
                      <span>Reportar</span>
                    </button>

                    {isStaff && selectedUser.kind !== "STAFF" && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            handleModerate(selectedUser.participantId, "mute")
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                        >
                          <VolumeX className="size-3.5" />
                          <span>Silenciar 10m</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleModerate(selectedUser.participantId, "ban")
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                        >
                          <Ban className="size-3.5" />
                          <span>Suspender</span>
                        </button>
                      </>
                    )}
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* COLUNA DIREITA: CENTRAL INTEGRADA (MURAL DE VAGAS, BOTS ASSISTENTES, AVISOS DO SISTEMA, FILA RH E CHAT PRIVADO) (5 colunas) */}
        <div className="lg:col-span-5 flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          {/* Navegação das 5 Abas Corporativas */}
          <div className="grid grid-cols-5 border-b border-slate-200 bg-slate-50 p-1 gap-1">
            <button
              type="button"
              onClick={() => setSideTab("vagas")}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-2 px-1 text-[11px] font-bold transition ${
                sideTab === "vagas"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Briefcase className="size-3.5" />
              <span>Vagas ({openJobs.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setSideTab("bots")}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-2 px-1 text-[11px] font-bold transition ${
                sideTab === "bots"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Bot className="size-3.5" />
              <span>Bots IA</span>
            </button>

            <button
              type="button"
              onClick={() => setSideTab("orientacoes")}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-2 px-1 text-[11px] font-bold transition ${
                sideTab === "orientacoes"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Bell className="size-3.5" />
              <span>Avisos</span>
            </button>

            <button
              type="button"
              onClick={() => setSideTab("rh")}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-2 px-1 text-[11px] font-bold transition ${
                sideTab === "rh"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Headphones className="size-3.5" />
              <span>Fila RH ({spaceState.queueCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setSideTab("privado")}
              className={`relative flex flex-col items-center justify-center gap-0.5 rounded-lg py-2 px-1 text-[11px] font-bold transition ${
                sideTab === "privado"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Lock className="size-3.5" />
              <span>Privado</span>
              {(spaceState.myActiveConversation ||
                spaceState.myIncomingDmRequests.length > 0) && (
                <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-amber-500 animate-ping" />
              )}
            </button>
          </div>

          {/* ─── ABA 1: MURAL DE VAGAS CORPORATIVO ─── */}
          {sideTab === "vagas" && (
            <div className="flex-1 p-4 space-y-3.5 overflow-y-auto max-h-[560px]">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">
                      📋 Mural de Vagas Abertas · {companyName}
                    </h3>
                    <p className="mt-0.5 text-[11px] text-slate-600">
                      Consulte os requisitos de cada oportunidade, pergunte ao Bot Assistente ou candidate-se diretamente.
                    </p>
                  </div>
                  <Link
                    href={`/${companySlug}/vagas`}
                    className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <span>Portal</span>
                    <ExternalLink className="size-3" />
                  </Link>
                </div>

                <div className="mt-2.5 relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={jobSearch}
                    onChange={(e) => setJobSearch(e.target.value)}
                    placeholder="Buscar por cargo, cidade ou modalidade (ex.: Remoto)..."
                    className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {filteredJobs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center space-y-2">
                  <p className="text-xs font-semibold text-slate-700">
                    Nenhuma vaga encontrada para o filtro informado.
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Limpe a busca ou consulte nosso Assistente Virtual para orientações de cadastro.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
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
                          job.isTalentPool
                            ? "border-indigo-200 bg-indigo-50/30"
                            : isExpanded
                              ? "border-slate-900 bg-white shadow-xs"
                              : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div
                          onClick={() =>
                            setExpandedJobId(isExpanded ? null : job.id)
                          }
                          className="cursor-pointer p-3 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {job.isTalentPool ? (
                                  <span className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
                                    Banco de Talentos
                                  </span>
                                ) : (
                                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                    Vaga Aberta
                                  </span>
                                )}
                                {job.code && (
                                  <span className="text-[10px] font-semibold text-slate-400">
                                    #{job.code}
                                  </span>
                                )}
                              </div>
                              <h4 className="mt-1 text-xs font-bold text-slate-900">
                                {job.title}
                              </h4>
                            </div>

                            <span className="text-slate-400">
                              {isExpanded ? (
                                <ChevronUp className="size-4" />
                              ) : (
                                <ChevronDown className="size-4" />
                              )}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                              {formatSupportJobWorkMode(job.workMode)}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                              {formatSupportJobContract(job.contract)}
                            </span>
                            {job.location && (
                              <span className="inline-flex items-center gap-1 text-slate-500">
                                <MapPin className="size-3" />
                                {job.location}
                              </span>
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-slate-100 px-3 pb-3 pt-2.5 space-y-3 text-xs">
                            <p className="text-[11px] leading-relaxed text-slate-600 whitespace-pre-line">
                              {job.description.length > 320
                                ? `${job.description.slice(0, 320).trim()}...`
                                : job.description}
                            </p>

                            {reqBullets.length > 0 && (
                              <div className="rounded-lg bg-slate-50 p-2.5 space-y-1">
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                  Principais Requisitos:
                                </span>
                                <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-700">
                                  {reqBullets.slice(0, 5).map((req, i) => (
                                    <li key={i}>{req}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <Link
                                href={
                                  job.isTalentPool
                                    ? `/${companySlug}/vagas/${job.id}/candidatar`
                                    : `/${companySlug}/vagas/${job.id}`
                                }
                                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-bold text-white hover:bg-slate-800"
                              >
                                <span>
                                  {job.isTalentPool
                                    ? "Cadastrar Currículo"
                                    : "Ver Vaga & Candidatar"}
                                </span>
                                <ExternalLink className="size-3" />
                              </Link>

                              <button
                                type="button"
                                onClick={() => handleSwitchBot("vagas", job)}
                                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 text-[11px] font-bold text-blue-800 hover:bg-blue-100"
                              >
                                <Bot className="size-3.5" />
                                <span>Tirar Dúvida no Bot</span>
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

          {/* ─── ABA 2: BOTS ASSISTENTES CORPORATIVOS (TIRA-DÚVIDAS DE VAGAS & SISTEMA) ─── */}
          {sideTab === "bots" && (
            <div className="flex flex-1 flex-col p-4 space-y-3 overflow-y-auto max-h-[560px]">
              {/* Seletor dos 3 Bots Assistentes */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Escolha o Assistente Especialista:
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {SUPPORT_ASSISTANT_BOTS.map((bot) => {
                    const active = bot.id === activeBotId;
                    return (
                      <button
                        key={bot.id}
                        type="button"
                        onClick={() => handleSwitchBot(bot.id)}
                        className={`flex flex-col items-start rounded-xl border p-2 text-left transition ${
                          active
                            ? "border-blue-600 bg-blue-50/70 shadow-2xs"
                            : "border-slate-200 bg-slate-50/60 hover:bg-slate-100"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <PixelAvatarSprite avatar={bot.avatar} kind="STAFF" size={26} />
                          <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-sky-300">
                            {bot.badge}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] font-bold text-slate-900 leading-tight">
                          {bot.name.split("·")[0]}
                        </p>
                        <p className="text-[10px] text-slate-500 line-clamp-1">
                          {bot.roleTitle}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Seletor de Vaga Específica (quando está no Bot de Vagas) */}
              {activeBotId === "vagas" && openJobs.length > 0 && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-2.5 space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-blue-900">
                    Consultar detalhes sobre a vaga:
                  </label>
                  <select
                    value={selectedBotJobId}
                    onChange={(e) => setSelectedBotJobId(e.target.value)}
                    className="w-full rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    {openJobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.isTalentPool ? `[Banco de Talentos] ${j.title}` : j.title} (
                        {formatSupportJobWorkMode(j.workMode)} ·{" "}
                        {formatSupportJobContract(j.contract)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Perguntas Rápidas Sugeridas pelo Bot */}
              <div className="space-y-1.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Perguntas Frequentes (Clique para resposta imediata):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {currentBot.quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleAskBotQuestion(prompt)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-900"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Histórico de Respostas do Assistente */}
              <div className="flex-1 space-y-2.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70 p-3 min-h-[210px] max-h-[250px]">
                {botMessages
                  .filter((m) => m.botId === activeBotId)
                  .map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col ${
                        m.sender === "user" ? "items-end" : "items-start"
                      }`}
                    >
                      <span className="text-[10px] font-semibold text-slate-400 mb-0.5">
                        {m.sender === "user" ? "Você" : currentBot.name}
                      </span>
                      <div
                        className={`max-w-[92%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line ${
                          m.sender === "user"
                            ? "bg-slate-900 text-white"
                            : "border border-slate-200 bg-white text-slate-800 shadow-2xs"
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))}
              </div>

              {/* Input livre para perguntar ao Bot */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAskBotQuestion(botInput);
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={botInput}
                  onChange={(e) => setBotInput(e.target.value)}
                  placeholder={`Pergunte a ${currentBot.name.split("·")[0].trim()}...`}
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-800"
                >
                  Perguntar
                </button>
              </form>

              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-500">
                <span>Precisa de análise humana do seu caso?</span>
                <button
                  type="button"
                  onClick={() => setSideTab("rh")}
                  className="font-bold text-slate-900 underline hover:text-blue-700"
                >
                  Ir para Fila RH →
                </button>
              </div>
            </div>
          )}

          {/* ─── ABA 3: ORIENTAÇÕES PARA ACOMPANHAR AVISOS NO SISTEMA ─── */}
          {sideTab === "orientacoes" && (
            <div className="flex-1 p-4 space-y-3.5 overflow-y-auto max-h-[560px]">
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5">
                <h3 className="text-xs font-bold text-blue-950">
                  🔔 Como Acompanhar os Avisos e Etapas no Sistema
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-blue-900">
                  Para que você nunca perca uma convocação ou atualização da equipe de RH da{" "}
                  <strong>{companyName}</strong>, todas as comunicações oficiais ficam registradas nos canais abaixo:
                </p>
              </div>

              <div className="space-y-2.5">
                {CANDIDATE_SYSTEM_GUIDES.map((guide) => (
                  <div
                    key={guide.id}
                    className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                        {guide.step}
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-700">
                        ✓ Atualização Automática
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-900">{guide.title}</h4>
                    <p className="text-[11px] leading-relaxed text-slate-600">
                      {guide.description}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
                      <span className="text-[10px] font-medium text-slate-500">
                        📍 {guide.whereToFind}
                      </span>

                      {guide.linkType === "fila" ? (
                        <button
                          type="button"
                          onClick={() => setSideTab("rh")}
                          className="rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-slate-800"
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
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-800 hover:bg-slate-100"
                        >
                          <span>{guide.ctaLabel}</span>
                          <ExternalLink className="size-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1.5">
                <p className="text-xs font-bold text-slate-900">
                  💡 Dica Importante sobre Segurança e LGPD
                </p>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  Nunca informe números de documentos (CPF ou RG) nos balões públicos da sala. Quando o RH solicitar dados de pré-entrevista, você preencherá exclusivamente pelo formulário seguro dentro de{" "}
                  <Link
                    href={`/${companySlug}/minhas-candidaturas`}
                    className="font-bold text-blue-700 underline"
                  >
                    Minhas Candidaturas
                  </Link>
                  .
                </p>
              </div>
            </div>
          )}

          {/* ─── ABA 4: FILA DE ATENDIMENTO RH (BALCÕES 1 A 3) ─── */}
          {sideTab === "rh" && (
            <div className="flex-1 p-4 space-y-4 overflow-y-auto max-h-[560px]">
              {isStaff ? (
                <>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <h3 className="text-xs font-bold text-slate-900">
                      🎧 Console de Atendimento RH ({companyName})
                    </h3>
                    <p className="mt-0.5 text-[11px] text-slate-600">
                      Chame o próximo candidato da fila para os Balcões 1, 2 ou 3. O atendimento abre automaticamente na aba Privado (🔒).
                    </p>
                  </div>

                  {/* Fila de espera para Gestor / Admin */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-700">
                      Candidatos Aguardando Senha ({spaceState.staffQueue.length})
                    </h4>

                    {spaceState.staffQueue.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                        Nenhuma senha aguardando atendimento neste momento.
                      </div>
                    ) : (
                      spaceState.staffQueue.map((ticket) => (
                        <div
                          key={ticket.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="rounded-md bg-slate-900 px-2 py-0.5 text-xs font-bold text-sky-300">
                                #{ticket.queueNumber}
                              </span>
                              <div>
                                <p className="text-xs font-bold text-slate-900">
                                  {ticket.requester.displayName}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  Assunto: {ticket.topic} ·{" "}
                                  {ticket.requester.kind === "CANDIDATE"
                                    ? "Candidato Cadastrado ✓"
                                    : "Visitante"}
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
                                className="rounded-lg bg-slate-900 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                              >
                                Chamar Balcão {deskNum}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Atendimentos em andamento nos balcões */}
                  {spaceState.staffActiveDesks.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <h4 className="text-xs font-bold text-emerald-800">
                        Em Atendimento nos Balcões ({spaceState.staffActiveDesks.length})
                      </h4>
                      {spaceState.staffActiveDesks.map((active) => (
                        <div
                          key={active.id}
                          className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 text-xs"
                        >
                          <div>
                            <span className="font-bold text-emerald-950">
                              Balcão {active.desk || 1}: {active.requester.displayName}
                            </span>
                            <span className="block text-[10px] text-emerald-700">
                              Recrutador: {active.responder?.displayName || "RH"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              void refreshServerState(active.id);
                              setSideTab("privado");
                            }}
                            className="rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white"
                          >
                            Abrir Chat
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Visão do Candidato / Visitante na Fila */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                    <h3 className="text-xs font-bold text-slate-900">
                      🎧 Atendimento Individual com Recrutador (1:1)
                    </h3>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                      Retire uma senha para atendimento confidencial em um dos Balcões de RH. Enquanto aguarda, você pode consultar o{" "}
                      <button
                        type="button"
                        onClick={() => setSideTab("vagas")}
                        className="font-bold text-blue-700 underline"
                      >
                        Mural de Vagas
                      </button>{" "}
                      ou tirar dúvidas rápidas com os{" "}
                      <button
                        type="button"
                        onClick={() => setSideTab("bots")}
                        className="font-bold text-blue-700 underline"
                      >
                        Bots Assistentes
                      </button>
                      .
                    </p>
                  </div>

                  {spaceState.myActiveConversation?.kind === "SERVICE" ? (
                    <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50 p-4 text-center space-y-2">
                      <span className="inline-block rounded-full bg-emerald-600 px-3 py-0.5 text-[11px] font-bold text-white">
                        Atendimento Ativo · Balcão {spaceState.myActiveConversation.desk || 1}
                      </span>
                      <p className="text-xs font-bold text-emerald-950">
                        Você está em sala privada com{" "}
                        {spaceState.myActiveConversation.responder?.displayName ||
                          "Equipe RH"}
                      </p>
                      <button
                        type="button"
                        onClick={() => setSideTab("privado")}
                        className="w-full rounded-lg bg-emerald-700 py-2 text-xs font-bold text-white hover:bg-emerald-800"
                      >
                        Abrir Conversa Confidencial 🔒
                      </button>
                    </div>
                  ) : spaceState.myWaitingTicket ? (
                    <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-center space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
                        Sua Senha de Atendimento
                      </p>
                      <p className="text-3xl font-black text-slate-900">
                        #{spaceState.myWaitingTicket.queueNumber}
                      </p>
                      <p className="text-xs font-semibold text-amber-900">
                        Posição na fila: {spaceState.myPositionInQueue}º · Assunto:{" "}
                        {spaceState.myWaitingTicket.topic}
                      </p>
                      <p className="text-[11px] text-slate-600">
                        Assim que o recrutador chamar sua senha, o chat privado abrirá automaticamente.
                      </p>
                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={() =>
                          handleCloseConversation(spaceState.myWaitingTicket!.id)
                        }
                        className="mt-1 text-[11px] font-bold text-rose-700 underline hover:text-rose-900"
                      >
                        Cancelar senha
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <label className="block text-xs font-bold text-slate-800">
                        Selecione o assunto do seu atendimento:
                      </label>
                      <div className="space-y-1.5">
                        {SUPPORT_TOPICS.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setSelectedTopic(t.id)}
                            className={`flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left text-xs font-semibold transition ${
                              selectedTopic === t.id
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <span className="text-base">{t.icon}</span>
                            <span>{t.label}</span>
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={handleJoinQueue}
                        className="w-full rounded-xl bg-blue-700 py-2.5 text-xs font-bold text-white shadow-2xs transition hover:bg-blue-800 disabled:opacity-50"
                      >
                        🎫 Retirar Senha de Atendimento RH
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ─── ABA 5: CONVERSA PRIVADA 🔒 & PARTICIPANTES ONLINE ─── */}
          {sideTab === "privado" && (
            <div className="flex flex-1 flex-col p-4 space-y-4 overflow-y-auto max-h-[560px]">
              {/* Solicitações de conversa privada pendentes */}
              {spaceState.myIncomingDmRequests.length > 0 && (
                <div className="space-y-2">
                  {spaceState.myIncomingDmRequests.map((req) => (
                    <div
                      key={req.id}
                      className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2"
                    >
                      <p className="text-xs font-bold text-slate-900">
                        🔒 {req.requester.displayName} solicitou uma conversa privada
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRespondDm(req.id, true)}
                          className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                        >
                          Aceitar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRespondDm(req.id, false)}
                          className="flex-1 rounded-lg bg-slate-200 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-300"
                        >
                          Recusar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {spaceState.myActiveConversation ? (
                <div className="flex flex-1 flex-col">
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                        <Lock className="size-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">
                          {spaceState.myActiveConversation.kind === "SERVICE"
                            ? `Balcão ${spaceState.myActiveConversation.desk || 1} · ${spaceState.myActiveConversation.requester.displayName}`
                            : `Privado · ${spaceState.myActiveConversation.requester.displayName} & ${spaceState.myActiveConversation.responder?.displayName}`}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Atendimento confidencial (🔒). Apenas os dois participantes leem estas mensagens.
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

                  <div className="flex-1 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 p-3 min-h-[220px] max-h-[280px]">
                    {spaceState.activeMessages.length === 0 ? (
                      <p className="text-center text-xs text-slate-400 py-8">
                        Envie sua mensagem abaixo para iniciar o atendimento privado.
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
                            <span className="text-[10px] font-semibold text-slate-400 mb-0.5">
                              {m.senderName}
                            </span>
                            <div
                              className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                                mine
                                  ? "bg-slate-900 text-white"
                                  : "border border-slate-200 bg-white text-slate-900"
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
                    className="mt-3 flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={privateInput}
                      onChange={(e) => setPrivateInput(e.target.value)}
                      maxLength={500}
                      placeholder="Digite sua mensagem confidencial 🔒..."
                      className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-800"
                    >
                      Enviar
                    </button>
                  </form>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center space-y-2">
                  <div className="mx-auto flex size-9 items-center justify-center rounded-xl bg-white text-slate-700 border border-slate-200">
                    <Lock className="size-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Nenhuma conversa privada ativa no momento
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Retire uma senha na aba <strong>Fila RH</strong> para atendimento individual com recrutador ou selecione um participante cadastrado abaixo.
                  </p>
                </div>
              )}

              {/* Lista de Participantes na Sala */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700">
                    Participantes Online na Sala ({allUsersOnMap.length})
                  </h4>
                </div>

                <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                  {allUsersOnMap.map((u) => (
                    <div
                      key={u.participantId}
                      onClick={() => setSelectedUser(u)}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-2 cursor-pointer hover:bg-slate-100"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <PixelAvatarSprite avatar={u.avatar} kind={u.kind} size={28} />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-900">
                            {u.displayName} {u.participantId === me?.id && "(Você)"}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {SUPPORT_ROOMS[u.room].icon} {SUPPORT_ROOMS[u.room].shortName}
                          </p>
                        </div>
                      </div>

                      <span className="rounded bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        {u.kind === "STAFF"
                          ? "Equipe RH"
                          : u.kind === "CANDIDATE"
                            ? "✓ Candidato"
                            : "Visitante"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ocorrências abertas (visível apenas para Equipe RH / Admin) */}
              {isStaff && spaceState.staffOpenReports.length > 0 && (
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <h4 className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
                    <ShieldAlert className="size-4" />
                    <span>Ocorrências Pendentes ({spaceState.staffOpenReports.length})</span>
                  </h4>
                  {spaceState.staffOpenReports.map((rep) => (
                    <div
                      key={rep.id}
                      className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs space-y-1.5"
                    >
                      <p className="font-bold text-rose-950">
                        Participante: {rep.targetName}{" "}
                        <span className="font-normal text-rose-700">
                          (reportado por {rep.reporterName})
                        </span>
                      </p>
                      <p className="text-[11px] text-rose-900">Motivo: {rep.reason}</p>
                      {rep.excerpt && (
                        <p className="rounded bg-white/80 p-1.5 text-[10px] italic text-slate-700">
                          Mensagem: &ldquo;{rep.excerpt}&rdquo;
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleModerate(rep.targetId, "mute")}
                          className="rounded bg-amber-600 px-2 py-1 text-[10px] font-bold text-white"
                        >
                          Silenciar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleModerate(rep.targetId, "ban")}
                          className="rounded bg-red-600 px-2 py-1 text-[10px] font-bold text-white"
                        >
                          Suspender
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const next = await resolveReportAction(companySlug, rep.id);
                            setSpaceState(next);
                          }}
                          className="ml-auto rounded bg-slate-800 px-2 py-1 text-[10px] font-bold text-white"
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
        </div>
      </div>

      {/* ─── MODAL DO MANUAL COMPLETO ("COMO FUNCIONA O ESPAÇO CORPORATIVO") ─── */}
      {showFullGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <span className="inline-block rounded-md bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-800">
                  Guia do Candidato & Visitante
                </span>
                <h2 className="mt-1 text-base font-bold text-slate-900">
                  Como utilizar o Centro de Carreiras & Suporte ao Vivo · {companyName}
                </h2>
                <p className="text-xs text-slate-500">
                  Entenda em poucos segundos como consultar vagas, tirar dúvidas com os bots assistentes e acompanhar avisos no sistema.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFullGuideModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <Briefcase className="size-4 text-blue-600" />
                  <span>1. Mural de Vagas Integrado</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  Na aba <strong>Vagas</strong> (ou clicando em <em>Mural de Vagas</em> no mapa), você visualiza todas as oportunidades abertas da empresa, filtra por cargo ou cidade, lê os requisitos e acessa o formulário de inscrição.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <Bot className="size-4 text-emerald-600" />
                  <span>2. Bots Assistentes Especialistas</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  Contamos com 3 assistentes virtuais ativos 24h: <strong>Clara</strong> (dúvidas sobre vagas e requisitos), <strong>Heitor</strong> (como acompanhar avisos e etapas no sistema) e <strong>Helena</strong> (currículo em PDF e LGPD).
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <Bell className="size-4 text-amber-600" />
                  <span>3. Acompanhamento de Avisos no Sistema</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  Todo avanço de etapa, comunicado do RH ou pedido de <strong>Pré-Entrevista</strong> aparece no ícone de <strong>Sino (Notificações)</strong> no topo do portal, na página <strong>Minhas Candidaturas</strong> e no seu e-mail.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <Headphones className="size-4 text-indigo-600" />
                  <span>4. Atendimento Humano Confidencial (🔒)</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  Para falar individualmente com um recrutador, acesse a aba <strong>Fila RH</strong> e retire uma senha. Quando chamado para o Balcão 1, 2 ou 3, sua conversa é protegida por cadeado privado.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 text-xs text-slate-700 space-y-1">
              <p className="font-bold text-slate-900">
                Diferença entre Mensagem na Sala e Conversa Privada:
              </p>
              <p className="text-[11px] leading-relaxed">
                • <strong>Enviar na Sala (barra abaixo do mapa):</strong> exibe um balão temporário visível para todos no ambiente. Ideal para cumprimentos e networking.<br />
                • <strong>Aba Privado (🔒):</strong> exclusiva entre você e o recrutador no balcão de atendimento. Nenhuma outra pessoa tem acesso ao texto.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowFullGuideModal(false);
                  setSideTab("vagas");
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50"
              >
                Ver Mural de Vagas
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowFullGuideModal(false);
                  setSideTab("bots");
                }}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                Entendi, continuar na sala →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL DE CREDENCIAL DE ACESSO & AVATAR CORPORATIVO ─── */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleEnterSpace}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                  Credencial de Acesso
                </span>
                <h2 className="mt-1 text-base font-bold text-slate-900">
                  Centro de Carreiras & Suporte ao Vivo · {companyName}
                </h2>
                <p className="text-xs text-slate-500">
                  {spaceState.viewerRole === "STAFF"
                    ? "Acesso como Equipe RH / Administração."
                    : spaceState.viewerRole === "CANDIDATE"
                      ? "Conectado com seu perfil de candidato cadastrado ✓"
                      : "Identifique-se para acessar o Mural de Vagas, Bots e Atendimento RH."}
                </p>
              </div>
              {me && (
                <button
                  type="button"
                  onClick={() => setShowAvatarModal(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X className="size-5" />
                </button>
              )}
            </div>

            {/* Prévia da Credencial */}
            <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex size-20 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-2xs">
                <PixelAvatarSprite
                  avatar={avatarDraft}
                  kind={spaceState.viewerRole}
                  size={60}
                />
              </div>
              <div className="flex-1 space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  Seu Nome de Identificação na Sala
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={32}
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  placeholder="Ex.: Mariana Silva, Carlos..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-slate-900 focus:outline-none"
                />
                <span className="inline-block rounded bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                  {spaceState.viewerRole === "STAFF"
                    ? "Credencial Equipe RH / Admin"
                    : spaceState.viewerRole === "CANDIDATE"
                      ? "✓ Candidato Autenticado"
                      : "Credencial de Visitante"}
                </span>
              </div>
            </div>

            {/* Personalização do Avatar */}
            <div className="space-y-3 text-xs">
              <div>
                <span className="font-semibold text-slate-700 block mb-1">Tom de pele:</span>
                <div className="flex gap-2">
                  {SKIN_TONES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setAvatarDraft((d) => ({ ...d, skin: color }))}
                      style={{ backgroundColor: color }}
                      className={`size-6 rounded-full border ${
                        avatarDraft.skin === color
                          ? "border-slate-950 scale-110 ring-2 ring-blue-500"
                          : "border-slate-300"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="font-semibold text-slate-700 block mb-1">Cabelo:</span>
                  <div className="flex flex-wrap gap-1">
                    {HAIR_STYLES.map((style) => (
                      <button
                        key={style}
                        type="button"
                        onClick={() => setAvatarDraft((d) => ({ ...d, hair: style }))}
                        className={`rounded-md border px-2 py-1 text-[11px] font-semibold capitalize ${
                          avatarDraft.hair === style
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-slate-50 text-slate-700"
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="font-semibold text-slate-700 block mb-1">Acessório:</span>
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
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-slate-50 text-slate-700"
                        }`}
                      >
                        {acc === "none" && "Nenhum"}
                        {acc === "headset" && "🎧 Headset"}
                        {acc === "glasses" && "👓 Óculos"}
                        {acc === "cap" && "🧢 Boné"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <span className="font-semibold text-slate-700 block mb-1">Cor Cabelo:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {HAIR_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setAvatarDraft((d) => ({ ...d, hairColor: c }))}
                        style={{ backgroundColor: c }}
                        className={`size-5 rounded-full border ${
                          avatarDraft.hairColor === c
                            ? "ring-2 ring-slate-900 scale-110"
                            : "border-slate-300"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <span className="font-semibold text-slate-700 block mb-1">Traje Superior:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {SHIRT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setAvatarDraft((d) => ({ ...d, shirt: c }))}
                        style={{ backgroundColor: c }}
                        className={`size-5 rounded-full border ${
                          avatarDraft.shirt === c
                            ? "ring-2 ring-slate-900 scale-110"
                            : "border-slate-300"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <span className="font-semibold text-slate-700 block mb-1">Traje Inferior:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {PANTS_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setAvatarDraft((d) => ({ ...d, pants: c }))}
                        style={{ backgroundColor: c }}
                        className={`size-5 rounded-full border ${
                          avatarDraft.pants === c
                            ? "ring-2 ring-slate-900 scale-110"
                            : "border-slate-300"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Termo de Conduta Profissional */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
              <p className="text-xs font-bold text-slate-900">
                Código de Conduta e Privacidade no Ambiente
              </p>
              <ul className="space-y-1 text-[11px] text-slate-600 list-disc pl-4">
                {HOUSE_RULES.map((rule, idx) => (
                  <li key={idx}>{rule}</li>
                ))}
              </ul>
              <label className="mt-2 flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rulesAccepted}
                  onChange={(e) => setRulesAccepted(e.target.checked)}
                  className="size-4 rounded border-slate-400 accent-slate-900"
                />
                <span className="text-xs font-semibold text-slate-900">
                  Concordo com as diretrizes de conduta profissional e privacidade
                </span>
              </label>
            </div>

            {entryError && (
              <p className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs font-semibold text-rose-700">
                {entryError}
              </p>
            )}

            <button
              type="submit"
              disabled={entering || !rulesAccepted}
              className="w-full rounded-xl bg-slate-900 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
            >
              {entering ? "Acessando ambiente..." : "Confirmar Credencial e Acessar Sala →"}
            </button>
          </form>
        </div>
      )}

      {/* ─── MODAL DO SIMULADO DE ENTREVISTA & BOAS PRÁTICAS ─── */}
      {showArcadeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Simulado Rápido · Preparação para Processos Seletivos
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowArcadeModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="size-5" />
              </button>
            </div>

            {(() => {
              const q = CAREER_ARCADE_QUIZ[quizIndex];
              if (!q) return null;
              return (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-500">
                    Questão {quizIndex + 1} de {CAREER_ARCADE_QUIZ.length} · Pontuação:{" "}
                    <span className="font-bold text-blue-700">{quizScore} pts</span>
                  </p>
                  <p className="text-sm font-bold text-slate-900">{q.question}</p>

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
                              ? "border-slate-200 bg-slate-50 hover:border-blue-500 hover:bg-blue-50/40"
                              : isCorrect
                                ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                                : chosen
                                  ? "border-rose-400 bg-rose-50 text-rose-900"
                                  : "border-slate-200 bg-slate-50 opacity-60"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>

                  {quizSelected !== null && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950 space-y-2">
                      <p>💡 {q.tip}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setQuizSelected(null);
                          setQuizIndex((i) => (i + 1) % CAREER_ARCADE_QUIZ.length);
                        }}
                        className="w-full rounded-lg bg-slate-900 py-2 text-xs font-bold text-white"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form
            onSubmit={handleReportSubmit}
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-rose-800">
                🚩 Reportar conduta de {reportModalUser.displayName}
              </h4>
              <button
                type="button"
                onClick={() => setReportModalUser(null)}
                className="text-slate-400 hover:text-slate-700"
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
              placeholder="Descreva brevemente a ocorrência para a equipe de RH..."
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs"
            />
            <button
              type="submit"
              disabled={busyAction}
              className="w-full rounded-xl bg-rose-600 py-2 text-xs font-bold text-white hover:bg-rose-700"
            >
              Enviar à Moderação do RH
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
