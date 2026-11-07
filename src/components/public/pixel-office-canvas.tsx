"use client";

import React, { useState } from "react";
import {
  SUPPORT_ASSISTANT_BOTS,
  SUPPORT_DESK_POSITIONS,
  SUPPORT_ROOMS,
  type ActivePrivatePairDTO,
  type AssistantBotId,
  type AvatarConfig,
  type SupportRoomId,
} from "@/server/models/support.model";
import { MapAvatarNode } from "./pixel-avatar";

export interface MapPresenceUser {
  participantId: string;
  displayName: string;
  kind: "GUEST" | "CANDIDATE" | "STAFF";
  avatar: AvatarConfig;
  x: number;
  y: number;
  room: SupportRoomId;
}

export interface PublicBubbleItem {
  id: string;
  participantId: string;
  displayName: string;
  kind: "GUEST" | "CANDIDATE" | "STAFF";
  text: string;
  room: SupportRoomId;
  expiresAt: number;
}

export interface ReactionFloatingItem {
  participantId: string;
  emoji: string;
  expiresAt: number;
}

interface PixelOfficeCanvasProps {
  meId: string;
  users: MapPresenceUser[];
  bubbles: PublicBubbleItem[];
  reactions: ReactionFloatingItem[];
  activePrivatePairs: ActivePrivatePairDTO[];
  queueCount: number;
  openJobCount: number;
  activeBotId?: AssistantBotId;
  onMoveTo: (x: number, y: number) => void;
  onSelectUser: (user: MapPresenceUser) => void;
  onOpenArcadeQuiz: () => void;
  onOpenQueuePanel: () => void;
  onOpenJobBoard: () => void;
  onOpenGuidesPanel: () => void;
  onSelectBot: (botId: AssistantBotId) => void;
}

/**
 * Planta Isométrica Limpa (Nível Michelin):
 * Sem botões gigantes sobrepostos. Apenas indicadores discretos nas zonas,
 * os 3 Bots Assistentes bem espaçados e os participantes em tempo real.
 */
export function PixelOfficeCanvas({
  meId,
  users,
  bubbles,
  reactions,
  activePrivatePairs,
  queueCount,
  openJobCount,
  activeBotId,
  onMoveTo,
  onSelectUser,
  onOpenArcadeQuiz,
  onOpenQueuePanel,
  onOpenJobBoard,
  onOpenGuidesPanel,
  onSelectBot,
}: PixelOfficeCanvasProps) {
  const [clickRipple, setClickRipple] = useState<{ x: number; y: number; id: number } | null>(
    null
  );

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(92, Math.max(8, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(90, Math.max(16, ((e.clientY - rect.top) / rect.height) * 100));
    const rx = Math.round(x * 10) / 10;
    const ry = Math.round(y * 10) / 10;
    setClickRipple({ x: rx, y: ry, id: Date.now() });
    onMoveTo(rx, ry);
  };

  // Mapa rápido de quem está em conversa privada para mostrar o cadeado 🔒
  const privatePartnerByParticipant = new Map<string, string>();
  const occupiedDesks = new Map<number, string>();
  for (const pair of activePrivatePairs) {
    if (pair.requesterId && pair.responderId) {
      privatePartnerByParticipant.set(
        pair.requesterId,
        pair.responderName || "Atendimento"
      );
      privatePartnerByParticipant.set(
        pair.responderId,
        pair.requesterName || "Candidato"
      );
    }
    if (pair.desk) {
      occupiedDesks.set(pair.desk, pair.requesterName || "Em atendimento");
    }
  }

  return (
    <div
      onClick={handleCanvasClick}
      className="relative aspect-[16/10] min-h-[420px] w-full cursor-pointer select-none overflow-hidden rounded-2xl border border-stone-200/90 bg-slate-950 shadow-sm"
    >
      {/* ─── CENÁRIO ISOMÉTRICO DO ESCRITÓRIO ─── */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/virtual-office-isometric.jpg"
        alt="Planta Interativa do Centro de Carreiras & Suporte ao Vivo"
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover [image-rendering:pixelated]"
      />

      {/* Vinheta suave apenas nas extremidades */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, transparent 65%, rgba(15,23,42,0.45) 100%)",
        }}
      />

      {/* ─── LINHAS CONECTANDO DUPLAS EM ATENDIMENTO PRIVADO 🔒 ─── */}
      <svg
        viewBox="0 0 1000 625"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full z-10"
        aria-hidden
      >
        {activePrivatePairs.map((pair) => {
          const u1 = users.find((u) => u.participantId === pair.requesterId);
          const u2 = users.find((u) => u.participantId === pair.responderId);
          if (!u1 || !u2) return null;
          return (
            <g key={pair.conversationId}>
              <line
                x1={u1.x * 10}
                y1={u1.y * 6.25 - 16}
                x2={u2.x * 10}
                y2={u2.y * 6.25 - 16}
                stroke="#0f172a"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <line
                x1={u1.x * 10}
                y1={u1.y * 6.25 - 16}
                x2={u2.x * 10}
                y2={u2.y * 6.25 - 16}
                stroke="#38bdf8"
                strokeWidth="2.5"
                strokeDasharray="8 6"
                strokeLinecap="round"
              />
            </g>
          );
        })}
      </svg>

      {/* Marcador de destino no piso quando clica para caminhar */}
      {clickRipple && (
        <span
          key={clickRipple.id}
          style={{ left: `${clickRipple.x}%`, top: `${clickRipple.y}%` }}
          className="pointer-events-none absolute z-10 h-3.5 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white/30 animate-ping"
        />
      )}

      {/* ─── INDICADORES COMPACTOS DOS 3 BALCÕES DE RH (SEM SOBREPOSIÇÃO) ─── */}
      {[1, 2, 3].map((deskNum) => {
        const pos = SUPPORT_DESK_POSITIONS[deskNum];
        const occupiedBy = occupiedDesks.get(deskNum);
        return (
          <button
            key={deskNum}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveTo(pos.candidate.x, pos.candidate.y);
              onOpenQueuePanel();
            }}
            style={{ left: `${pos.staff.x}%`, top: `${pos.staff.y - 5}%` }}
            className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold shadow-xs transition hover:scale-105 ${
              occupiedBy
                ? "border-amber-300 bg-amber-400 text-slate-950"
                : "border-white/25 bg-slate-900/85 text-white backdrop-blur-xs hover:bg-slate-900"
            }`}
            title={
              occupiedBy
                ? `Balcão ${deskNum}: Em atendimento (${occupiedBy})`
                : `Balcão de Atendimento RH ${deskNum}`
            }
          >
            <span>{occupiedBy ? "🔒" : "🎧"}</span>
            <span>B{deskNum}</span>
          </button>
        );
      })}

      {/* ─── 4 ATALHOS DE CANTO ULTRA-LIMPOS E SEM COLISÃO ─── */}
      {/* Canto Superior Esquerdo: Atendimento RH */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onMoveTo(SUPPORT_ROOMS.atendimento.spawn.x, SUPPORT_ROOMS.atendimento.spawn.y);
          onOpenQueuePanel();
        }}
        className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full border border-white/20 bg-slate-900/85 px-3 py-1 text-[11px] font-medium text-white shadow-sm backdrop-blur-md transition hover:bg-slate-900"
      >
        <span>🎧</span>
        <span>Atendimento RH</span>
        {queueCount > 0 && (
          <span className="rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-slate-950">
            {queueCount}
          </span>
        )}
      </button>

      {/* Canto Superior Direito: Mural de Vagas */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenJobBoard();
        }}
        className="absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-full border border-white/20 bg-slate-900/85 px-3 py-1 text-[11px] font-medium text-white shadow-sm backdrop-blur-md transition hover:bg-slate-900"
      >
        <span>💼</span>
        <span>Mural de Vagas</span>
        <span className="rounded-full bg-emerald-400 px-1.5 text-[10px] font-bold text-slate-950">
          {openJobCount}
        </span>
      </button>

      {/* Canto Inferior Esquerdo: Simulado Rápido */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenArcadeQuiz();
        }}
        className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 rounded-full border border-white/20 bg-slate-900/85 px-3 py-1 text-[11px] font-medium text-white shadow-sm backdrop-blur-md transition hover:bg-slate-900"
      >
        <span>🎯</span>
        <span>Simulado de Entrevista</span>
      </button>

      {/* Canto Inferior Direito: Guia de Avisos */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenGuidesPanel();
        }}
        className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 rounded-full border border-white/20 bg-slate-900/85 px-3 py-1 text-[11px] font-medium text-white shadow-sm backdrop-blur-md transition hover:bg-slate-900"
      >
        <span>🔔</span>
        <span>Onde Ver Avisos</span>
      </button>

      {/* ─── BOTS ASSISTENTES ESPECIALISTAS (POSICIONADOS SEM SOBREPOSIÇÃO E SEM BALÃO GIGANTE) ─── */}
      {SUPPORT_ASSISTANT_BOTS.map((bot) => {
        const isSelected = activeBotId === bot.id;
        return (
          <MapAvatarNode
            key={`bot_${bot.id}`}
            id={`bot_${bot.id}`}
            displayName={bot.name}
            kind="STAFF"
            avatar={bot.avatar}
            x={bot.x}
            y={bot.y}
            isAmbientNpc
            isMe={isSelected}
            reactionEmoji="🤖"
            onSelect={() => {
              onMoveTo(Math.min(88, bot.x + 5), Math.min(88, bot.y + 4));
              onSelectBot(bot.id);
            }}
          />
        );
      })}

      {/* ─── PARTICIPANTES ONLINE EM TEMPO REAL ─── */}
      {users.map((u) => {
        const activeBubble = bubbles.find((b) => b.participantId === u.participantId);
        const activeReaction = reactions.find(
          (r) => r.participantId === u.participantId
        );
        const partnerName = privatePartnerByParticipant.get(u.participantId) ?? null;

        return (
          <MapAvatarNode
            key={u.participantId}
            id={u.participantId}
            displayName={u.displayName}
            kind={u.kind}
            avatar={u.avatar}
            x={u.x}
            y={u.y}
            isMe={u.participantId === meId}
            bubbleText={activeBubble?.text ?? null}
            reactionEmoji={activeReaction?.emoji ?? null}
            inPrivateChat={Boolean(partnerName)}
            privatePartnerName={partnerName}
            onSelect={() => onSelectUser(u)}
          />
        );
      })}
    </div>
  );
}
