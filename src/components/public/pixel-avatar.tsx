"use client";

import React from "react";
import type { AvatarConfig } from "@/server/models/support.model";
import { Lock } from "lucide-react";

interface PixelAvatarProps {
  avatar: AvatarConfig;
  kind?: "GUEST" | "CANDIDATE" | "STAFF";
  size?: number;
  walking?: boolean;
  className?: string;
}

/**
 * Bonequinho em pixel-art isométrico 32-bit (estilo Habbo Hotel / Gather.town),
 * com contorno pixelado escuro, sombreamento volumétrico, olhos expressivos,
 * estilos de cabelo detalhados e acessórios.
 */
export function PixelAvatarSprite({
  avatar,
  kind = "GUEST",
  size = 58,
  walking = false,
  className = "",
}: PixelAvatarProps) {
  const { skin, hair, hairColor, shirt, pants, accessory } = avatar;

  return (
    <svg
      width={size}
      height={Math.round(size * 1.25)}
      viewBox="0 0 32 40"
      shapeRendering="crispEdges"
      className={`select-none drop-shadow-[0_4px_3px_rgba(0,0,0,0.45)] ${
        walking ? "animate-bounce" : ""
      } ${className}`}
      aria-hidden
    >
      {/* Sombra oval isométrica no piso */}
      <rect x="8" y="36" width="16" height="2" fill="rgba(0,0,0,0.35)" />
      <rect x="6" y="37" width="20" height="1" fill="rgba(0,0,0,0.22)" />

      {/* ─── PERNAS, CALÇA & TÊNIS PIXELADOS ─── */}
      {/* Contorno externo das pernas */}
      <rect x="9" y="27" width="14" height="9" fill="#111827" />
      {/* Perna esquerda */}
      <rect x="10" y="27" width="5" height="7" fill={pants} />
      <rect x="10" y="27" width="1" height="7" fill="rgba(255,255,255,0.14)" />
      {/* Divisória entre pernas */}
      <rect x="15" y="28" width="2" height="8" fill="#111827" />
      {/* Perna direita (sombreada) */}
      <rect x="17" y="27" width="5" height="7" fill={pants} />
      <rect x="20" y="27" width="2" height="7" fill="rgba(0,0,0,0.22)" />
      {/* Sapatos / Tênis */}
      <rect x="9" y="34" width="6" height="2" fill="#18181b" />
      <rect x="10" y="34" width="2" height="1" fill="#f8fafc" />
      <rect x="17" y="34" width="6" height="2" fill="#18181b" />
      <rect x="18" y="34" width="2" height="1" fill="#f8fafc" />

      {/* ─── TORSO, JAQUETA/CAMISA & BRAÇOS ─── */}
      {/* Contorno preto do tronco e braços */}
      <rect x="6" y="18" width="20" height="10" fill="#111827" />
      {/* Braço esquerdo */}
      <rect x="7" y="19" width="3" height="6" fill={shirt} />
      <rect x="7" y="19" width="1" height="6" fill="rgba(255,255,255,0.18)" />
      {/* Mão esquerda */}
      <rect x="7" y="25" width="3" height="2" fill={skin} />
      {/* Braço direito */}
      <rect x="22" y="19" width="3" height="6" fill={shirt} />
      <rect x="24" y="19" width="1" height="6" fill="rgba(0,0,0,0.25)" />
      {/* Mão direita */}
      <rect x="22" y="25" width="3" height="2" fill={skin} />

      {/* Tronco central */}
      <rect x="10" y="18" width="12" height="9" fill={shirt} />
      {/* Luz no ombro esquerdo e sombra na lateral direita */}
      <rect x="10" y="18" width="2" height="8" fill="rgba(255,255,255,0.16)" />
      <rect x="20" y="18" width="2" height="9" fill="rgba(0,0,0,0.22)" />
      {/* Gola / Camiseta interna branca */}
      <rect x="13" y="18" width="6" height="2" fill="#f8fafc" />
      <rect x="14" y="20" width="4" height="1" fill="#e2e8f0" />
      {/* Detalhe vertical de jaqueta / crachá */}
      <rect x="15" y="21" width="2" height="6" fill="rgba(0,0,0,0.18)" />

      {/* Crachá VIP dourado se for STAFF */}
      {kind === "STAFF" && (
        <>
          <rect x="18" y="21" width="3" height="4" fill="#fbbf24" />
          <rect x="19" y="22" width="1" height="2" fill="#78350f" />
        </>
      )}

      {/* ─── CABEÇA & ROSTO ISOMÉTRICO (ESTILO HABBO/GATHER) ─── */}
      {/* Contorno externo da cabeça */}
      <rect x="8" y="5" width="16" height="14" fill="#111827" />
      <rect x="7" y="7" width="18" height="10" fill="#111827" />
      {/* Orelhas */}
      <rect x="8" y="11" width="1" height="3" fill={skin} />
      <rect x="23" y="11" width="1" height="3" fill={skin} />
      {/* Pele do rosto */}
      <rect x="9" y="6" width="14" height="12" fill={skin} />
      {/* Sombra suave no lado direito do rosto */}
      <rect x="21" y="6" width="2" height="12" fill="rgba(0,0,0,0.12)" />
      <rect x="9" y="17" width="14" height="1" fill="rgba(0,0,0,0.15)" />

      {/* Sobrancelhas */}
      <rect x="11" y="10" width="3" height="1" fill={hairColor} />
      <rect x="18" y="10" width="3" height="1" fill={hairColor} />

      {/* Olhos expressivos com brilho branco */}
      <rect x="11" y="11" width="3" height="3" fill="#111827" />
      <rect x="18" y="11" width="3" height="3" fill="#111827" />
      <rect x="11" y="11" width="1" height="1" fill="#ffffff" />
      <rect x="18" y="11" width="1" height="1" fill="#ffffff" />

      {/* Bochechas coradas */}
      <rect x="10" y="14" width="2" height="1" fill="#f43f5e" opacity="0.45" />
      <rect x="20" y="14" width="2" height="1" fill="#f43f5e" opacity="0.45" />

      {/* Sorriso simpático */}
      <rect x="14" y="15" width="4" height="1" fill="#7c2d12" />
      <rect x="15" y="16" width="2" height="1" fill="#f43f5e" opacity="0.55" />

      {/* ─── CAMADAS DE CABELO 32-BIT COM VOLUME ─── */}
      {hair === "curto" && (
        <>
          <rect x="8" y="4" width="16" height="4" fill="#111827" />
          <rect x="9" y="5" width="14" height="4" fill={hairColor} />
          <rect x="11" y="5" width="6" height="1" fill="rgba(255,255,255,0.22)" />
          <rect x="8" y="7" width="2" height="4" fill={hairColor} />
          <rect x="22" y="7" width="2" height="4" fill={hairColor} />
        </>
      )}

      {hair === "topete" && (
        <>
          <rect x="8" y="2" width="16" height="6" fill="#111827" />
          <rect x="10" y="2" width="13" height="3" fill={hairColor} />
          <rect x="9" y="4" width="14" height="5" fill={hairColor} />
          <rect x="11" y="3" width="7" height="2" fill="rgba(255,255,255,0.25)" />
          <rect x="8" y="7" width="2" height="4" fill={hairColor} />
          <rect x="22" y="7" width="2" height="4" fill={hairColor} />
        </>
      )}

      {hair === "longo" && (
        <>
          <rect x="7" y="3" width="18" height="5" fill="#111827" />
          <rect x="8" y="4" width="16" height="5" fill={hairColor} />
          <rect x="11" y="4" width="7" height="2" fill="rgba(255,255,255,0.22)" />
          <rect x="6" y="7" width="3" height="13" fill="#111827" />
          <rect x="7" y="7" width="2" height="12" fill={hairColor} />
          <rect x="23" y="7" width="3" height="13" fill="#111827" />
          <rect x="23" y="7" width="2" height="12" fill={hairColor} />
        </>
      )}

      {hair === "cacheado" && (
        <>
          <rect x="6" y="2" width="20" height="7" fill="#111827" />
          <rect x="7" y="3" width="18" height="6" fill={hairColor} />
          <rect x="10" y="3" width="8" height="2" fill="rgba(255,255,255,0.2)" />
          <rect x="5" y="6" width="4" height="9" fill="#111827" />
          <rect x="6" y="7" width="3" height="7" fill={hairColor} />
          <rect x="23" y="6" width="4" height="9" fill="#111827" />
          <rect x="23" y="7" width="3" height="7" fill={hairColor} />
        </>
      )}

      {hair === "coque" && (
        <>
          <rect x="11" y="0" width="10" height="5" fill="#111827" />
          <rect x="12" y="1" width="8" height="4" fill={hairColor} />
          <rect x="13" y="1" width="4" height="1" fill="rgba(255,255,255,0.25)" />
          <rect x="8" y="4" width="16" height="5" fill={hairColor} />
          <rect x="8" y="7" width="2" height="4" fill={hairColor} />
          <rect x="22" y="7" width="2" height="4" fill={hairColor} />
        </>
      )}

      {/* ─── ACESSÓRIOS PIXEL-ART (HEADSET, ÓCULOS, BONÉ) ─── */}
      {accessory === "headset" && (
        <>
          {/* Arco do headphone */}
          <rect x="7" y="3" width="18" height="2" fill="#38bdf8" />
          <rect x="10" y="3" width="12" height="1" fill="#bae6fd" />
          {/* Conchas auriculares */}
          <rect x="5" y="8" width="3" height="6" fill="#111827" />
          <rect x="6" y="9" width="2" height="4" fill="#0284c7" />
          <rect x="24" y="8" width="3" height="6" fill="#111827" />
          <rect x="24" y="9" width="2" height="4" fill="#0284c7" />
          {/* Microfone */}
          <rect x="7" y="14" width="5" height="1" fill="#1e293b" />
          <rect x="11" y="14" width="2" height="2" fill="#38bdf8" />
        </>
      )}

      {accessory === "glasses" && (
        <>
          <rect x="9" y="10" width="6" height="4" fill="#111827" />
          <rect x="15" y="11" width="2" height="1" fill="#111827" />
          <rect x="17" y="10" width="6" height="4" fill="#111827" />
          <rect x="10" y="11" width="4" height="2" fill="#38bdf8" opacity="0.75" />
          <rect x="18" y="11" width="4" height="2" fill="#38bdf8" opacity="0.75" />
          <rect x="10" y="11" width="1" height="1" fill="#ffffff" />
          <rect x="18" y="11" width="1" height="1" fill="#ffffff" />
        </>
      )}

      {accessory === "cap" && (
        <>
          <rect x="7" y="2" width="18" height="5" fill="#111827" />
          <rect x="8" y="3" width="16" height="4" fill="#d97706" />
          <rect x="10" y="3" width="8" height="2" fill="#fbbf24" />
          {/* Aba do boné */}
          <rect x="8" y="6" width="19" height="2" fill="#111827" />
          <rect x="9" y="6" width="17" height="1" fill="#b45309" />
        </>
      )}
    </svg>
  );
}

interface MapAvatarNodeProps {
  id: string;
  displayName: string;
  kind: "GUEST" | "CANDIDATE" | "STAFF";
  avatar: AvatarConfig;
  x: number;
  y: number;
  isMe?: boolean;
  isAmbientNpc?: boolean;
  bubbleText?: string | null;
  reactionEmoji?: string | null;
  inPrivateChat?: boolean;
  privatePartnerName?: string | null;
  onSelect?: () => void;
}

/**
 * Bonequinho posicionado no mapa isométrico com balão estilo Habbo/Gather,
 * ícone de reação flutuante (❤️, 🎵, ☕, ❗ igual à imagem de referência) e
 * cadeado privado 🔒 visível para todos na sala.
 */
export function MapAvatarNode({
  displayName,
  kind,
  avatar,
  x,
  y,
  isMe = false,
  isAmbientNpc = false,
  bubbleText,
  reactionEmoji,
  inPrivateChat = false,
  privatePartnerName,
  onSelect,
}: MapAvatarNodeProps) {
  return (
    <div
      style={{
        left: `${x}%`,
        top: `${y}%`,
        zIndex: Math.round(y) + (bubbleText ? 50 : 15),
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      className="group absolute -translate-x-1/2 -translate-y-full cursor-pointer transition-all duration-500 ease-out"
    >
      {/* Balão de fala público (nuvem estilo Habbo / Mortadela) */}
      {bubbleText && (
        <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-50 w-max max-w-[220px] -translate-x-1/2 animate-in fade-in zoom-in-95 duration-150">
          <div
            className={`relative rounded-xl border-[2.5px] px-3 py-1.5 text-center text-[11px] font-extrabold leading-snug shadow-[0_4px_0_rgba(0,0,0,0.45)] ${
              kind === "STAFF"
                ? "border-stone-950 bg-amber-300 text-stone-950"
                : "border-stone-950 bg-white text-stone-950"
            }`}
          >
            <span className="block break-words">{bubbleText}</span>
            <span
              className={`absolute -bottom-1.5 left-1/2 size-2.5 -translate-x-1/2 rotate-45 border-b-[2.5px] border-r-[2.5px] border-stone-950 ${
                kind === "STAFF" ? "bg-amber-300" : "bg-white"
              }`}
            />
          </div>
        </div>
      )}

      {/* Balãozinho quadrado pixel-art de reação (❤️, 🎵, ☕, 💡 idêntico à referência!) */}
      {!bubbleText && reactionEmoji && (
        <div className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-40 -translate-x-1/2 animate-bounce">
          <div className="relative flex items-center justify-center rounded-lg border-[2.5px] border-stone-950 bg-white px-2 py-0.5 text-sm shadow-[0_3px_0_rgba(0,0,0,0.4)]">
            <span>{reactionEmoji}</span>
            <span className="absolute -bottom-1.5 left-1/2 size-2 -translate-x-1/2 rotate-45 border-b-[2.5px] border-r-[2.5px] border-stone-950 bg-white" />
          </div>
        </div>
      )}

      {/* Selo de Conversa Privada (🔒 visível para todos sem expor as mensagens) */}
      {inPrivateChat && (
        <div
          title={
            privatePartnerName
              ? `Em conversa privada com ${privatePartnerName}`
              : "Em conversa privada"
          }
          className="pointer-events-none absolute -top-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full border-2 border-amber-400 bg-stone-950 px-2 py-0.5 text-[9px] font-black text-amber-300 shadow-[0_2px_0_#000]"
        >
          <Lock className="size-2.5" />
          <span>Privado</span>
        </div>
      )}

      {/* Anel luminoso isométrico sob os pés do jogador atual */}
      {isMe && (
        <span className="pointer-events-none absolute bottom-3 left-1/2 h-4 w-12 -translate-x-1/2 rounded-full border-2 border-emerald-400 bg-emerald-400/30 shadow-[0_0_12px_rgba(52,211,153,0.7)] animate-pulse" />
      )}

      {/* Sprite Pixel-Art */}
      <div className="transition-transform duration-150 group-hover:-translate-y-1 group-hover:scale-110">
        <PixelAvatarSprite avatar={avatar} kind={kind} size={isAmbientNpc ? 50 : 54} />
      </div>

      {/* Plaquinha de nome em estilo jogo isométrico */}
      <div className="-mt-1 flex flex-col items-center">
        <div
          className={`flex items-center gap-1 whitespace-nowrap rounded-md border-[1.5px] px-1.5 py-0.5 text-[10px] font-extrabold shadow-[0_2px_0_rgba(0,0,0,0.5)] ${
            kind === "STAFF"
              ? "border-amber-400 bg-stone-950 text-amber-300"
              : isMe
                ? "border-emerald-400 bg-emerald-950 text-emerald-100"
                : isAmbientNpc
                  ? "border-stone-700 bg-stone-900/80 text-stone-200"
                  : "border-stone-950 bg-stone-900/95 text-white"
          }`}
        >
          {kind === "STAFF" && <span title="Equipe RH / Admin">👑</span>}
          {kind === "CANDIDATE" && (
            <span className="text-emerald-400" title="Candidato Cadastrado">
              ✓
            </span>
          )}
          <span className="max-w-[100px] truncate">{displayName}</span>
        </div>
      </div>
    </div>
  );
}
