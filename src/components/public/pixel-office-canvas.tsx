"use client";

import React, { useState } from "react";
import {
  SUPPORT_DESK_POSITIONS,
  SUPPORT_ROOMS,
  type ActivePrivatePairDTO,
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
  onMoveTo: (x: number, y: number) => void;
  onSelectUser: (user: MapPresenceUser) => void;
  onOpenArcadeQuiz: () => void;
  onOpenQueuePanel: () => void;
  onGrabCoffee?: () => void;
}

/**
 * Personagens de ambientação do escritório (Barista, Dev RH, Gamer, Networking)
 * posicionados exatamente como na imagem de referência para dar vida imediata
 * à sala mesmo quando há poucos usuários online.
 */
const AMBIENT_NPCS: Array<{
  id: string;
  displayName: string;
  kind: "STAFF" | "CANDIDATE";
  x: number;
  y: number;
  emoji: string;
  tipBubble: string;
  avatar: AvatarConfig;
}> = [
  {
    id: "npc_rh_guide",
    displayName: "Sofia · Anfitriã RH",
    kind: "STAFF",
    x: 23,
    y: 23,
    emoji: "❤️",
    tipBubble: "Bem-vindo! Retire sua senha na Recepção ou chame um recrutador nos Balcões 1, 2 e 3!",
    avatar: {
      skin: "#f3c6a0",
      hair: "longo",
      hairColor: "#4a2c11",
      shirt: "#2563eb",
      pants: "#1e293b",
      accessory: "headset",
    },
  },
  {
    id: "npc_cafe_barista",
    displayName: "Leo · Barista Café",
    kind: "CANDIDATE",
    x: 78,
    y: 26,
    emoji: "☕",
    tipBubble: "Pegue um café expresso quentinho enquanto troca ideias com outros candidatos! ☕",
    avatar: {
      skin: "#e0a370",
      hair: "topete",
      hairColor: "#d97706",
      shirt: "#d97706",
      pants: "#451a03",
      accessory: "none",
    },
  },
  {
    id: "npc_arcade_champ",
    displayName: "Bia · Arcade Quiz",
    kind: "CANDIDATE",
    x: 19,
    y: 67,
    emoji: "🎵",
    tipBubble: "Clique nas máquinas de fliperama para jogar o Quiz Rápido de Carreira! 🎮",
    avatar: {
      skin: "#8d5524",
      hair: "cacheado",
      hairColor: "#1c1917",
      shirt: "#7c3aed",
      pants: "#1e293b",
      accessory: "headset",
    },
  },
];

/**
 * Mapa Isométrico 32-bit em Pixel-Art (estilo Habbo Hotel / Gather.town / Mortadela)
 * com 5 salas interligadas:
 * 1. Sup. Esquerda: Balcões de Atendimento RH (Carpete azul, 3 PCs, tapete circular e sofás)
 * 2. Centro: Recepção & Sala de Espera (Piso de madeira, roda de sofás e painel de senhas)
 * 3. Sup. Direita: Café & Networking (Piso verde-menta, máquinas de expresso, balcão e mesas)
 * 4. Inf. Esquerda: Sala de Jogos & Arcade (3 fliperamas iluminados e mesa de sinuca)
 * 5. Inf. Direita: Diretoria & Lounge VIP (Paredes lilás, sofás executivos e mesa)
 */
export function PixelOfficeCanvas({
  meId,
  users,
  bubbles,
  reactions,
  activePrivatePairs,
  queueCount,
  onMoveTo,
  onSelectUser,
  onOpenArcadeQuiz,
  onOpenQueuePanel,
  onGrabCoffee,
}: PixelOfficeCanvasProps) {
  const [activeNpcTip, setActiveNpcTip] = useState<string | null>(null);
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
      className="relative aspect-[16/9] min-h-[440px] w-full cursor-pointer select-none overflow-hidden rounded-3xl border-4 border-stone-950 bg-[#090a0f] shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
    >
      {/* ─── CENÁRIO ISOMÉTRICO PIXEL-ART DE ALTA DEFINIÇÃO ─── */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/virtual-office-isometric.jpg"
        alt="Mapa Isométrico do Espaço de Carreiras"
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover [image-rendering:pixelated]"
      />

      {/* Vinheta cinematográfica sutil nas bordas para destacar os balões e HUD */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, transparent 68%, rgba(9,10,15,0.48) 100%)",
        }}
      />

      {/* ─── LINHAS DOURADAS CONECTANDO DUPLAS EM CONVERSA PRIVADA 🔒 ─── */}
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
                stroke="#000000"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <line
                x1={u1.x * 10}
                y1={u1.y * 5.625 - 16}
                x2={u2.x * 10}
                y2={u2.y * 5.625 - 16}
                stroke="#fbbf24"
                strokeWidth="3.5"
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
          className="pointer-events-none absolute z-10 h-4 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-300 bg-amber-300/30 animate-ping"
        />
      )}

      {/* ─── INDICADORES INTERATIVOS DOS 3 BALCÕES DE ATENDIMENTO RH (SALA AZUL) ─── */}
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
            className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 rounded-lg border-2 border-stone-950 px-2 py-0.5 text-[10px] font-black shadow-[0_2px_0_#090a0f] transition hover:scale-105 ${
              occupiedBy
                ? "bg-amber-400 text-stone-950"
                : "bg-sky-950/90 text-sky-200 hover:bg-sky-900"
            }`}
            title={
              occupiedBy
                ? `Balcão ${deskNum}: Em atendimento (${occupiedBy})`
                : `Caminhar até o Balcão ${deskNum}`
            }
          >
            <span>{occupiedBy ? "🔒" : "🎧"}</span>
            <span>B{deskNum}</span>
          </button>
        );
      })}

      {/* ─── PLACAS FLUTUANTES ESTILO HABBO / GATHER NOS AMBIENTES ─── */}
      {/* 1. Sala Atendimento RH (Sup. Esquerda) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onMoveTo(SUPPORT_ROOMS.atendimento.spawn.x, SUPPORT_ROOMS.atendimento.spawn.y);
        }}
        className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-xl border-2 border-stone-950 bg-sky-400 px-3 py-1 text-[11px] font-black text-stone-950 shadow-[0_3px_0_#090a0f] transition hover:scale-105 hover:bg-sky-300"
      >
        <span>🎧</span>
        <span>Atendimento RH · Balcões 1 a 3</span>
      </button>

      {/* 2. Café & Networking (Sup. Direita) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onMoveTo(SUPPORT_ROOMS.cafe.spawn.x, SUPPORT_ROOMS.cafe.spawn.y);
          onGrabCoffee?.();
        }}
        className="absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-xl border-2 border-stone-950 bg-emerald-400 px-3 py-1 text-[11px] font-black text-stone-950 shadow-[0_3px_0_#090a0f] transition hover:scale-105 hover:bg-emerald-300"
      >
        <span>☕</span>
        <span>Café & Networking · Pegar Expresso</span>
      </button>

      {/* 3. Totem Central da Recepção (Retirar Senha) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenQueuePanel();
        }}
        className="absolute left-[49%] top-[43%] z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-xl border-2 border-stone-950 bg-amber-400 px-3.5 py-1.5 text-[11px] font-black text-stone-950 shadow-[0_4px_0_#090a0f] transition hover:scale-105 hover:bg-amber-300"
      >
        <span>🛋️ Recepção · Retirar Senha</span>
        <span className="rounded-md bg-stone-950 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-300">
          {queueCount} na fila
        </span>
      </button>

      {/* 4. Sala de Jogos & Fliperama (Inf. Esquerda) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenArcadeQuiz();
        }}
        className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 rounded-xl border-2 border-stone-950 bg-purple-500 px-3 py-1.5 text-[11px] font-black text-white shadow-[0_3px_0_#090a0f] transition hover:scale-105 hover:bg-purple-400"
      >
        <span>🕹️</span>
        <span>Fliperama & Sinuca · Jogar Quiz</span>
      </button>

      {/* 5. Diretoria & Lounge VIP (Inf. Direita) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onMoveTo(SUPPORT_ROOMS.diretoria.spawn.x, SUPPORT_ROOMS.diretoria.spawn.y);
        }}
        className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 rounded-xl border-2 border-stone-950 bg-fuchsia-300 px-3 py-1.5 text-[11px] font-black text-stone-950 shadow-[0_3px_0_#090a0f] transition hover:scale-105 hover:bg-fuchsia-200"
      >
        <span>🏛️</span>
        <span>Diretoria & Lounge VIP</span>
      </button>

      {/* ─── PERSONAGENS DE AMBIENTAÇÃO (ANFITRIÃ RH, BARISTA, ARCADE) ─── */}
      {AMBIENT_NPCS.map((npc) => (
        <MapAvatarNode
          key={npc.id}
          id={npc.id}
          displayName={npc.displayName}
          kind={npc.kind}
          avatar={npc.avatar}
          x={npc.x}
          y={npc.y}
          isAmbientNpc
          bubbleText={activeNpcTip === npc.id ? npc.tipBubble : null}
          reactionEmoji={npc.emoji}
          onSelect={() => {
            onMoveTo(Math.min(90, npc.x + 5), Math.min(90, npc.y + 4));
            setActiveNpcTip((prev) => (prev === npc.id ? null : npc.id));
          }}
        />
      ))}

      {/* ─── BONEQUINHOS DOS PARTICIPANTES ONLINE EM TEMPO REAL ─── */}
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
