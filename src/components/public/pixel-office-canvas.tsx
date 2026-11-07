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
  onMoveTo: (x: number, y: number) => void;
  onSelectUser: (user: MapPresenceUser) => void;
  onOpenArcadeQuiz: () => void;
  onOpenQueuePanel: () => void;
  onOpenJobBoard: () => void;
  onOpenGuidesPanel: () => void;
  onSelectBot: (botId: AssistantBotId) => void;
}

/**
 * Mapa Isométrico Corporativo com 5 setores integrados e 3 Bots Assistentes:
 * 1. Sup. Esquerda: Balcões de Atendimento RH (Atendimento Individual 1:1)
 * 2. Centro: Recepção, Mural de Vagas & Totem de Senhas
 * 3. Sup. Direita: Lounge Corporativo & Bots Assistentes 24h
 * 4. Inf. Esquerda: Espaço Preparação & Simulado de Entrevista
 * 5. Inf. Direita: Sala Executiva & Guia de Avisos do Sistema
 */
export function PixelOfficeCanvas({
  meId,
  users,
  bubbles,
  reactions,
  activePrivatePairs,
  queueCount,
  openJobCount,
  onMoveTo,
  onSelectUser,
  onOpenArcadeQuiz,
  onOpenQueuePanel,
  onOpenJobBoard,
  onOpenGuidesPanel,
  onSelectBot,
}: PixelOfficeCanvasProps) {
  const [activeBotTip, setActiveBotTip] = useState<AssistantBotId | null>("vagas");
  const [clickRipple, setClickRipple] = useState<{ x: number; y: number; id: number } | null>(
    null
  );

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(93, Math.max(7, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(92, Math.max(12, ((e.clientY - rect.top) / rect.height) * 100));
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
      className="relative aspect-[16/9] min-h-[450px] w-full cursor-pointer select-none overflow-hidden rounded-2xl border border-slate-300 bg-slate-950 shadow-lg"
    >
      {/* ─── CENÁRIO ISOMÉTRICO DO ESCRITÓRIO CORPORATIVO ─── */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/virtual-office-isometric.jpg"
        alt="Planta Interativa do Centro de Carreiras & Suporte ao Vivo"
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover [image-rendering:pixelated]"
      />

      {/* Vinheta corporativa sutil nas bordas para leitura limpa do HUD */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(15,23,42,0.04) 55%, rgba(15,23,42,0.58) 100%)",
        }}
      />

      {/* ─── LINHAS CONECTANDO DUPLAS EM ATENDIMENTO PRIVADO 🔒 ─── */}
      <svg
        viewBox="0 0 1000 562.5"
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
                y1={u1.y * 5.625 - 16}
                x2={u2.x * 10}
                y2={u2.y * 5.625 - 16}
                stroke="#0f172a"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <line
                x1={u1.x * 10}
                y1={u1.y * 5.625 - 16}
                x2={u2.x * 10}
                y2={u2.y * 5.625 - 16}
                stroke="#38bdf8"
                strokeWidth="3"
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
          className="pointer-events-none absolute z-10 h-4 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-sky-400 bg-sky-400/30 animate-ping"
        />
      )}

      {/* ─── INDICADORES INTERATIVOS DOS 3 BALCÕES DE ATENDIMENTO RH ─── */}
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
            }}
            style={{ left: `${pos.staff.x}%`, top: `${pos.staff.y - 7}%` }}
            className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold shadow-sm transition hover:scale-105 ${
              occupiedBy
                ? "border-amber-300 bg-amber-500 text-slate-950"
                : "border-slate-700 bg-slate-900/90 text-sky-200 hover:bg-slate-800"
            }`}
            title={
              occupiedBy
                ? `Balcão ${deskNum}: Em atendimento (${occupiedBy})`
                : `Ir até o Balcão ${deskNum}`
            }
          >
            <span>{occupiedBy ? "🔒" : "🎧"}</span>
            <span>Balcão {deskNum}</span>
          </button>
        );
      })}

      {/* ─── ESTAÇÕES CORPORATIVAS INTERATIVAS NO MAPA ─── */}
      {/* 1. Balcões de Atendimento RH (Sup. Esquerda) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onMoveTo(SUPPORT_ROOMS.atendimento.spawn.x, SUPPORT_ROOMS.atendimento.spawn.y);
          onOpenQueuePanel();
        }}
        className="absolute left-3 top-3 z-20 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-[11px] font-semibold text-white shadow-md backdrop-blur-xs transition hover:border-sky-400 hover:bg-slate-900"
      >
        <span className="flex size-5 items-center justify-center rounded bg-sky-500/20 text-xs">
          🎧
        </span>
        <span>Atendimento RH · Balcões 1 a 3</span>
      </button>

      {/* 2. Mural de Vagas Abertas (Topo Central) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onMoveTo(44, 42);
          onOpenJobBoard();
        }}
        className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-blue-400/50 bg-blue-950/95 px-3.5 py-1.5 text-[11px] font-semibold text-white shadow-md backdrop-blur-xs transition hover:scale-[1.02] hover:bg-blue-900"
      >
        <span>📋 Mural de Vagas Abertas</span>
        <span className="rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {openJobCount} {openJobCount === 1 ? "oportunidade" : "oportunidades"}
        </span>
      </button>

      {/* 3. Bots Assistentes & Tira-Dúvidas (Sup. Direita) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onMoveTo(SUPPORT_ROOMS.cafe.spawn.x, SUPPORT_ROOMS.cafe.spawn.y);
          onSelectBot("vagas");
        }}
        className="absolute right-3 top-3 z-20 flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-slate-900/90 px-3 py-1.5 text-[11px] font-semibold text-white shadow-md backdrop-blur-xs transition hover:border-emerald-400 hover:bg-slate-900"
      >
        <span className="flex size-5 items-center justify-center rounded bg-emerald-500/20 text-xs">
          🤖
        </span>
        <span>Assistentes Virtuais · Tira-Dúvidas</span>
      </button>

      {/* 4. Totem Central da Recepção (Retirar Senha) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenQueuePanel();
        }}
        className="absolute left-[50%] top-[44%] z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-lg border border-amber-400/70 bg-slate-900/95 px-3.5 py-1.5 text-[11px] font-semibold text-white shadow-lg backdrop-blur-xs transition hover:scale-105 hover:border-amber-300"
      >
        <span className="text-amber-300">🎫</span>
        <span>Recepção · Retirar Senha RH</span>
        <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-extrabold text-slate-950">
          {queueCount} na fila
        </span>
      </button>

      {/* 5. Simulado de Entrevista & Dicas (Inf. Esquerda) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenArcadeQuiz();
        }}
        className="absolute bottom-3 left-3 z-20 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-[11px] font-semibold text-slate-100 shadow-md backdrop-blur-xs transition hover:border-indigo-400 hover:bg-slate-900"
      >
        <span>🎯</span>
        <span>Simulado de Entrevista & Boas Práticas</span>
      </button>

      {/* 6. Central de Avisos & Acompanhamento no Sistema (Inf. Direita) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onMoveTo(SUPPORT_ROOMS.diretoria.spawn.x, SUPPORT_ROOMS.diretoria.spawn.y);
          onOpenGuidesPanel();
        }}
        className="absolute bottom-3 right-3 z-20 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-[11px] font-semibold text-slate-100 shadow-md backdrop-blur-xs transition hover:border-sky-400 hover:bg-slate-900"
      >
        <span>🔔</span>
        <span>Como Acompanhar Avisos no Sistema</span>
      </button>

      {/* ─── BOTS ASSISTENTES CORPORATIVOS (VAGAS, AVISOS DO SISTEMA, CURRÍCULO) ─── */}
      {SUPPORT_ASSISTANT_BOTS.map((bot) => (
        <MapAvatarNode
          key={`bot_${bot.id}`}
          id={`bot_${bot.id}`}
          displayName={bot.name}
          kind="STAFF"
          avatar={bot.avatar}
          x={bot.x}
          y={bot.y}
          isAmbientNpc
          bubbleText={
            activeBotTip === bot.id
              ? `${bot.shortSpecialty} (Clique para perguntar)`
              : null
          }
          reactionEmoji="🤖"
          onSelect={() => {
            onMoveTo(Math.min(90, bot.x + 5), Math.min(90, bot.y + 4));
            setActiveBotTip(bot.id);
            onSelectBot(bot.id);
          }}
        />
      ))}

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
