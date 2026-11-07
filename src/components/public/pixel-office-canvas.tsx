"use client";

import React from "react";
import {
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
}

/**
 * Mapa 2.5D em estilo pixel-art / Habbo / Gather inspirado na referência visual:
 * - Sup. Esquerdo: Balcões de Atendimento RH (carpete azul, 3 estações PC + tapete circular com sofás)
 * - Centro: Recepção & Sala de Espera (piso amadeirado, sofás em roda + painel de senhas)
 * - Sup. Direito: Café & Networking (piso verde-menta quadriculado, balcão de café expresso e mesas)
 * - Inf. Esquerdo: Sala de Jogos & Arcade (3 fliperamas interativos + mesa de sinuca)
 * - Inf. Direito: Diretoria & Lounge VIP (paredes lilás, sofás executivos e mesa)
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
}: PixelOfficeCanvasProps) {
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(94, Math.max(6, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(92, Math.max(10, ((e.clientY - rect.top) / rect.height) * 100));
    onMoveTo(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
  };

  // Mapa rápido de quem está em conversa privada para mostrar o cadeado 🔒
  const privatePartnerByParticipant = new Map<string, string>();
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
  }

  return (
    <div
      onClick={handleCanvasClick}
      className="relative aspect-[16/10] min-h-[460px] w-full cursor-crosshair select-none overflow-hidden rounded-2xl border-4 border-stone-900 bg-[#18181b] shadow-[0_10px_30px_rgba(0,0,0,0.22)]"
    >
      {/* ─── CENÁRIO PIXEL-ART MULTI-AMBIENTES ─── */}
      <svg
        viewBox="0 0 1000 625"
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      >
        <defs>
          {/* Padrão de carpete azul (Atendimento RH) */}
          <pattern id="blueCarpet" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="#2563eb" />
            <rect x="0" y="0" width="10" height="10" fill="#1d4ed8" opacity="0.35" />
            <rect x="10" y="10" width="10" height="10" fill="#1d4ed8" opacity="0.35" />
          </pattern>

          {/* Padrão de piso verde quadriculado (Café & Jogos) */}
          <pattern id="mintTile" width="24" height="24" patternUnits="userSpaceOnUse">
            <rect width="24" height="24" fill="#34d399" />
            <rect width="23" height="23" fill="#4ade80" opacity="0.45" />
            <rect x="0" y="23" width="24" height="1" fill="#059669" opacity="0.4" />
            <rect x="23" y="0" width="1" height="24" fill="#059669" opacity="0.4" />
          </pattern>

          {/* Padrão de piso de madeira (Recepção central) */}
          <pattern id="woodFloor" width="32" height="16" patternUnits="userSpaceOnUse">
            <rect width="32" height="16" fill="#f6d399" />
            <rect x="0" y="0" width="32" height="2" fill="#e2b472" />
            <rect x="16" y="2" width="2" height="14" fill="#e2b472" />
          </pattern>

          {/* Padrão de piso Diretoria VIP */}
          <pattern id="vipTile" width="24" height="24" patternUnits="userSpaceOnUse">
            <rect width="24" height="24" fill="#3b9c7c" />
            <rect width="22" height="22" fill="#4fb391" />
          </pattern>
        </defs>

        {/* Fundo base de madeira central (Recepção & corredores) */}
        <rect x="0" y="0" width="1000" height="625" fill="url(#woodFloor)" />

        {/* 1. SALA SUP. ESQUERDA: BALCÕES DE ATENDIMENTO RH */}
        <rect x="16" y="16" width="450" height="284" fill="url(#blueCarpet)" stroke="#1e293b" strokeWidth="6" />
        {/* Paredes celestes superiores */}
        <rect x="16" y="16" width="450" height="36" fill="#bae6fd" stroke="#1e293b" strokeWidth="4" />
        {/* Porta aberta para a Recepção */}
        <rect x="360" y="294" width="76" height="12" fill="url(#woodFloor)" />

        {/* Tapete circular bege + 4 sofás coloridos (igual à referência!) */}
        <circle cx="265" cy="192" r="68" fill="#d6b588" stroke="#a68458" strokeWidth="6" />
        <circle cx="265" cy="192" r="44" fill="#e7cba4" stroke="#b8976c" strokeWidth="4" />
        {/* Sofá Laranja */}
        <rect x="172" y="138" width="54" height="28" rx="4" fill="#f97316" stroke="#18181b" strokeWidth="3" />
        <rect x="176" y="142" width="46" height="12" fill="#fb923c" />
        {/* Sofá Azul */}
        <rect x="304" y="138" width="54" height="28" rx="4" fill="#0284c7" stroke="#18181b" strokeWidth="3" />
        <rect x="308" y="142" width="46" height="12" fill="#38bdf8" />
        {/* Sofá Verde */}
        <rect x="172" y="216" width="54" height="28" rx="4" fill="#22c55e" stroke="#18181b" strokeWidth="3" />
        <rect x="176" y="220" width="46" height="12" fill="#4ade80" />
        {/* Sofá Roxo */}
        <rect x="304" y="216" width="54" height="28" rx="4" fill="#a855f7" stroke="#18181b" strokeWidth="3" />
        <rect x="308" y="220" width="46" height="12" fill="#c084fc" />

        {/* 3 Estações de Atendimento RH com Monitores (Balcão 1, 2 e 3) */}
        {[
          { x: 44, y: 66, label: "B1" },
          { x: 148, y: 66, label: "B2" },
          { x: 356, y: 66, label: "B3" },
        ].map((desk, i) => (
          <g key={i}>
            {/* Mesa de madeira */}
            <rect x={desk.x} y={desk.y} width="78" height="34" fill="#b45309" stroke="#18181b" strokeWidth="3" />
            <rect x={desk.x + 4} y={desk.y + 4} width="70" height="22" fill="#d97706" />
            {/* Monitor Pixel */}
            <rect x={desk.x + 22} y={desk.y - 12} width="34" height="22" fill="#1e293b" stroke="#0f172a" strokeWidth="3" />
            <rect x={desk.x + 26} y={desk.y - 8} width="26" height="14" fill="#38bdf8" />
            {/* Cadeira */}
            <rect x={desk.x + 26} y={desk.y + 38} width="26" height="16" rx="3" fill="#7c3aed" stroke="#18181b" strokeWidth="3" />
          </g>
        ))}

        {/* Plantas decorativas */}
        <circle cx="436" cy="264" r="16" fill="#ea580c" stroke="#18181b" strokeWidth="3" />
        <circle cx="436" cy="252" r="20" fill="#16a34a" stroke="#18181b" strokeWidth="3" />

        {/* 2. SALA SUP. DIREITA: CAFÉ & NETWORKING */}
        <rect x="534" y="16" width="450" height="284" fill="url(#mintTile)" stroke="#1e293b" strokeWidth="6" />
        <rect x="534" y="16" width="450" height="36" fill="#bbf7d0" stroke="#1e293b" strokeWidth="4" />
        {/* Porta aberta para a Recepção */}
        <rect x="564" y="294" width="76" height="12" fill="url(#woodFloor)" />

        {/* Balcão de Café Expresso & Máquinas */}
        <rect x="564" y="58" width="120" height="44" fill="#78350f" stroke="#18181b" strokeWidth="3" />
        <rect x="572" y="42" width="38" height="30" fill="#334155" stroke="#18181b" strokeWidth="3" />
        <rect x="622" y="40" width="42" height="32" fill="#ea580c" stroke="#18181b" strokeWidth="3" />
        {/* Balcão Bar com Banquetas */}
        <rect x="716" y="64" width="180" height="42" fill="#b45309" stroke="#18181b" strokeWidth="3" />
        <rect x="722" y="70" width="168" height="26" fill="#d97706" />
        <circle cx="746" cy="122" r="11" fill="#78350f" stroke="#18181b" strokeWidth="3" />
        <circle cx="796" cy="122" r="11" fill="#78350f" stroke="#18181b" strokeWidth="3" />
        <circle cx="846" cy="122" r="11" fill="#78350f" stroke="#18181b" strokeWidth="3" />
        {/* Bebedouro */}
        <rect x="916" y="56" width="32" height="52" fill="#e2e8f0" stroke="#18181b" strokeWidth="3" />
        <rect x="920" y="34" width="24" height="24" rx="4" fill="#38bdf8" stroke="#18181b" strokeWidth="3" />

        {/* Mesinhas do Café */}
        {[
          { x: 690, y: 196 },
          { x: 825, y: 196 },
        ].map((tbl, i) => (
          <g key={i}>
            <rect x={tbl.x - 28} y={tbl.y} width="20" height="22" fill="#9a3412" stroke="#18181b" strokeWidth="3" />
            <rect x={tbl.x + 56} y={tbl.y} width="20" height="22" fill="#9a3412" stroke="#18181b" strokeWidth="3" />
            <rect x={tbl.x} y={tbl.y - 8} width="48" height="38" fill="#d97706" stroke="#18181b" strokeWidth="3" />
            <circle cx={tbl.x + 16} cy={tbl.y + 8} r="5" fill="#ffffff" />
            <circle cx={tbl.x + 34} cy={tbl.y + 14} r="5" fill="#fef08a" />
          </g>
        ))}

        {/* 3. CENTRO: RECEPÇÃO & SALA DE ESPERA */}
        {/* Roda de Sofás Central */}
        <rect x="415" y="268" width="76" height="32" rx="4" fill="#f97316" stroke="#18181b" strokeWidth="3" />
        <rect x="515" y="268" width="76" height="32" rx="4" fill="#f97316" stroke="#18181b" strokeWidth="3" />
        <rect x="454" y="314" width="92" height="38" fill="#b45309" stroke="#18181b" strokeWidth="3" />
        <rect x="408" y="356" width="56" height="32" rx="4" fill="#0284c7" stroke="#18181b" strokeWidth="3" />
        <rect x="478" y="362" width="52" height="32" rx="4" fill="#e11d48" stroke="#18181b" strokeWidth="3" />
        <rect x="544" y="356" width="52" height="32" rx="4" fill="#eab308" stroke="#18181b" strokeWidth="3" />

        {/* 4. SALA INF. ESQUERDA: SALA DE JOGOS & ARCADE */}
        <rect x="16" y="340" width="368" height="268" fill="url(#mintTile)" stroke="#1e293b" strokeWidth="6" />
        <rect x="16" y="340" width="368" height="32" fill="#fdba74" stroke="#1e293b" strokeWidth="4" />
        <rect x="378" y="430" width="12" height="72" fill="url(#woodFloor)" />

        {/* 3 Fliperamas (Roxo, Amarelo, Azul — igual à referência!) */}
        {[
          { x: 42, body: "#9333ea", trim: "#c084fc" },
          { x: 104, body: "#f59e0b", trim: "#fde047" },
          { x: 166, body: "#0284c7", trim: "#38bdf8" },
        ].map((arc, i) => (
          <g key={i}>
            <rect x={arc.x} y="368" width="48" height="76" fill={arc.body} stroke="#18181b" strokeWidth="3" />
            <rect x={arc.x + 6} y="376" width="36" height="12" fill={arc.trim} />
            <rect x={arc.x + 8} y="392" width="32" height="24" fill="#0f172a" stroke="#18181b" strokeWidth="2" />
            <rect x={arc.x + 12} y="396" width="24" height="16" fill="#38bdf8" />
            <circle cx={arc.x + 16} cy="424" r="3" fill="#ef4444" />
            <circle cx={arc.x + 28} cy="424" r="3" fill="#fde047" />
          </g>
        ))}

        {/* Mesa de Sinuca */}
        <rect x="148" y="486" width="136" height="74" rx="6" fill="#78350f" stroke="#18181b" strokeWidth="4" />
        <rect x="158" y="496" width="116" height="54" fill="#15803d" stroke="#14532d" strokeWidth="3" />
        <circle cx="195" cy="520" r="4" fill="#ffffff" />
        <circle cx="230" cy="526" r="4" fill="#facc15" />
        <circle cx="238" cy="516" r="4" fill="#ef4444" />

        {/* 5. SALA INF. DIREITA: DIRETORIA & LOUNGE VIP */}
        <rect x="616" y="340" width="368" height="268" fill="url(#vipTile)" stroke="#1e293b" strokeWidth="6" />
        <rect x="616" y="340" width="368" height="32" fill="#d8b4fe" stroke="#1e293b" strokeWidth="4" />
        <rect x="610" y="430" width="12" height="72" fill="url(#woodFloor)" />

        {/* Sofá Executivo Vermelho + Sofá Azul + Mesa */}
        <rect x="652" y="396" width="88" height="36" rx="5" fill="#e11d48" stroke="#18181b" strokeWidth="3" />
        <rect x="862" y="396" width="88" height="36" rx="5" fill="#0284c7" stroke="#18181b" strokeWidth="3" />
        <rect x="736" y="484" width="128" height="68" fill="#166534" stroke="#18181b" strokeWidth="4" />
        <line x1="800" y1="484" x2="800" y2="552" stroke="#ffffff" strokeWidth="3" />
        <rect x="854" y="564" width="96" height="30" rx="5" fill="#9333ea" stroke="#18181b" strokeWidth="3" />

        {/* Linhas pontilhadas douradas ligando duplas em conversa privada */}
        {activePrivatePairs.map((pair) => {
          const u1 = users.find((u) => u.participantId === pair.requesterId);
          const u2 = users.find((u) => u.participantId === pair.responderId);
          if (!u1 || !u2) return null;
          return (
            <line
              key={pair.conversationId}
              x1={u1.x * 10}
              y1={u1.y * 6.25 - 18}
              x2={u2.x * 10}
              y2={u2.y * 6.25 - 18}
              stroke="#fbbf24"
              strokeWidth="3"
              strokeDasharray="8 6"
            />
          );
        })}
      </svg>

      {/* ─── PLACAS INTERATIVAS DAS SALAS NO MAPA ─── */}
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-lg border-2 border-stone-900 bg-sky-100/95 px-2.5 py-1 text-[11px] font-extrabold text-sky-950 shadow-[0_2px_0_#18181b]">
        <span>🎧</span>
        <span>Atendimento RH (Balcões 1, 2 e 3)</span>
      </div>

      <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-1.5 rounded-lg border-2 border-stone-900 bg-emerald-100/95 px-2.5 py-1 text-[11px] font-extrabold text-emerald-950 shadow-[0_2px_0_#18181b]">
        <span>☕</span>
        <span>Café & Networking</span>
      </div>

      {/* Totem Interativo de Senha na Recepção Central */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenQueuePanel();
        }}
        className="absolute left-1/2 top-[36%] z-20 flex -translate-x-1/2 items-center gap-2 rounded-xl border-2 border-stone-900 bg-amber-400 px-3 py-1.5 text-[11px] font-extrabold text-stone-950 shadow-[0_3px_0_#18181b] transition hover:scale-105 hover:bg-amber-300"
      >
        <span>🛋️ Recepção · Retirar Senha RH</span>
        <span className="rounded-md bg-stone-900 px-1.5 py-0.5 text-[10px] text-amber-300">
          {queueCount} na fila
        </span>
      </button>

      {/* Botão Interativo dos Fliperamas na Sala de Jogos */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenArcadeQuiz();
        }}
        className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 rounded-xl border-2 border-stone-900 bg-purple-600 px-3 py-1.5 text-[11px] font-extrabold text-white shadow-[0_3px_0_#18181b] transition hover:scale-105 hover:bg-purple-500"
      >
        <span>🎮 Sala de Jogos · Jogar Quiz Arcade</span>
      </button>

      <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg border-2 border-stone-900 bg-purple-100/95 px-2.5 py-1 text-[11px] font-extrabold text-purple-950 shadow-[0_2px_0_#18181b]">
        <span>🏛️</span>
        <span>Diretoria & Lounge VIP</span>
      </div>

      {/* ─── BONEQUINHOS DOS PARTICIPANTES ONLINE ─── */}
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
