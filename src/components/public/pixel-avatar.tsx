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
 * Bonequinho em pixel-art visto de cima/2.5D (estilo Habbo / Gather),
 * com camadas personalizáveis de pele, cabelo, camisa, calça e acessório.
 */
export function PixelAvatarSprite({
  avatar,
  kind = "GUEST",
  size = 54,
  walking = false,
  className = "",
}: PixelAvatarProps) {
  const { skin, hair, hairColor, shirt, pants, accessory } = avatar;

  return (
    <svg
      width={size}
      height={size * 1.18}
      viewBox="0 0 24 28"
      shapeRendering="crispEdges"
      className={`select-none drop-shadow-[0_3px_2px_rgba(0,0,0,0.28)] ${
        walking ? "animate-bounce" : ""
      } ${className}`}
      aria-hidden
    >
      {/* Sombra no chão */}
      <rect x="6" y="25" width="12" height="2" fill="rgba(0,0,0,0.28)" />
      <rect x="5" y="26" width="14" height="1" fill="rgba(0,0,0,0.16)" />

      {/* Calça e sapatos */}
      <rect x="8" y="20" width="3" height="5" fill={pants} />
      <rect x="13" y="20" width="3" height="5" fill={pants} />
      <rect x="7" y="24" width="4" height="2" fill="#18181b" />
      <rect x="13" y="24" width="4" height="2" fill="#18181b" />

      {/* Camisa / Torso + contorno pixel */}
      <rect x="6" y="13" width="12" height="8" fill="#18181b" />
      <rect x="7" y="14" width="10" height="6" fill={shirt} />
      {/* Gola */}
      <rect x="10" y="14" width="4" height="1" fill="#ffffff" />
      {/* Gravata/Crachá dourado se for Equipe RH */}
      {kind === "STAFF" && (
        <>
          <rect x="11" y="15" width="2" height="4" fill="#fbbf24" />
          <rect x="14" y="16" width="2" height="2" fill="#fef08a" />
        </>
      )}

      {/* Braços e mãos */}
      <rect x="5" y="14" width="2" height="5" fill={shirt} />
      <rect x="17" y="14" width="2" height="5" fill={shirt} />
      <rect x="5" y="18" width="2" height="2" fill={skin} />
      <rect x="17" y="18" width="2" height="2" fill={skin} />

      {/* Cabeça (contorno escuro + pele) */}
      <rect x="6" y="4" width="12" height="10" fill="#18181b" />
      <rect x="7" y="5" width="10" height="8" fill={skin} />

      {/* Bochechas e olhos */}
      <rect x="8" y="10" width="2" height="1" fill="#f43f5e" opacity="0.45" />
      <rect x="14" y="10" width="2" height="1" fill="#f43f5e" opacity="0.45" />
      <rect x="9" y="8" width="2" height="2" fill="#18181b" />
      <rect x="13" y="8" width="2" height="2" fill="#18181b" />
      <rect x="9" y="8" width="1" height="1" fill="#ffffff" />
      <rect x="13" y="8" width="1" height="1" fill="#ffffff" />
      {/* Sorriso */}
      <rect x="11" y="11" width="2" height="1" fill="#7c2d12" />

      {/* Estilos de cabelo */}
      {hair === "curto" && (
        <>
          <rect x="6" y="3" width="12" height="3" fill={hairColor} />
          <rect x="6" y="5" width="2" height="3" fill={hairColor} />
          <rect x="16" y="5" width="2" height="3" fill={hairColor} />
        </>
      )}
      {hair === "topete" && (
        <>
          <rect x="7" y="1" width="11" height="3" fill={hairColor} />
          <rect x="6" y="3" width="12" height="3" fill={hairColor} />
          <rect x="6" y="5" width="2" height="2" fill={hairColor} />
        </>
      )}
      {hair === "longo" && (
        <>
          <rect x="6" y="2" width="12" height="4" fill={hairColor} />
          <rect x="5" y="5" width="2" height="9" fill={hairColor} />
          <rect x="17" y="5" width="2" height="9" fill={hairColor} />
        </>
      )}
      {hair === "cacheado" && (
        <>
          <rect x="5" y="2" width="14" height="4" fill={hairColor} />
          <rect x="4" y="5" width="3" height="6" fill={hairColor} />
          <rect x="17" y="5" width="3" height="6" fill={hairColor} />
        </>
      )}
      {hair === "coque" && (
        <>
          <rect x="9" y="0" width="6" height="3" fill={hairColor} />
          <rect x="6" y="3" width="12" height="3" fill={hairColor} />
        </>
      )}

      {/* Acessórios */}
      {accessory === "headset" && (
        <>
          <rect x="5" y="3" width="14" height="1" fill="#38bdf8" />
          <rect x="4" y="4" width="2" height="6" fill="#0284c7" />
          <rect x="18" y="4" width="2" height="6" fill="#0284c7" />
          <rect x="6" y="11" width="4" height="1" fill="#0f172a" />
        </>
      )}
      {accessory === "glasses" && (
        <>
          <rect x="8" y="8" width="3" height="2" fill="#0f172a" opacity="0.85" />
          <rect x="11" y="8" width="2" height="1" fill="#0f172a" />
          <rect x="13" y="8" width="3" height="2" fill="#0f172a" opacity="0.85" />
          <rect x="9" y="8" width="1" height="1" fill="#bae6fd" />
          <rect x="14" y="8" width="1" height="1" fill="#bae6fd" />
        </>
      )}
      {accessory === "cap" && (
        <>
          <rect x="6" y="2" width="12" height="3" fill="#e11d48" />
          <rect x="6" y="4" width="15" height="2" fill="#be123c" />
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
  bubbleText?: string | null;
  reactionEmoji?: string | null;
  inPrivateChat?: boolean;
  privatePartnerName?: string | null;
  onSelect?: () => void;
}

/**
 * Bonequinho posicionado no mapa com balão de nuvem pública, reação rápida e
 * indicador de conversa privada (🔒 visível para todos sem expor o texto).
 */
export function MapAvatarNode({
  displayName,
  kind,
  avatar,
  x,
  y,
  isMe = false,
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
        zIndex: Math.round(y) + (bubbleText ? 40 : 10),
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      className="group absolute -translate-x-1/2 -translate-y-full cursor-pointer transition-all duration-500 ease-out"
    >
      {/* Balão de fala público (nuvem estilo Mortadela / Gather) */}
      {bubbleText && (
        <div className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-50 w-max max-w-[210px] -translate-x-1/2 animate-in fade-in zoom-in-95 duration-200">
          <div
            className={`relative rounded-2xl border-2 px-3 py-1.5 text-center text-[11px] font-bold leading-snug shadow-[0_4px_0_rgba(0,0,0,0.22)] ${
              kind === "STAFF"
                ? "border-amber-500 bg-amber-50 text-amber-950"
                : "border-stone-900 bg-white text-stone-900"
            }`}
          >
            <span className="block break-words">{bubbleText}</span>
            <span
              className={`absolute -bottom-1.5 left-1/2 size-2.5 -translate-x-1/2 rotate-45 border-b-2 border-r-2 ${
                kind === "STAFF"
                  ? "border-amber-500 bg-amber-50"
                  : "border-stone-900 bg-white"
              }`}
            />
          </div>
        </div>
      )}

      {/* Reação rápida flutuante (❤️, 🎵, 💡 igual à referência) */}
      {!bubbleText && reactionEmoji && (
        <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-40 -translate-x-1/2 animate-bounce">
          <div className="flex items-center justify-center rounded-xl border-2 border-stone-900 bg-white px-2 py-0.5 text-base shadow-[0_3px_0_rgba(0,0,0,0.25)]">
            {reactionEmoji}
          </div>
        </div>
      )}

      {/* Cadeado visível para todos quando em conversa privada */}
      {inPrivateChat && (
        <div
          title={
            privatePartnerName
              ? `Em conversa privada com ${privatePartnerName}`
              : "Em conversa privada"
          }
          className="pointer-events-none absolute -top-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full border border-amber-400 bg-stone-900/95 px-2 py-0.5 text-[9px] font-bold text-amber-300 shadow-md"
        >
          <Lock className="size-2.5" />
          <span>Privado</span>
        </div>
      )}

      {/* Halo sob os pés se for o próprio usuário */}
      {isMe && (
        <span className="pointer-events-none absolute bottom-1 left-1/2 h-3.5 w-11 -translate-x-1/2 rounded-full border-2 border-emerald-400 bg-emerald-400/25 animate-pulse" />
      )}

      {/* Bonequinho Pixel-Art */}
      <div className="transition-transform group-hover:scale-110">
        <PixelAvatarSprite avatar={avatar} kind={kind} size={48} />
      </div>

      {/* Etiqueta de nome e selo */}
      <div className="mt-0.5 flex flex-col items-center">
        <div
          className={`flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] font-bold shadow-xs ${
            kind === "STAFF"
              ? "border-amber-400 bg-amber-950 text-amber-200"
              : isMe
                ? "border-emerald-500 bg-emerald-950 text-emerald-100"
                : "border-stone-800 bg-stone-900/90 text-white"
          }`}
        >
          {kind === "STAFF" && <span title="Equipe RH / Admin">👑</span>}
          {kind === "CANDIDATE" && (
            <span className="text-emerald-400" title="Candidato Cadastrado">
              ✓
            </span>
          )}
          <span className="max-w-[96px] truncate">{displayName}</span>
        </div>
      </div>
    </div>
  );
}
