"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { playCandidateChimeSound } from "@/lib/sound-alert";
import { Toast } from "@/components/gestor/toast";

interface SoundNotificationListenerProps {
  pendingCount: number;
  enabled?: boolean;
}

export function SoundNotificationListener({
  pendingCount,
  enabled = true,
}: SoundNotificationListenerProps) {
  const [muted, setMuted] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const lastCountRef = useRef<number | null>(null);

  // Carrega preferência local de mute
  useEffect(() => {
    try {
      const stored = localStorage.getItem("triagem_sound_muted");
      if (stored === "true") setMuted(true);
    } catch {}
  }, []);

  function toggleMute() {
    setMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("triagem_sound_muted", next ? "true" : "false");
      } catch {}
      if (!next) {
        // Toca um som de teste ao desmutar
        playCandidateChimeSound();
      }
      return next;
    });
  }

  // Detecta quando uma nova candidatura chega
  useEffect(() => {
    if (!enabled) return;

    if (lastCountRef.current === null) {
      lastCountRef.current = pendingCount;
      return;
    }

    if (pendingCount > lastCountRef.current) {
      if (!muted) {
        playCandidateChimeSound();
      }
      setToastMessage("Nova candidatura recebida no painel!");
    }

    lastCountRef.current = pendingCount;
  }, [pendingCount, enabled, muted]);

  if (!enabled) return null;

  return (
    <>
      {toastMessage && (
        <Toast
          message={toastMessage}
          onDone={() => setToastMessage(null)}
          durationMs={4000}
        />
      )}
    </>
  );
}

/** Botão compacto de mute/unmute do som do painel para o Topbar */
export function SoundToggleControl({ enabled = true }: { enabled?: boolean }) {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("triagem_sound_muted");
      if (stored === "true") setMuted(true);
    } catch {}
  }, []);

  function toggle() {
    setMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("triagem_sound_muted", next ? "true" : "false");
      } catch {}
      if (!next) {
        playCandidateChimeSound();
      }
      return next;
    });
  }

  if (!enabled) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      title={muted ? "Ativar som de novas candidaturas" : "Silenciar som de novas candidaturas"}
      className="flex size-9 items-center justify-center rounded-lg text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#0a0a0a] transition-colors"
    >
      {muted ? (
        <VolumeX className="size-4 text-[#a1a1aa]" />
      ) : (
        <Volume2 className="size-4 text-[#15803d]" />
      )}
    </button>
  );
}
