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
import { MapAvatarNode, PixelAvatarSprite } from "./pixel-avatar";
import { Bot, Briefcase, Headphones, Lock, Sparkles } from "lucide-react";

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
  botBubbles: Record<string, { text: string; expiresAt: number }>;
  loadingBotId: AssistantBotId | null;
  reactions: ReactionFloatingItem[];
  activePrivatePairs: ActivePrivatePairDTO[];
  queueCount: number;
  openJobCount: number;
  activeBotId?: AssistantBotId | null;
  onMoveTo: (x: number, y: number) => void;
  onSelectUser: (user: MapPresenceUser) => void;
  onOpenArcadeQuiz: () => void;
  onOpenQueuePanel: () => void;
  onOpenJobBoard: () => void;
  onOpenGuidesPanel: () => void;
  onSelectBot: (botId: AssistantBotId) => void;
}

const RH_DESK_ATTENDANTS: Record<
  number,
  { name: string; role: string; avatar: AvatarConfig }
> = {
  1: {
    name: " Sofia · RH",
    role: "Recrutadora Sênior",
    avatar: {
      skin: "#f3c6a0",
      hair: "longo",
      hairColor: "#4a2c11",
      shirt: "#0f172a",
      pants: "#1e293b",
      accessory: "headset",
    },
  },
  2: {
    name: "Lucas · RH",
    role: "Business Partner",
    avatar: {
      skin: "#e0a370",
      hair: "curto",
      hairColor: "#1c1917",
      shirt: "#1e3a8a",
      pants: "#0f172a",
      accessory: "headset",
    },
  },
  3: {
    name: "Marina · RH",
    role: "Atração & Seleção",
    avatar: {
      skin: "#c68642",
      hair: "coque",
      hairColor: "#1c1917",
      shirt: "#0f172a",
      pants: "#1e293b",
      accessory: "glasses",
    },
  },
};

/**
 * Planta Arquitetônica Corporativa Executiva (Nível Michelin):
 * - Ala Esquerda: 3 Mesas Executivas de Atendimento RH com atendentes sentados atrás dos monitores.
 * - Centro: Recepção Corporativa, Mural Digital de Vagas e Lounge de Espera.
 * - Ala Direita: 3 Estações de IA com os Bots Assistentes sentados nas mesas respondendo via balão público.
 */
export function PixelOfficeCanvas({
  meId,
  users,
  bubbles,
  botBubbles,
  loadingBotId,
  reactions,
  activePrivatePairs,
  queueCount,
  openJobCount,
  activeBotId,
  onMoveTo,
  onSelectUser,
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
    const x = Math.min(90, Math.max(10, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(92, Math.max(18, ((e.clientY - rect.top) / rect.height) * 100));
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
      className="relative aspect-[16/10] min-h-[460px] w-full cursor-pointer select-none overflow-hidden rounded-2xl border border-slate-300 bg-[#f1f5f9] shadow-sm"
    >
      {/* ─── PISO ARQUITETÔNICO CORPORATIVO EM VETOR DE ALTA PRECISÃO ─── */}
      <svg
        viewBox="0 0 1000 625"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      >
        <defs>
          <pattern id="corp-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="1"
            />
          </pattern>
          <linearGradient id="north-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <linearGradient id="reception-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#f1f5f9" />
          </linearGradient>
        </defs>

        {/* Piso base de porcelanato corporativo */}
        <rect width="1000" height="625" fill="#f8fafc" />
        <rect width="1000" height="625" fill="url(#corp-grid)" />

        {/* Parede Executiva Norte (Topo) */}
        <rect x="0" y="0" width="1000" height="68" fill="url(#north-wall)" />
        <line x1="0" y1="68" x2="1000" y2="68" stroke="#334155" strokeWidth="3" />

        {/* Ala Oeste (Esquerda): Tapete Corporativo das Mesas de Atendimento RH */}
        <rect
          x="28"
          y="86"
          width="290"
          height="515"
          rx="16"
          fill="#eff6ff"
          stroke="#bfdbfe"
          strokeWidth="2"
        />
        <text
          x="173"
          y="112"
          textAnchor="middle"
          fill="#1e3a8a"
          fontSize="11"
          fontWeight="800"
          letterSpacing="1.2"
        >
          ALA DE ATENDIMENTO RH (1:1)
        </text>

        {/* Centro: Hall da Recepção Executiva & Sala de Espera */}
        <rect
          x="338"
          y="86"
          width="324"
          height="515"
          rx="16"
          fill="url(#reception-floor)"
          stroke="#e2e8f0"
          strokeWidth="2"
        />
        {/* Tapete central da Recepção */}
        <rect
          x="380"
          y="235"
          width="240"
          height="175"
          rx="20"
          fill="#f1f5f9"
          stroke="#cbd5e1"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        {/* Sofás executivos de espera no centro */}
        <rect x="395" y="265" width="24" height="115" rx="8" fill="#334155" />
        <rect x="401" y="272" width="14" height="101" rx="5" fill="#475569" />
        <rect x="581" y="265" width="24" height="115" rx="8" fill="#334155" />
        <rect x="585" y="272" width="14" height="101" rx="5" fill="#475569" />
        {/* Mesa de centro minimalista */}
        <rect
          x="468"
          y="295"
          width="64"
          height="55"
          rx="10"
          fill="#ffffff"
          stroke="#cbd5e1"
          strokeWidth="2"
        />

        {/* Ala Leste (Direita): Tapete Corporativo da Bancada de Assistentes IA */}
        <rect
          x="682"
          y="86"
          width="290"
          height="515"
          rx="16"
          fill="#f0fdf4"
          stroke="#bbf7d0"
          strokeWidth="2"
        />
        <text
          x="827"
          y="112"
          textAnchor="middle"
          fill="#065f46"
          fontSize="11"
          fontWeight="800"
          letterSpacing="1.2"
        >
          BANCADA DE ASSISTENTES IA (AO VIVO)
        </text>

        {/* Divisórias de vidro arquitetônicas */}
        <line x1="328" y1="96" x2="328" y2="585" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="8 8" />
        <line x1="672" y1="96" x2="672" y2="585" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="8 8" />
      </svg>

      {/* ─── CABEÇALHO ARQUITETÔNICO NA PAREDE NORTE (MURAL DE VAGAS + ATALHOS) ─── */}
      <div className="absolute inset-x-0 top-0 z-20 flex h-[11%] items-center justify-between px-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenQueuePanel();
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-xs transition hover:bg-white/20"
        >
          <Headphones className="size-3.5 text-sky-300" />
          <span>Mesas RH · Fila ({queueCount})</span>
        </button>

        {/* Painel Digital Central: Mural de Vagas Abertas */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenJobBoard();
          }}
          className="inline-flex items-center gap-2.5 rounded-xl border border-sky-400/40 bg-slate-900/95 px-4 py-1.5 text-xs font-bold text-white shadow-md transition hover:scale-[1.02] hover:border-sky-300"
        >
          <Briefcase className="size-3.5 text-sky-400" />
          <span>MURAL DE VAGAS ABERTAS</span>
          <span className="rounded-md bg-sky-500 px-2 py-0.5 text-[10px] font-extrabold text-slate-950">
            {openJobCount} {openJobCount === 1 ? "VAGA" : "VAGAS"}
          </span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenGuidesPanel();
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-xs transition hover:bg-white/20"
        >
          <span>🔔 Central de Avisos</span>
        </button>
      </div>

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
                strokeWidth="4"
                strokeLinecap="round"
              />
              <line
                x1={u1.x * 10}
                y1={u1.y * 6.25 - 16}
                x2={u2.x * 10}
                y2={u2.y * 6.25 - 16}
                stroke="#38bdf8"
                strokeWidth="2"
                strokeDasharray="6 6"
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
          className="pointer-events-none absolute z-10 h-3.5 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-900 bg-slate-900/20 animate-ping"
        />
      )}

      {/* ─── ALA ESQUERDA: 3 MESAS EXECUTIVAS DE ATENDIMENTO RH (ATENDENTES SENTADOS NAS MESAS) ─── */}
      {[1, 2, 3].map((deskNum) => {
        const pos = SUPPORT_DESK_POSITIONS[deskNum];
        const attendant = RH_DESK_ATTENDANTS[deskNum];
        const occupiedBy = occupiedDesks.get(deskNum);

        return (
          <div
            key={`rh_desk_${deskNum}`}
            style={{ left: `${pos.staff.x}%`, top: `${pos.staff.y}%` }}
            onClick={(e) => {
              e.stopPropagation();
              onMoveTo(pos.candidate.x, pos.candidate.y);
              onOpenQueuePanel();
            }}
            className="group absolute z-20 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer"
          >
            {/* Encosto da cadeira executiva */}
            <div className="h-3 w-9 rounded-t-md border border-slate-700 bg-slate-800" />

            {/* Atendente RH sentado (tronco e cabeça visíveis atrás da mesa) */}
            <div className="-mt-2 h-[34px] overflow-hidden">
              <PixelAvatarSprite avatar={attendant.avatar} kind="STAFF" size={44} />
            </div>

            {/* Tampo da Mesa Executiva Corporativa + Monitor + Crachá da Mesa */}
            <div
              className={`relative -mt-1 flex w-36 flex-col items-center rounded-lg border-2 px-2.5 py-1.5 shadow-sm transition group-hover:scale-[1.03] ${
                occupiedBy
                  ? "border-amber-500 bg-amber-50"
                  : "border-slate-700 bg-slate-900 text-white"
              }`}
            >
              {/* Monitor sobre a mesa */}
              <div className=" -mt-3 mb-1 flex items-center gap-1.5 rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-[9px] font-bold text-sky-300 shadow-2xs">
                <span>{occupiedBy ? "🔒 OCUPADO" : "🟢 LIVRE"}</span>
                <span>· MESA 0{deskNum}</span>
              </div>

              <span
                className={`text-[10px] font-bold leading-tight ${
                  occupiedBy ? "text-slate-900" : "text-white"
                }`}
              >
                {attendant.name}
              </span>
              <span
                className={`text-[9px] ${
                  occupiedBy ? "text-amber-800 font-semibold" : "text-slate-300"
                }`}
              >
                {occupiedBy ? `Atendendo ${occupiedBy}` : attendant.role}
              </span>
            </div>

            {/* Cadeira do Candidato em frente à mesa */}
            <div className="mt-2 flex flex-col items-center">
              <div className="size-4 rounded-full border-2 border-slate-400 bg-white shadow-2xs group-hover:border-blue-600" />
              <span className="mt-0.5 text-[9px] font-semibold text-slate-500">
                Assento Candidato
              </span>
            </div>
          </div>
        );
      })}

      {/* ─── CENTRO: TOTEM DE RECEPÇÃO & ORIENTAÇÃO ─── */}
      <div
        style={{ left: "50%", top: "30%" }}
        onClick={(e) => {
          e.stopPropagation();
          onMoveTo(50, 42);
        }}
        className="absolute z-15 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center text-center"
      >
        <div className="rounded-xl border border-slate-300 bg-white/95 px-3.5 py-2 shadow-xs backdrop-blur-xs">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-800">
            Recepção Central
          </p>
          <p className="text-[10px] text-slate-500">
            Clique em um Bot IA à direita para perguntar via balão
          </p>
        </div>
      </div>

      {/* ─── ALA DIREITA: 3 ESTAÇÕES EXECUTIVAS DOS BOTS IA (SENTADOS NAS MESAS RESPONDENDO VIA BALÃO) ─── */}
      {SUPPORT_ASSISTANT_BOTS.map((bot, idx) => {
        const isSelected = activeBotId === bot.id;
        const isThinking = loadingBotId === bot.id;
        const botBubble = botBubbles[bot.id];

        return (
          <div
            key={`bot_station_${bot.id}`}
            style={{ left: `${bot.x}%`, top: `${bot.y}%` }}
            onClick={(e) => {
              e.stopPropagation();
              onMoveTo(bot.visitorSpot.x, bot.visitorSpot.y);
              onSelectBot(bot.id);
            }}
            className="group absolute z-25 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer"
          >
            {/* BALÃO PÚBLICO DE RESPOSTA DA IA (VISÍVEL PARA TODOS NA SALA!) */}
            {(isThinking || (botBubble && botBubble.text)) && (
              <div
                className={`pointer-events-none absolute left-1/2 z-50 w-60 -translate-x-1/2 animate-in fade-in zoom-in-95 duration-200 ${
                  idx === 0 ? "top-[calc(100%+4px)]" : "bottom-[calc(100%+8px)]"
                }`}
              >
                <div className="relative rounded-2xl border-2 border-emerald-600 bg-white p-2.5 text-left shadow-xl">
                  <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-emerald-800 mb-0.5">
                    <Sparkles className="size-3 text-emerald-600 shrink-0" />
                    <span>{bot.name} respondeu ao vivo:</span>
                  </div>
                  <p className="text-[11px] font-medium leading-snug text-slate-800">
                    {isThinking
                      ? "🤖 Analisando com IA e preparando resposta..."
                      : botBubble?.text}
                  </p>
                </div>
              </div>
            )}

            {/* Encosto da Cadeira Executiva do Bot */}
            <div className="h-3 w-9 rounded-t-md border border-emerald-800 bg-emerald-950" />

            {/* Bot Assistente Sentado atrás da Mesa (Tronco + Cabeça) */}
            <div className="-mt-2 h-[34px] overflow-hidden">
              <PixelAvatarSprite avatar={bot.avatar} kind="STAFF" size={44} />
            </div>

            {/* Mesa Executiva do Bot IA + Monitor + Placa */}
            <div
              className={`relative -mt-1 flex w-40 flex-col items-center rounded-lg border-2 px-2.5 py-1.5 shadow-sm transition group-hover:scale-[1.03] ${
                isSelected
                  ? "border-emerald-600 bg-emerald-950 text-white ring-4 ring-emerald-500/20"
                  : "border-slate-700 bg-slate-900 text-white hover:border-emerald-500"
              }`}
            >
              <div className="-mt-3 mb-1 flex items-center gap-1 rounded border border-emerald-500/50 bg-emerald-900 px-2 py-0.5 text-[9px] font-extrabold text-emerald-200 shadow-2xs">
                <Bot className="size-2.5" />
                <span>{bot.badge.toUpperCase()}</span>
              </div>

              <span className="text-[10px] font-bold text-white leading-tight">
                {bot.name}
              </span>
              <span className="text-[9px] text-emerald-300 font-medium">
                {isSelected ? "✓ Selecionado · Mande um balão" : "Clique p/ perguntar via balão"}
              </span>
            </div>

            {/* Cadeira do Candidato em frente à mesa do Bot */}
            <div className="mt-2 flex flex-col items-center">
              <div
                className={`size-4 rounded-full border-2 shadow-2xs transition ${
                  isSelected
                    ? "border-emerald-600 bg-emerald-100 scale-110"
                    : "border-slate-400 bg-white group-hover:border-emerald-600"
                }`}
              />
              <span className="mt-0.5 text-[9px] font-semibold text-emerald-900">
                {isSelected ? "Você está aqui" : "Sentar p/ perguntar"}
              </span>
            </div>
          </div>
        );
      })}

      {/* ─── PARTICIPANTES ONLINE EM TEMPO REAL (CANDIDATOS E VISITANTES) ─── */}
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
