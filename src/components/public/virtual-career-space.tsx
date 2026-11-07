"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ACCESSORIES,
  CAREER_ARCADE_QUIZ,
  DEFAULT_AVATAR,
  HAIR_COLORS,
  HAIR_STYLES,
  HOUSE_RULES,
  PANTS_COLORS,
  QUICK_REACTIONS,
  SHIRT_COLORS,
  SKIN_TONES,
  SUPPORT_DESK_POSITIONS,
  SUPPORT_ROOMS,
  SUPPORT_ROOM_IDS,
  SUPPORT_TOPICS,
  resolveRoomFromCoords,
  sanitizePublicBubble,
  type AvatarConfig,
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
  Check,
  Flag,
  Gamepad2,
  Headphones,
  Lock,
  Megaphone,
  MessageSquare,
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

export function VirtualCareerSpace({
  companySlug,
  companyName,
  initialState,
  embeddedInGestorPanel = false,
}: VirtualCareerSpaceProps) {
  const [spaceState, setSpaceState] = useState<SupportSpaceStateDTO>(initialState);
  const me = spaceState.me;
  const isStaff = spaceState.viewerRole === "STAFF";

  // Modal de Entrada / Personalização do Bonequinho
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

  // Posição atual do meu bonequinho no mapa (0..100)
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

  // Entrada de balão público
  const [bubbleInput, setBubbleInput] = useState("");
  const [isAnnouncementMode, setIsAnnouncementMode] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Painel lateral direito
  const [sideTab, setSideTab] = useState<"rh" | "privado" | "pessoas">(
    initialState.myActiveConversation ? "privado" : "rh"
  );
  const [selectedTopic, setSelectedTopic] = useState<SupportTopicId>("VAGA");
  const [privateInput, setPrivateInput] = useState("");
  const [busyAction, setBusyAction] = useState(false);

  // Interação ao clicar num bonequinho
  const [selectedUser, setSelectedUser] = useState<MapPresenceUser | null>(null);
  const [reportModalUser, setReportModalUser] = useState<MapPresenceUser | null>(null);
  const [reportReason, setReportReason] = useState("");

  // Modal do Quiz Fliperama (Sala de Jogos)
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
    }, 4000);
  }, []);

  // Recarrega estado do servidor (fila, conversas privadas, mensagens)
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

  // Canal privado de Inbox (Supabase Realtime Authorization) para avisos imediatos
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
        showToast(`🎧 Você foi chamado ao Balcão ${desk}!`);
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

  // Conexão ao canal do mapa da empresa (Presence + Broadcast de balões e movimentos)
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

    // 1. BroadcastChannel local (sincroniza abas no mesmo navegador instantaneamente)
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      const bc = new BroadcastChannel(`triagem_espaco_sync_${companySlug}`);
      localBcRef.current = bc;
      bc.onmessage = (ev) => {
        if (ev.data?.type) {
          handleIncomingEvent(ev.data.type, ev.data.payload);
        }
      };
    }

    // 2. Supabase Realtime (Presence + Broadcast entre dispositivos)
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

  // Movimenta o bonequinho pelo mapa e sincroniza com todos na sala
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
    if (!me || showAvatarModal) return;
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
  }, [me, moveAvatarTo, myCoords.x, myCoords.y, showAvatarModal]);

  // Salvar entrada / personalização do avatar
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
      showToast("✨ Bem-vindo ao Espaço de Carreiras ao Vivo!");
    } catch (err: any) {
      setEntryError(err?.message || "Não foi possível entrar no espaço.");
    } finally {
      setEntering(false);
    }
  };

  // Enviar balão público (nuvem na tela) ou aviso da equipe
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
      showToast("🎫 Senha retirada! Aguarde ser chamado ao balcão.");
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

  // Convidar candidato para conversa privada
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
      showToast(`🔒 Convite enviado para ${targetUser.displayName}!`);
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
      showToast("Conversa privada encerrada.");
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
      showToast("🛡️ Denúncia enviada à equipe de moderação. Obrigado!");
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
      showToast("Ação de moderação aplicada.");
    } catch (err: any) {
      showToast(err?.message || "Erro ao moderar participante.");
    } finally {
      setBusyAction(false);
    }
  };

  // Lista unificada de bonequinhos no mapa (eu + remotos)
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

  return (
    <div className="space-y-4">
      {/* ─── TOAST DE AVISO RÁPIDO ─── */}
      {feedbackToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl border-2 border-stone-900 bg-amber-300 px-4 py-2 text-xs font-extrabold text-stone-950 shadow-[0_4px_0_#18181b] animate-in fade-in slide-in-from-bottom-4">
          {feedbackToast}
        </div>
      )}

      {/* ─── FAIXA DE AVISO OFICIAL DA EQUIPE RH ─── */}
      {staffAnnouncement && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-amber-500 bg-amber-50 px-4 py-2.5 text-xs text-amber-950 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
              <Megaphone className="size-4" />
            </span>
            <div>
              <span className="font-extrabold">
                Aviso da Equipe ({staffAnnouncement.author}):{" "}
              </span>
              <span className="font-medium">{staffAnnouncement.text}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStaffAnnouncement(null)}
            className="rounded-lg p-1 text-amber-800 hover:bg-amber-200/60"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* ─── BARRA DE AMBIENTES & TELETRANSPORTE RÁPIDO ─── */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-stone-200 bg-white p-2.5 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {SUPPORT_ROOM_IDS.map((roomId) => {
            const room = SUPPORT_ROOMS[roomId];
            const active = currentRoom === roomId;
            return (
              <button
                key={roomId}
                type="button"
                onClick={() => moveAvatarTo(room.spawn.x, room.spawn.y)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? "bg-stone-900 text-white shadow-xs"
                    : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                }`}
              >
                <span>{room.icon}</span>
                <span>{room.shortName}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800">
            <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
            {allUsersOnMap.length}{" "}
            {allUsersOnMap.length === 1 ? "pessoa na sala" : "pessoas na sala"}
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
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-bold text-stone-800 hover:bg-stone-100"
          >
            <Sparkles className="size-3.5 text-amber-600" />
            <span>Meu Boneco</span>
          </button>
        </div>
      </div>

      {/* ─── GRID PRINCIPAL: MAPA PIXEL-ART (ESQUERDA) + CENTRAL DE SUPORTE & CHAT (DIREITA) ─── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* COLUNA DO MAPA (8 colunas) */}
        <div className="lg:col-span-8 space-y-3">
          <PixelOfficeCanvas
            meId={me?.id || ""}
            users={allUsersOnMap}
            bubbles={publicBubbles}
            reactions={reactions}
            activePrivatePairs={spaceState.activePrivatePairs}
            queueCount={spaceState.queueCount}
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
          />

          {/* Barra Inferior: Enviar Balão de Nuvem Pública + Reações Rápidas */}
          <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-xs space-y-2.5">
            <form onSubmit={handleSendPublicBubble} className="flex flex-wrap items-center gap-2">
              {isStaff && (
                <button
                  type="button"
                  onClick={() => setIsAnnouncementMode((v) => !v)}
                  className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-2 text-xs font-bold transition ${
                    isAnnouncementMode
                      ? "border-amber-500 bg-amber-500 text-white"
                      : "border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100"
                  }`}
                  title="Alternar entre balão normal e Aviso Oficial no topo"
                >
                  <Megaphone className="size-3.5" />
                  <span>Aviso RH</span>
                </button>
              )}

              <input
                type="text"
                value={bubbleInput}
                onChange={(e) => setBubbleInput(e.target.value)}
                maxLength={140}
                placeholder={
                  isAnnouncementMode
                    ? "Digite um aviso oficial para todos no espaço..."
                    : `Falar em ${SUPPORT_ROOMS[currentRoom].shortName} (aparece como nuvem sobre seu boneco)...`
                }
                className="min-w-[200px] flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs font-medium text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:bg-white focus:outline-none"
              />

              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-stone-800"
              >
                <Send className="size-3.5" />
                <span>Mandar Balão</span>
              </button>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-100">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-semibold text-stone-400 mr-1">
                  Reações:
                </span>
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSendQuickReaction(emoji)}
                    className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-sm transition hover:scale-110 hover:bg-amber-50"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <span className="text-[11px] text-stone-400">
                💡 Clique no chão ou use as setas do teclado para caminhar · Comunicação respeitosa
              </span>
            </div>
          </div>

          {/* Card de Inspeção quando clica em um Bonequinho no Mapa */}
          {selectedUser && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-stone-900 bg-white p-3.5 shadow-md animate-in fade-in">
              <div className="flex items-center gap-3">
                <PixelAvatarSprite
                  avatar={selectedUser.avatar}
                  kind={selectedUser.kind}
                  size={40}
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-extrabold text-stone-900">
                      {selectedUser.displayName}
                    </span>
                    <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-700">
                      {selectedUser.kind === "STAFF"
                        ? "👑 Equipe RH"
                        : selectedUser.kind === "CANDIDATE"
                          ? "✓ Candidato Cadastrado"
                          : "Visitante Anônimo"}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500">
                    Na sala: {SUPPORT_ROOMS[selectedUser.room].name}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {me && selectedUser.participantId !== me.id && (
                  <>
                    {/* Conversa privada entre candidatos (apenas se não for visitante anônimo) */}
                    {me.kind !== "GUEST" &&
                      (selectedUser.kind !== "GUEST" || isStaff) && (
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={() => handleRequestDm(selectedUser)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-stone-800"
                        >
                          <Lock className="size-3.5 text-amber-400" />
                          <span>Chamar no Privado</span>
                        </button>
                      )}

                    <button
                      type="button"
                      onClick={() => setReportModalUser(selectedUser)}
                      className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                    >
                      <Flag className="size-3.5" />
                      <span>Denunciar</span>
                    </button>

                    {isStaff && selectedUser.kind !== "STAFF" && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            handleModerate(selectedUser.participantId, "mute")
                          }
                          className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100"
                        >
                          <VolumeX className="size-3.5" />
                          <span>Silenciar 10m</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleModerate(selectedUser.participantId, "ban")
                          }
                          className="inline-flex items-center gap-1 rounded-xl border border-red-300 bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-red-700"
                        >
                          <Ban className="size-3.5" />
                          <span>Banir</span>
                        </button>
                      </>
                    )}
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* COLUNA DIREITA: FILA DE ATENDIMENTO RH, CONVERSA PRIVADA 🔒 E PESSOAS (4 colunas) */}
        <div className="lg:col-span-4 flex flex-col rounded-2xl border border-stone-200 bg-white shadow-xs overflow-hidden">
          {/* Abas do Painel Direito */}
          <div className="grid grid-cols-3 border-b border-stone-200 bg-stone-50 p-1.5 gap-1">
            <button
              type="button"
              onClick={() => setSideTab("rh")}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
                sideTab === "rh"
                  ? "bg-white text-stone-900 shadow-xs"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              <Headphones className="size-3.5" />
              <span>Fila RH ({spaceState.queueCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setSideTab("privado")}
              className={`relative flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
                sideTab === "privado"
                  ? "bg-white text-stone-900 shadow-xs"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              <Lock className="size-3.5 text-amber-600" />
              <span>Privado</span>
              {(spaceState.myActiveConversation ||
                spaceState.myIncomingDmRequests.length > 0) && (
                <span className="size-2 rounded-full bg-amber-500 animate-ping" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setSideTab("pessoas")}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
                sideTab === "pessoas"
                  ? "bg-white text-stone-900 shadow-xs"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              <Users className="size-3.5" />
              <span>Sala ({allUsersOnMap.length})</span>
            </button>
          </div>

          {/* CONTEÚDO DA ABA 1: FILA DE ATENDIMENTO RH */}
          {sideTab === "rh" && (
            <div className="flex-1 p-4 space-y-4 overflow-y-auto max-h-[540px]">
              {isStaff ? (
                <>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                    <h3 className="text-xs font-extrabold text-amber-950">
                      🎧 Central do Atendente ({companyName})
                    </h3>
                    <p className="mt-0.5 text-[11px] text-amber-900">
                      Chame o próximo candidato da fila para um dos 3 balcões. A conversa abre no modo privado 🔒.
                    </p>
                  </div>

                  {/* Lista da Fila de Espera para o Gestor / Admin */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-stone-700">
                      Aguardando na Recepção ({spaceState.staffQueue.length})
                    </h4>

                    {spaceState.staffQueue.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-stone-200 p-6 text-center text-xs text-stone-400">
                        Nenhuma senha aguardando atendimento neste momento.
                      </div>
                    ) : (
                      spaceState.staffQueue.map((ticket) => (
                        <div
                          key={ticket.id}
                          className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="rounded-lg bg-amber-400 px-2 py-0.5 text-xs font-black text-stone-950">
                                #{ticket.queueNumber}
                              </span>
                              <div>
                                <p className="text-xs font-bold text-stone-900">
                                  {ticket.requester.displayName}
                                </p>
                                <p className="text-[10px] text-stone-500">
                                  Assunto: {ticket.topic} ·{" "}
                                  {ticket.requester.kind === "CANDIDATE"
                                    ? "Cadastrado ✓"
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
                                className="rounded-lg bg-stone-900 py-1.5 text-[11px] font-bold text-white hover:bg-stone-800 disabled:opacity-50"
                              >
                                Chamar B{deskNum}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Atendimentos em andamento nos balcões */}
                  {spaceState.staffActiveDesks.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-stone-100">
                      <h4 className="text-xs font-bold text-emerald-800">
                        Em Atendimento nos Balcões ({spaceState.staffActiveDesks.length})
                      </h4>
                      {spaceState.staffActiveDesks.map((active) => (
                        <div
                          key={active.id}
                          className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 text-xs"
                        >
                          <div>
                            <span className="font-extrabold text-emerald-950">
                              Balcão {active.desk || 1}: {active.requester.displayName}
                            </span>
                            <span className="block text-[10px] text-emerald-700">
                              Atendente: {active.responder?.displayName || "RH"}
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
                  <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3">
                    <h3 className="text-xs font-extrabold text-sky-950">
                      🎧 Atendimento Individual com o RH
                    </h3>
                    <p className="mt-0.5 text-[11px] text-sky-900">
                      Retire uma senha gratuita. Enquanto aguarda na Recepção, você pode passear pelo Café ou jogar no Fliperama!
                    </p>
                  </div>

                  {spaceState.myActiveConversation?.kind === "SERVICE" ? (
                    <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-4 text-center space-y-2">
                      <span className="inline-block rounded-full bg-emerald-600 px-3 py-0.5 text-[11px] font-bold text-white">
                        Em Atendimento no Balcão {spaceState.myActiveConversation.desk || 1}
                      </span>
                      <p className="text-xs font-bold text-emerald-950">
                        Você está conversando no privado com{" "}
                        {spaceState.myActiveConversation.responder?.displayName ||
                          "Equipe RH"}
                      </p>
                      <button
                        type="button"
                        onClick={() => setSideTab("privado")}
                        className="w-full rounded-xl bg-emerald-700 py-2 text-xs font-bold text-white hover:bg-emerald-800"
                      >
                        Ir para a Conversa Privada 🔒
                      </button>
                    </div>
                  ) : spaceState.myWaitingTicket ? (
                    <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 text-center space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                        Sua Senha na Recepção
                      </p>
                      <p className="text-3xl font-black text-stone-900">
                        #{spaceState.myWaitingTicket.queueNumber}
                      </p>
                      <p className="text-xs font-semibold text-amber-900">
                        Posição na fila: {spaceState.myPositionInQueue}º · Assunto:{" "}
                        {spaceState.myWaitingTicket.topic}
                      </p>
                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={() =>
                          handleCloseConversation(spaceState.myWaitingTicket!.id)
                        }
                        className="mt-2 text-[11px] font-bold text-rose-700 underline hover:text-rose-900"
                      >
                        Sair da fila de espera
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <label className="block text-xs font-bold text-stone-700">
                        Qual é o assunto da sua dúvida?
                      </label>
                      <div className="space-y-1.5">
                        {SUPPORT_TOPICS.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setSelectedTopic(t.id)}
                            className={`flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left text-xs font-semibold transition ${
                              selectedTopic === t.id
                                ? "border-stone-900 bg-amber-50 text-stone-900"
                                : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
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
                        className="w-full rounded-xl bg-stone-900 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-stone-800 disabled:opacity-50"
                      >
                        🛋️ Retirar Senha de Atendimento
                      </button>
                    </div>
                  )}

                  {/* Feed recente de balões públicos da sala */}
                  <div className="pt-3 border-t border-stone-100 space-y-2">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                      Últimos Balões na Sala
                    </h4>
                    {publicFeed.length === 0 ? (
                      <p className="text-xs text-stone-400">
                        Mande um balão abaixo para puxar conversa!
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {publicFeed.slice(-8).map((b) => (
                          <div
                            key={b.id}
                            className="rounded-lg bg-stone-50 px-2.5 py-1.5 text-xs"
                          >
                            <span className="font-bold text-stone-900">
                              {b.displayName}:{" "}
                            </span>
                            <span className="text-stone-700">{b.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* CONTEÚDO DA ABA 2: CONVERSA PRIVADA 🔒 */}
          {sideTab === "privado" && (
            <div className="flex flex-1 flex-col p-4 max-h-[540px]">
              {/* Convites recebidos pendentes */}
              {spaceState.myIncomingDmRequests.length > 0 && (
                <div className="mb-3 space-y-2">
                  {spaceState.myIncomingDmRequests.map((req) => (
                    <div
                      key={req.id}
                      className="rounded-xl border-2 border-amber-400 bg-amber-50 p-3 space-y-2"
                    >
                      <p className="text-xs font-bold text-stone-900">
                        🔒 {req.requester.displayName} convidou você para conversar no privado
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
                          className="flex-1 rounded-lg bg-stone-200 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-300"
                        >
                          Recusar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {spaceState.myActiveConversation ? (
                <>
                  <div className="flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50/80 px-3 py-2 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-stone-900">
                        <Lock className="size-3.5 text-amber-600 shrink-0" />
                        <span className="truncate">
                          {spaceState.myActiveConversation.kind === "SERVICE"
                            ? `Balcão ${spaceState.myActiveConversation.desk || 1} · ${spaceState.myActiveConversation.requester.displayName}`
                            : `Privado · ${spaceState.myActiveConversation.requester.displayName} & ${spaceState.myActiveConversation.responder?.displayName}`}
                        </span>
                      </div>
                      <p className="text-[10px] text-amber-900">
                        Só vocês dois leem este chat. Os demais veem apenas o cadeado 🔒.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleCloseConversation(spaceState.myActiveConversation!.id)
                      }
                      className="shrink-0 rounded-lg border border-rose-200 bg-white px-2 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-50"
                    >
                      Encerrar
                    </button>
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto rounded-xl border border-stone-100 bg-stone-50/60 p-3 min-h-[240px]">
                    {spaceState.activeMessages.length === 0 ? (
                      <p className="text-center text-xs text-stone-400 py-8">
                        Inicie a conversa privada abaixo.
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
                            <span className="text-[10px] font-bold text-stone-400 mb-0.5">
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
                    className="mt-3 flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={privateInput}
                      onChange={(e) => setPrivateInput(e.target.value)}
                      maxLength={500}
                      placeholder="Escrever mensagem privada 🔒..."
                      className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-extrabold text-stone-950 hover:bg-amber-400"
                    >
                      Enviar
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center text-center p-6 space-y-2">
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
                    <Lock className="size-5" />
                  </div>
                  <h4 className="text-xs font-bold text-stone-900">
                    Nenhuma conversa privada ativa
                  </h4>
                  <p className="text-[11px] text-stone-500">
                    {spaceState.viewerRole === "GUEST"
                      ? "No modo visitante anônimo, retire uma senha na aba Fila RH para conversar em privado com um recrutador!"
                      : "Clique em um candidato cadastrado no mapa ou retire uma senha na Fila RH para conversar com cadeado privado 🔒."}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* CONTEÚDO DA ABA 3: PESSOAS NA SALA & MODERAÇÃO */}
          {sideTab === "pessoas" && (
            <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[540px]">
              <h4 className="text-xs font-bold text-stone-700">
                Participantes Online ({allUsersOnMap.length})
              </h4>

              <div className="space-y-2">
                {allUsersOnMap.map((u) => (
                  <div
                    key={u.participantId}
                    onClick={() => setSelectedUser(u)}
                    className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50/70 p-2.5 cursor-pointer hover:bg-stone-100"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PixelAvatarSprite avatar={u.avatar} kind={u.kind} size={32} />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-stone-900">
                          {u.displayName} {u.participantId === me?.id && "(Você)"}
                        </p>
                        <p className="text-[10px] text-stone-500">
                          {SUPPORT_ROOMS[u.room].icon} {SUPPORT_ROOMS[u.room].shortName}
                        </p>
                      </div>
                    </div>

                    <span className="rounded-md bg-white border border-stone-200 px-2 py-0.5 text-[10px] font-bold text-stone-700">
                      {u.kind === "STAFF"
                        ? "👑 RH"
                        : u.kind === "CANDIDATE"
                          ? "✓ Cadastrado"
                          : "Visitante"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Denúncias abertas (visível apenas para Equipe RH / Admin) */}
              {isStaff && spaceState.staffOpenReports.length > 0 && (
                <div className="pt-3 border-t border-stone-200 space-y-2">
                  <h4 className="flex items-center gap-1.5 text-xs font-extrabold text-rose-800">
                    <ShieldAlert className="size-4" />
                    <span>Denúncias Pendentes ({spaceState.staffOpenReports.length})</span>
                  </h4>
                  {spaceState.staffOpenReports.map((rep) => (
                    <div
                      key={rep.id}
                      className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs space-y-1.5"
                    >
                      <p className="font-bold text-rose-950">
                        Alvo: {rep.targetName}{" "}
                        <span className="font-normal text-rose-700">
                          (por {rep.reporterName})
                        </span>
                      </p>
                      <p className="text-[11px] text-rose-900">Motivo: {rep.reason}</p>
                      {rep.excerpt && (
                        <p className="rounded bg-white/80 p-1.5 text-[10px] italic text-stone-700">
                          Balão: "{rep.excerpt}"
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
                          Banir
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const next = await resolveReportAction(companySlug, rep.id);
                            setSpaceState(next);
                          }}
                          className="ml-auto rounded bg-stone-800 px-2 py-1 text-[10px] font-bold text-white"
                        >
                          Concluir
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

      {/* ─── MODAL DE ENTRADA & PERSONALIZAÇÃO DO BONEQUINHO PIXEL-ART ─── */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleEnterSpace}
            className="w-full max-w-lg rounded-3xl border-4 border-stone-900 bg-white p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-stone-900">
                  🎮 Entrar no Espaço de Carreiras · {companyName}
                </h2>
                <p className="text-xs text-stone-500">
                  {spaceState.viewerRole === "STAFF"
                    ? "Você está entrando como Equipe RH / Admin com ferramentas de atendimento."
                    : spaceState.viewerRole === "CANDIDATE"
                      ? "Você está conectado com seu cadastro de candidato ✓"
                      : "Entre como visitante anônimo ou faça login para recursos extras."}
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

            {/* Prévia ao vivo do Bonequinho */}
            <div className="flex items-center gap-5 rounded-2xl border-2 border-stone-900 bg-[#f6d399] p-4">
              <div className="flex size-24 shrink-0 items-center justify-center rounded-2xl border-2 border-stone-900 bg-white/90 shadow-inner">
                <PixelAvatarSprite
                  avatar={avatarDraft}
                  kind={spaceState.viewerRole}
                  size={68}
                />
              </div>
              <div className="flex-1 space-y-2">
                <label className="block text-xs font-extrabold text-stone-900">
                  Seu Nome ou Apelido na Sala
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={32}
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  placeholder="Ex.: Vanessa, Lucas, Visitante..."
                  className="w-full rounded-xl border-2 border-stone-900 bg-white px-3 py-2 text-xs font-bold text-stone-900 focus:outline-none"
                />
                <span className="inline-block rounded-md bg-stone-900 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                  {spaceState.viewerRole === "STAFF"
                    ? "👑 Selo Equipe RH / Admin"
                    : spaceState.viewerRole === "CANDIDATE"
                      ? "✓ Selo Candidato Cadastrado"
                      : "Modo Visitante Anônimo"}
                </span>
              </div>
            </div>

            {/* Customizador de Camadas Pixel-Art */}
            <div className="space-y-3 text-xs">
              <div>
                <span className="font-bold text-stone-700 block mb-1">Tom de pele:</span>
                <div className="flex gap-2">
                  {SKIN_TONES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setAvatarDraft((d) => ({ ...d, skin: color }))}
                      style={{ backgroundColor: color }}
                      className={`size-7 rounded-full border-2 ${
                        avatarDraft.skin === color
                          ? "border-stone-950 scale-110 ring-2 ring-amber-400"
                          : "border-stone-300"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="font-bold text-stone-700 block mb-1">Cabelo:</span>
                  <div className="flex flex-wrap gap-1">
                    {HAIR_STYLES.map((style) => (
                      <button
                        key={style}
                        type="button"
                        onClick={() => setAvatarDraft((d) => ({ ...d, hair: style }))}
                        className={`rounded-lg border px-2 py-1 text-[11px] font-bold capitalize ${
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
                  <span className="font-bold text-stone-700 block mb-1">Acessório:</span>
                  <div className="flex flex-wrap gap-1">
                    {ACCESSORIES.map((acc) => (
                      <button
                        key={acc}
                        type="button"
                        onClick={() =>
                          setAvatarDraft((d) => ({ ...d, accessory: acc }))
                        }
                        className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${
                          avatarDraft.accessory === acc
                            ? "border-stone-900 bg-stone-900 text-white"
                            : "border-stone-200 bg-stone-50 text-stone-700"
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
                  <span className="font-bold text-stone-700 block mb-1">Cor Cabelo:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {HAIR_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setAvatarDraft((d) => ({ ...d, hairColor: c }))}
                        style={{ backgroundColor: c }}
                        className={`size-5 rounded-full border ${
                          avatarDraft.hairColor === c
                            ? "ring-2 ring-stone-900 scale-110"
                            : "border-stone-300"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <span className="font-bold text-stone-700 block mb-1">Camisa:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {SHIRT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setAvatarDraft((d) => ({ ...d, shirt: c }))}
                        style={{ backgroundColor: c }}
                        className={`size-5 rounded-full border ${
                          avatarDraft.shirt === c
                            ? "ring-2 ring-stone-900 scale-110"
                            : "border-stone-300"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <span className="font-bold text-stone-700 block mb-1">Calça:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {PANTS_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setAvatarDraft((d) => ({ ...d, pants: c }))}
                        style={{ backgroundColor: c }}
                        className={`size-5 rounded-full border ${
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

            {/* Pacto de Convivência Respeitosa */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 space-y-2">
              <p className="text-xs font-extrabold text-amber-950">
                🤝 Pacto de Comunicação Respeitosa
              </p>
              <ul className="space-y-1 text-[11px] text-amber-900 list-disc pl-4">
                {HOUSE_RULES.map((rule, idx) => (
                  <li key={idx}>{rule}</li>
                ))}
              </ul>
              <label className="mt-2 flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rulesAccepted}
                  onChange={(e) => setRulesAccepted(e.target.checked)}
                  className="size-4 rounded border-stone-400 accent-stone-900"
                />
                <span className="text-xs font-bold text-stone-900">
                  Concordo em manter uma comunicação respeitosa e cordial
                </span>
              </label>
            </div>

            {entryError && (
              <p className="rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs font-bold text-rose-700">
                {entryError}
              </p>
            )}

            <button
              type="submit"
              disabled={entering || !rulesAccepted}
              className="w-full rounded-2xl border-2 border-stone-900 bg-amber-400 py-3 text-xs font-black uppercase tracking-wider text-stone-950 shadow-[0_4px_0_#18181b] transition hover:bg-amber-300 disabled:opacity-50"
            >
              {entering ? "Entrando na sala..." : "Entrar no Espaço Ao Vivo →"}
            </button>
          </form>
        </div>
      )}

      {/* ─── MODAL DO FLIPERAMA (QUIZ DE CARREIRA NA SALA DE JOGOS) ─── */}
      {showArcadeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border-4 border-stone-900 bg-[#1e1b4b] p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gamepad2 className="size-5 text-amber-400" />
                <h3 className="text-sm font-black uppercase tracking-wider text-amber-300">
                  Arcade Carreira · Desafio Rápido
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowArcadeModal(false)}
                className="rounded-lg p-1 text-indigo-300 hover:bg-indigo-900"
              >
                <X className="size-5" />
              </button>
            </div>

            {(() => {
              const q = CAREER_ARCADE_QUIZ[quizIndex];
              if (!q) return null;
              return (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-indigo-200">
                    Pergunta {quizIndex + 1} de {CAREER_ARCADE_QUIZ.length} · Pontos:{" "}
                    <span className="text-amber-300">{quizScore}</span>
                  </p>
                  <p className="text-sm font-extrabold text-white">{q.question}</p>

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
                          className={`w-full rounded-xl border-2 p-3 text-left text-xs font-bold transition ${
                            quizSelected === null
                              ? "border-indigo-700 bg-indigo-950/80 hover:border-amber-400"
                              : isCorrect
                                ? "border-emerald-400 bg-emerald-950 text-emerald-200"
                                : chosen
                                  ? "border-rose-400 bg-rose-950 text-rose-200"
                                  : "border-indigo-900 bg-indigo-950/40 opacity-60"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>

                  {quizSelected !== null && (
                    <div className="rounded-xl border border-amber-400/50 bg-indigo-950 p-3 text-xs text-amber-200 space-y-2">
                      <p>💡 {q.tip}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setQuizSelected(null);
                          setQuizIndex((i) => (i + 1) % CAREER_ARCADE_QUIZ.length);
                        }}
                        className="w-full rounded-lg bg-amber-400 py-2 text-xs font-black text-stone-950"
                      >
                        Próximo Desafio →
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ─── MODAL DE DENÚNCIA DE COMPORTAMENTO ─── */}
      {reportModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleReportSubmit}
            className="w-full max-w-sm rounded-2xl border-2 border-stone-900 bg-white p-5 shadow-xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold text-rose-800">
                🚩 Reportar comportamento de {reportModalUser.displayName}
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
              placeholder="Descreva o que aconteceu para a equipe de moderação..."
              className="w-full rounded-xl border border-stone-200 p-2.5 text-xs"
            />
            <button
              type="submit"
              disabled={busyAction}
              className="w-full rounded-xl bg-rose-600 py-2 text-xs font-bold text-white hover:bg-rose-700"
            >
              Enviar Denúncia à Equipe
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
