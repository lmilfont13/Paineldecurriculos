"use client";

import { useCallback, useEffect, useState } from "react";
import { Headphones, HeadphoneOff, MessageSquare } from "lucide-react";

export const LIVE_ATTENDANCE_STORAGE_KEY = "triagem_live_attendance_active";
export const LIVE_ATTENDANCE_EVENT_NAME = "triagem:attendance-toggle";
export const LIVE_ATTENDANCE_BC_CHANNEL = "triagem_radio_sync";

export function getStoredLiveAttendance(): boolean {
  if (typeof window === "undefined" && typeof localStorage === "undefined") return true;
  try {
    const storage = typeof localStorage !== "undefined" ? localStorage : window?.localStorage;
    const stored = storage?.getItem(LIVE_ATTENDANCE_STORAGE_KEY);
    return stored !== "false";
  } catch {
    return true;
  }
}

export function setStoredLiveAttendance(val: boolean): void {
  try {
    const storage = typeof localStorage !== "undefined" ? localStorage : typeof window !== "undefined" ? window.localStorage : null;
    storage?.setItem(LIVE_ATTENDANCE_STORAGE_KEY, val ? "true" : "false");
  } catch {}
}

/**
 * Hook compartilhado para gerenciar o estado do atendimento ao vivo do gestor.
 * Sincroniza em tempo real entre todas as abas, botões e widgets da aplicação.
 */
export function useLiveAttendance() {
  const [isAttendanceActive, setIsActiveState] = useState<boolean>(() => {
    return getStoredLiveAttendance();
  });

  // Atualiza e propaga para todas as abas e componentes
  const setAttendanceActive = useCallback((val: boolean) => {
    setIsActiveState(val);
    setStoredLiveAttendance(val);

    // Notifica componentes na mesma janela
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(LIVE_ATTENDANCE_EVENT_NAME, { detail: { active: val } })
      );
    }

    // Notifica abas do mesmo navegador (candidatos e outros painéis)
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        const bc = new BroadcastChannel(LIVE_ATTENDANCE_BC_CHANNEL);
        bc.postMessage({
          type: "admin_attendance_toggle",
          active: val,
          role: val ? "equipe" : "equipe_idle",
          timestamp: Date.now(),
        });
        if (!val) {
          // Quando desligado, envia bye para limpar o status online imediatamente
          bc.postMessage({
            type: "admin_presence_bye",
            role: "equipe",
            timestamp: Date.now(),
          });
        } else {
          // Quando ligado, envia ping imediato
          bc.postMessage({
            type: "admin_presence_ping",
            role: "equipe",
            timestamp: Date.now(),
          });
        }
        bc.close();
      } catch {}
    }
  }, []);

  const toggleAttendance = useCallback(() => {
    setAttendanceActive(!isAttendanceActive);
  }, [isAttendanceActive, setAttendanceActive]);

  // Escuta eventos locais e remotos
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleLocalEvent = (e: Event) => {
      const custom = e as CustomEvent<{ active: boolean }>;
      if (custom.detail && typeof custom.detail.active === "boolean") {
        setIsActiveState(custom.detail.active);
      }
    };
    window.addEventListener(LIVE_ATTENDANCE_EVENT_NAME, handleLocalEvent);

    let bc: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      try {
        bc = new BroadcastChannel(LIVE_ATTENDANCE_BC_CHANNEL);
        bc.onmessage = (e) => {
          if (e.data && e.data.type === "admin_attendance_toggle") {
            if (typeof e.data.active === "boolean") {
              setIsActiveState(e.data.active);
            }
          }
        };
      } catch {}
    }

    return () => {
      window.removeEventListener(LIVE_ATTENDANCE_EVENT_NAME, handleLocalEvent);
      if (bc) {
        try {
          bc.close();
        } catch {}
      }
    };
  }, []);

  return {
    isAttendanceActive,
    toggleAttendance,
    setAttendanceActive,
  };
}

/**
 * Botão de acesso rápido no Topbar do Gestor para ligar e desligar o atendimento com 1 clique.
 */
export function LiveAttendanceTopbarButton() {
  const { isAttendanceActive, toggleAttendance } = useLiveAttendance();

  return (
    <button
      type="button"
      onClick={toggleAttendance}
      title={
        isAttendanceActive
          ? "Atendimento Ao Vivo: LIGADO. Candidatos podem tirar dúvidas ao vivo. Clique para desligar/pausar."
          : "Atendimento Ao Vivo: DESLIGADO. Candidatos verão mensagem assíncrona. Clique para ligar."
      }
      className={`group flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition active:scale-95 ${
        isAttendanceActive
          ? "border border-emerald-300 bg-emerald-50 text-emerald-950 hover:bg-emerald-100 hover:border-emerald-400 shadow-2xs"
          : "border border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80 hover:text-zinc-900"
      }`}
    >
      {isAttendanceActive ? (
        <>
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <Headphones className="size-3.5 text-emerald-600" />
          <span className="hidden sm:inline">Atendimento ON</span>
          <span className="sm:hidden">ON</span>
        </>
      ) : (
        <>
          <span className="size-2 rounded-full bg-zinc-400 shrink-0" />
          <HeadphoneOff className="size-3.5 text-zinc-400 group-hover:text-zinc-600" />
          <span className="hidden sm:inline text-zinc-500 group-hover:text-zinc-800">Atendimento OFF</span>
          <span className="sm:hidden text-zinc-500">OFF</span>
        </>
      )}
    </button>
  );
}

/**
 * Linha de alternância / switch interativo para o Popover de Presença e Dúvidas.
 */
export function LiveAttendanceSwitchRow() {
  const { isAttendanceActive, toggleAttendance } = useLiveAttendance();

  return (
    <div className="flex items-center justify-between rounded-xl border border-[#e4e4e7] bg-[#fafaf9] p-3 transition hover:border-[#d4d4d8]">
      <div className="flex items-center gap-2.5 min-w-0 pr-3">
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
            isAttendanceActive ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-500"
          }`}
        >
          {isAttendanceActive ? (
            <Headphones className="size-4" />
          ) : (
            <HeadphoneOff className="size-4" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#0a0a0a]">
              Atendimento Ao Vivo
            </span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${
                isAttendanceActive
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-zinc-200 text-zinc-600"
              }`}
            >
              {isAttendanceActive ? "Ligado" : "Desligado"}
            </span>
          </div>
          <p className="text-[11px] text-[#71717a] leading-tight mt-0.5">
            {isAttendanceActive
              ? "Candidatos veem 'Recrutador Online' e podem tirar dúvidas em tempo real."
              : "Plantão pausado: candidatos veem canal de dúvidas para retorno posterior."}
          </p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={isAttendanceActive}
        onClick={toggleAttendance}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
          isAttendanceActive ? "bg-emerald-600" : "bg-zinc-300"
        }`}
      >
        <span
          className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
            isAttendanceActive ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
