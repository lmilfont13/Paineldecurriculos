"use client";

import React, { useState } from "react";
import {
  AvatarConfig,
  AssistantBotId,
  SUPPORT_ASSISTANT_BOTS,
  SUPPORT_DESK_POSITIONS,
  SupportRoomId,
  ActivePrivatePairDTO,
} from "@/server/models/support.model";
import { PixelAvatarSprite, MapAvatarNode } from "./pixel-avatar";
import { Bot, Briefcase, Headphones, Sparkles, X } from "lucide-react";

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
  isAnnouncement?: boolean;
}

export interface ReactionFloatingItem {
  id?: string;
  participantId: string;
  emoji: string;
  expiresAt: number;
}

/**
 * Organiza qualquer texto de resposta do Bot (mesmo quando vem em uma única linha
 * com "1. ...; 2. ..." ou com tópicos "• ") em:
 * - headline (título curto)
 * - bullets (lista de itens separados visualmente)
 * - footer (orientação final ou pergunta de acompanhamento)
 */
export function parseStructuredBotReply(rawText: string): {
  headline: string;
  bullets: string[];
  footer: string | null;
} {
  const cleaned = rawText
    .replace(/\*\*/g, "")
    .replace(/\r\n/g, "\n")
    // Quebra listas numeradas na mesma linha ("1. ...; 2. ...") em linhas próprias
    .replace(/:\s*(\d+[\.\)]\s+)/g, ":\n• ")
    .replace(/;\s*(\d+[\.\)]\s+)/g, "\n• ")
    .replace(/\.\s+(\d+[\.\)]\s+)/g, ".\n• ")
    .replace(/\s+•\s+/g, "\n• ")
    .replace(/\s+👉\s*/g, "\n👉 ")
    .trim();

  const rawLines = cleaned
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (rawLines.length === 0) {
    return { headline: "", bullets: [], footer: null };
  }

  // Se veio apenas 1 linha longa com ponto-e-vírgula, separa em tópicos
  if (rawLines.length === 1 && rawLines[0].includes(";")) {
    const parts = rawLines[0]
      .split(";")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      return {
        headline: parts[0],
        bullets: parts.slice(1).map((p) => p.replace(/^[-•*\d\.\)\s]+/, "").trim()),
        footer: null,
      };
    }
  }

  let headline = "";
  const bullets: string[] = [];
  let footer: string | null = null;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const isBullet =
      line.startsWith("•") ||
      line.startsWith("-") ||
      /^\d+[\.\)]\s+/.test(line);
    const isFooter = line.startsWith("👉") || (i === rawLines.length - 1 && line.endsWith("?") && bullets.length > 0);

    if (i === 0 && !isBullet) {
      // Se na última frase do último bullet veio uma pergunta grudada ("... (CLT). Deseja saber...?")
      headline = line;
    } else if (isFooter) {
      footer = line.replace(/^👉\s*/, "").trim();
    } else if (isBullet) {
      const cleanItem = line.replace(/^([-•*]|\d+[\.\)])\s*/, "").trim();
      // Se o último item tem uma pergunta final colada após ponto (ex: "Auxiliar (CLT). Deseja saber...?")
      const questionMatch = cleanItem.match(/^(.*?\))\.\s+([A-ZÀ-Ú][^.]*\?)$/);
      if (questionMatch) {
        bullets.push(questionMatch[1].trim());
        footer = questionMatch[2].trim();
      } else {
        bullets.push(cleanItem);
      }
    } else if (!headline) {
      headline = line;
    } else {
      bullets.push(line);
    }
  }

  return { headline, bullets, footer };
}

/**
 * Renderizador estruturado para respostas dos Bots (usado tanto no balão do mapa
 * quanto no histórico lateral para leitura executiva imediata).
 */
export function StructuredBotReplyContent({
  text,
  compact = false,
}: {
  text: string;
  compact?: boolean;
}) {
  const { headline, bullets, footer } = parseStructuredBotReply(text);

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      {headline && (
        <p
          className={
            compact
              ? "text-[11px] font-bold leading-snug text-slate-900"
              : "text-xs font-bold leading-snug text-slate-900"
          }
        >
          {headline}
        </p>
      )}

      {bullets.length > 0 && (
        <ul className={compact ? "space-y-1" : "space-y-1.5"}>
          {bullets.map((item, idx) => (
            <li
              key={idx}
              className={`flex items-start gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50/60 px-2 py-1 text-slate-800 ${
                compact ? "text-[11px] leading-tight" : "text-xs leading-snug"
              }`}
            >
              <span className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-extrabold text-white">
                {idx + 1}
              </span>
              <span className="font-medium">{item}</span>
            </li>
          ))}
        </ul>
      )}

      {footer && (
        <p
          className={
            compact
              ? "text-[10px] font-semibold text-emerald-800 pt-0.5"
              : "text-[11px] font-semibold text-emerald-800 pt-0.5"
          }
        >
          👉 {footer}
        </p>
      )}
    </div>
  );
}

interface PixelOfficeCanvasProps {
  users: MapPresenceUser[];
  meId: string | null;
  bubbles: PublicBubbleItem[];
  reactions: ReactionFloatingItem[];
  activePrivatePairs: ActivePrivatePairDTO[];
  queueCount: number;
  openJobCount: number;
  activeBotId?: AssistantBotId | null;
  botBubbles: Record<string, { text: string; expiresAt: number }>;
  loadingBotId: AssistantBotId | null;
  onMoveTo: (x: number, y: number) => void;
  onSelectUser: (user: MapPresenceUser) => void;
  onOpenArcadeQuiz?: () => void;
  onOpenQueuePanel: () => void;
  onOpenJobBoard: () => void;
  onOpenGuidesPanel: () => void;
  onSelectBot: (botId: AssistantBotId) => void;
  onDismissBotBubble?: (botId: AssistantBotId) => void;
}

/** Equipe de RH fixa sentada nas 3 Mesas Executivas da Bancada Sul */
const RH_DESK_ATTENDANTS: Record<
  number,
  { name: string; role: string; avatar: AvatarConfig }
> = {
  1: {
    name: "Sofia · RH",
    role: "Recrutadora Sênior",
    avatar: {
      skin: "#f3c6a0",
      hair: "longo",
      hairColor: "#1c1917",
      shirt: "#0f172a",
      pants: "#1e293b",
      accessory: "headset",
    },
  },
  2: {
    name: "Lucas · RH",
    role: "Business Partner",
    avatar: {
      skin: "#c68642",
      hair: "topete",
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
      skin: "#8d5524",
      hair: "cacheado",
      hairColor: "#1c1917",
      shirt: "#0f172a",
      pants: "#1e293b",
      accessory: "glasses",
    },
  },
};

export function PixelOfficeCanvas({
  users,
  meId,
  bubbles,
  reactions,
  activePrivatePairs,
  queueCount,
  openJobCount,
  activeBotId,
  botBubbles,
  loadingBotId,
  onMoveTo,
  onSelectUser,
  onOpenQueuePanel,
  onOpenJobBoard,
  onOpenGuidesPanel,
  onSelectBot,
  onDismissBotBubble,
}: PixelOfficeCanvasProps) {
  const [clickRipple, setClickRipple] = useState<{
    x: number;
    y: number;
    id: number;
  } | null>(null);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;
    const x = Math.max(8, Math.min(92, Math.round(rawX)));
    const y = Math.max(18, Math.min(92, Math.round(rawY)));
    setClickRipple({ x, y, id: Date.now() });
    onMoveTo(x, y);
  };

  // Mapeia quem está em conversa privada para exibir o cadeado 🔒 sobre os dois bonecos
  const privatePartnerByParticipant = new Map<string, string>();
  const occupiedDesks = new Map<number, string>();
  for (const pair of activePrivatePairs) {
    if (pair.requesterId && pair.responderName) {
      privatePartnerByParticipant.set(pair.requesterId, pair.responderName);
    }
    if (pair.responderId && pair.requesterName) {
      privatePartnerByParticipant.set(pair.responderId, pair.requesterName);
    }
    if (pair.desk) {
      occupiedDesks.set(pair.desk, pair.requesterName);
    }
  }

  // Determina qual Bot está exibindo balão no momento (prioriza o que está pensando ou o mais recente)
  const activeBubbleBot =
    SUPPORT_ASSISTANT_BOTS.find((b) => loadingBotId === b.id) ??
    SUPPORT_ASSISTANT_BOTS.filter((b) => Boolean(botBubbles[b.id]?.text)).sort(
      (a, b) => (botBubbles[b.id]?.expiresAt ?? 0) - (botBubbles[a.id]?.expiresAt ?? 0)
    )[0] ??
    null;

  return (
    <div
      onClick={handleCanvasClick}
      className="relative w-full aspect-16/10 min-h-[460px] select-none overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-xs cursor-pointer"
      role="application"
      aria-label="Planta corporativa com 3 Bots Assistentes de IA na bancada superior e 3 Mesas de Atendimento RH na bancada inferior"
    >
      {/* ─── PLANTA ARQUITETÔNICA HORIZONTAL EM 3 FAIXAS (ZERO SOBREPOSIÇÃO) ─── */}
      <svg
        viewBox="0 0 1000 625"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      >
        <defs>
          <pattern
            id="corp-grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
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
        </defs>

        {/* Piso corporativo */}
        <rect width="1000" height="625" fill="#f8fafc" />
        <rect width="1000" height="625" fill="url(#corp-grid)" />

        {/* Parede Norte (Cabeçalho do Mural de Vagas) */}
        <rect x="0" y="0" width="1000" height="64" fill="url(#north-wall)" />
        <line x1="0" y1="64" x2="1000" y2="64" stroke="#334155" strokeWidth="2" />

        {/* FAIXA SUPERIOR (NORTE): BANCADA DE ASSISTENTES IA (3 MESAS LADO A LADO) */}
        <rect
          x="28"
          y="78"
          width="944"
          height="172"
          rx="16"
          fill="#f0fdf4"
          stroke="#bbf7d0"
          strokeWidth="2"
        />
        <text
          x="500"
          y="99"
          textAnchor="middle"
          fill="#065f46"
          fontSize="11"
          fontWeight="800"
          letterSpacing="1.2"
        >
          BANCADA DE ASSISTENTES IA (CLIQUE EM UM BOT PARA PERGUNTAR VIA BALÃO)
        </text>

        {/* FAIXA CENTRAL: CORREDOR DE RECEPÇÃO E CIRCULAÇÃO LIVRE DOS CANDIDATOS */}
        <rect
          x="28"
          y="264"
          width="944"
          height="156"
          rx="14"
          fill="#ffffff"
          stroke="#e2e8f0"
          strokeWidth="1.5"
          strokeDasharray="6 6"
        />
        <text
          x="500"
          y="346"
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="11"
          fontWeight="700"
          letterSpacing="1.5"
        >
          CORREDOR CENTRAL DE RECEPÇÃO · ÁREA DE CIRCULAÇÃO DOS CANDIDATOS
        </text>

        {/* FAIXA INFERIOR (SUL): ALA DE ATENDIMENTO HUMANO RH 1:1 (3 MESAS LADO A LADO) */}
        <rect
          x="28"
          y="434"
          width="944"
          height="174"
          rx="16"
          fill="#eff6ff"
          stroke="#bfdbfe"
          strokeWidth="2"
        />
        <text
          x="500"
          y="456"
          textAnchor="middle"
          fill="#1e3a8a"
          fontSize="11"
          fontWeight="800"
          letterSpacing="1.2"
        >
          ALA DE ATENDIMENTO HUMANO RH 1:1 (MESAS EXECUTIVAS 01 A 03)
        </text>
      </svg>

      {/* ─── BARRA DE TOPO NA PAREDE NORTE (MURAL DE VAGAS + FILA RH + AVISOS) ─── */}
      <div className="absolute inset-x-0 top-0 z-20 flex h-[10.2%] items-center justify-between px-4">
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

      {/* Marcador de clique no piso */}
      {clickRipple && (
        <span
          key={clickRipple.id}
          style={{ left: `${clickRipple.x}%`, top: `${clickRipple.y}%` }}
          className="pointer-events-none absolute z-10 h-3.5 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-900 bg-slate-900/20 animate-ping"
        />
      )}

      {/* ─── FAIXA SUPERIOR: 3 ESTAÇÕES DOS BOTS IA (LADO A LADO: X = 20%, 50%, 80%, Y = 28%) ─── */}
      {SUPPORT_ASSISTANT_BOTS.map((bot) => {
        const isSelected = activeBotId === bot.id;

        return (
          <div
            key={`bot_station_${bot.id}`}
            style={{ left: `${bot.x}%`, top: "28%" }}
            onClick={(e) => {
              e.stopPropagation();
              onMoveTo(bot.visitorSpot.x, bot.visitorSpot.y);
              onSelectBot(bot.id);
            }}
            className="group absolute z-20 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer"
          >
            {/* Encosto da Cadeira Executiva do Bot */}
            <div className="h-2.5 w-9 rounded-t-md border border-emerald-800 bg-emerald-950" />

            {/* Bot Assistente Sentado atrás da Mesa */}
            <div className="-mt-1.5 h-[32px] overflow-hidden">
              <PixelAvatarSprite avatar={bot.avatar} kind="STAFF" size={42} />
            </div>

            {/* Bancada Executiva Compacta do Bot */}
            <div
              className={`relative -mt-1 flex w-44 flex-col items-center rounded-xl border-2 px-3 py-1.5 shadow-sm transition group-hover:scale-[1.03] ${
                isSelected
                  ? "border-emerald-500 bg-emerald-950 text-white ring-4 ring-emerald-500/20"
                  : "border-slate-700 bg-slate-900 text-white hover:border-emerald-500"
              }`}
            >
              <div className="-mt-3 mb-0.5 flex items-center gap-1 rounded border border-emerald-500/50 bg-emerald-900 px-2 py-0.5 text-[9px] font-extrabold text-emerald-200">
                <Bot className="size-2.5" />
                <span>{bot.badge.toUpperCase()}</span>
              </div>

              <span className="text-[11px] font-bold text-white leading-tight">
                {bot.name}
              </span>
              <span className="text-[9px] text-emerald-300 font-medium">
                {isSelected
                  ? "✓ Selecionado · Mande um balão"
                  : "Clique p/ perguntar via balão"}
              </span>
            </div>
          </div>
        );
      })}

      {/* ─── FAIXA INFERIOR: 3 MESAS EXECUTIVAS DO RH (LADO A LADO: X = 20%, 50%, 80%, Y = 85%) ─── */}
      {[1, 2, 3].map((deskNum) => {
        const pos = SUPPORT_DESK_POSITIONS[deskNum];
        const attendant = RH_DESK_ATTENDANTS[deskNum];
        const occupiedBy = occupiedDesks.get(deskNum);

        return (
          <div
            key={`rh_desk_${deskNum}`}
            style={{ left: `${pos.staff.x}%`, top: "85%" }}
            onClick={(e) => {
              e.stopPropagation();
              onMoveTo(pos.candidate.x, pos.candidate.y);
              onOpenQueuePanel();
            }}
            className="group absolute z-20 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer"
          >
            {/* Encosto da cadeira executiva */}
            <div className="h-2.5 w-9 rounded-t-md border border-slate-700 bg-slate-800" />

            {/* Atendente RH sentado */}
            <div className="-mt-1.5 h-[32px] overflow-hidden">
              <PixelAvatarSprite avatar={attendant.avatar} kind="STAFF" size={42} />
            </div>

            {/* Mesa Executiva do RH */}
            <div
              className={`relative -mt-1 flex w-44 flex-col items-center rounded-xl border-2 px-3 py-1.5 shadow-sm transition group-hover:scale-[1.03] ${
                occupiedBy
                  ? "border-amber-500 bg-amber-50"
                  : "border-slate-700 bg-slate-900 text-white hover:border-sky-400"
              }`}
            >
              <div className="-mt-3 mb-0.5 flex items-center gap-1.5 rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-[9px] font-bold text-sky-300">
                <span>{occupiedBy ? "🔒 OCUPADO" : "🟢 LIVRE"}</span>
                <span>· MESA 0{deskNum}</span>
              </div>

              <span
                className={`text-[11px] font-bold leading-tight ${
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
          </div>
        );
      })}

      {/* ─── PARTICIPANTES ONLINE EM TEMPO REAL (NO CORREDOR CENTRAL) ─── */}
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

      {/* ─── CAMADA SUPERIOR DEDICADA (Z-200): BALÃO PÚBLICO DE RESPOSTA DA IA (ESTRUTURADO EM TÓPICOS E SEM SOBREPOR MESAS NEM AVATARES) ─── */}
      {activeBubbleBot && (
        <div
          style={{
            left:
              activeBubbleBot.x <= 25
                ? "38%"
                : activeBubbleBot.x >= 75
                  ? "62%"
                  : "58%",
            top: "38%",
            zIndex: 200,
          }}
          onClick={(e) => e.stopPropagation()}
          className="absolute w-80 max-w-[88%] -translate-x-1/2 animate-in fade-in zoom-in-95 duration-200"
        >
          {/* Seta apontando para a mesa do Bot acima */}
          <div
            style={{
              left:
                activeBubbleBot.x <= 25
                  ? "22%"
                  : activeBubbleBot.x >= 75
                    ? "78%"
                    : "38%",
            }}
            className="absolute -top-2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 border-l-2 border-t-2 border-emerald-600 bg-white"
          />

          <div className="relative rounded-2xl border-2 border-emerald-600 bg-white p-3 text-left shadow-2xl">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5 mb-2">
              <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-900">
                <Sparkles className="size-3.5 text-emerald-600 shrink-0" />
                <span>{activeBubbleBot.name} · Resposta em Balão Público</span>
              </div>
              {onDismissBotBubble && (
                <button
                  type="button"
                  onClick={() => onDismissBotBubble(activeBubbleBot.id)}
                  className="rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  title="Fechar balão"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {loadingBotId === activeBubbleBot.id ? (
              <div className="flex items-center gap-2 py-2 text-xs font-semibold text-emerald-800">
                <Sparkles className="size-4 animate-spin text-emerald-600" />
                <span>Analisando sua pergunta com IA...</span>
              </div>
            ) : (
              botBubbles[activeBubbleBot.id]?.text && (
                <StructuredBotReplyContent
                  text={botBubbles[activeBubbleBot.id]!.text}
                  compact
                />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
