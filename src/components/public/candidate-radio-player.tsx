"use client";

import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Music,
  Pause,
  Play,
  Radio,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CURATED_STATIONS, type RadioStation } from "@/server/models/radio.model";

const STORAGE_KEY_CANDIDATE_VOLUME = "triagem:candidate:radio:volume";
const STORAGE_KEY_CANDIDATE_PAUSED = "triagem:candidate:radio:paused";

export function CandidateRadioPlayer({
  station,
  companyName,
}: {
  station?: RadioStation | null;
  companyName?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Se o gestor não configurou nenhuma estação ainda, usa a padrão
  const currentStation = station ?? CURATED_STATIONS[0];

  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);
  const [minimized, setMinimized] = useState(false);

  // Carrega preferências salvas
  useEffect(() => {
    try {
      const savedVol = localStorage.getItem(STORAGE_KEY_CANDIDATE_VOLUME);
      if (savedVol !== null) {
        const parsed = parseFloat(savedVol);
        if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          setVolume(parsed);
        }
      }
    } catch {
      // Ignora erro de localStorage
    }
  }, []);

  // Aplica volume e mute no elemento de áudio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume;
    }
  }, [volume, muted]);

  // Sincroniza se a estação mudar no servidor (quando o gestor alterar)
  useEffect(() => {
    if (station && audioRef.current && playing) {
      if (audioRef.current.src !== station.url) {
        audioRef.current.src = station.url;
        audioRef.current.play().catch(() => {});
      }
    }
  }, [station, playing]);

  // Tenta reprodução automática (autoplay) para que a música seja ouvida a todo momento.
  // Caso a política de autoplay do navegador bloqueie, inicia na primeira interação do usuário.
  useEffect(() => {
    const isExplicitlyPaused = (() => {
      try {
        return sessionStorage.getItem(STORAGE_KEY_CANDIDATE_PAUSED) === "true";
      } catch {
        return false;
      }
    })();

    if (isExplicitlyPaused) return;

    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.src) {
      audio.src = currentStation.url;
    }

    const startAudio = () => {
      if (!audioRef.current) return;
      audioRef.current
        .play()
        .then(() => {
          setPlaying(true);
          setError(null);
        })
        .catch(() => {
          // Bloqueado pelo navegador até o primeiro clique/toque
        });
    };

    // Tentativa imediata
    startAudio();

    // Caso bloqueado, ativa na primeira interação com a página
    const onUserInteraction = () => {
      if (audioRef.current && audioRef.current.paused) {
        startAudio();
      }
    };

    window.addEventListener("pointerdown", onUserInteraction, { once: true });
    window.addEventListener("keydown", onUserInteraction, { once: true });

    return () => {
      window.removeEventListener("pointerdown", onUserInteraction);
      window.removeEventListener("keydown", onUserInteraction);
    };
  }, [currentStation.url]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    setError(null);

    if (playing) {
      audio.pause();
      setPlaying(false);
      setLoading(false);
      try {
        sessionStorage.setItem(STORAGE_KEY_CANDIDATE_PAUSED, "true");
      } catch {}
      return;
    }

    try {
      setLoading(true);
      if (audio.src !== currentStation.url) {
        audio.src = currentStation.url;
      }
      await audio.play();
      setPlaying(true);
      try {
        sessionStorage.removeItem(STORAGE_KEY_CANDIDATE_PAUSED);
      } catch {}
    } catch {
      setPlaying(false);
      setError("Estação indisponível no momento.");
    } finally {
      setLoading(false);
    }
  };

  const toggleMute = () => {
    setMuted((prev) => !prev);
  };

  const handleVolumeChange = (nextVolume: number) => {
    setVolume(nextVolume);
    if (nextVolume > 0 && muted) setMuted(false);
    try {
      localStorage.setItem(STORAGE_KEY_CANDIDATE_VOLUME, String(nextVolume));
    } catch {}
  };

  return (
    <>
      <audio
        ref={audioRef}
        preload="auto"
        onPlaying={() => {
          setLoading(false);
          setPlaying(true);
        }}
        onWaiting={() => setLoading(true)}
        onError={() => {
          if (playing) {
            setPlaying(false);
            setLoading(false);
            setError("Stream offline.");
          }
        }}
      />

      {/* Dock Flutuante Persistente em Todas as Telas do Candidato */}
      <aside
        aria-label="Rádio da Empresa"
        className="fixed bottom-4 inset-x-3 sm:inset-x-6 z-40 max-w-xl mx-auto"
      >
        <div className="relative overflow-hidden rounded-2xl border border-[#e4e4e7] bg-white/95 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur-md transition-all hover:border-[#0a0a0a]/20 sm:p-3.5">
          {minimized ? (
            /* Versão compacta / minimizada */
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white"
                  style={{ backgroundColor: "var(--brand-primary, #0a0a0a)" }}
                >
                  <Radio className={`size-4 ${playing ? "animate-pulse" : ""}`} />
                </span>
                <div className="min-w-0">
                  <span className="block truncate text-xs font-bold text-[#0a0a0a]">
                    {currentStation.name}
                  </span>
                  <span className="block text-[10px] text-[#71717a]">
                    {playing ? "Rádio no ar" : "Pausada"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={toggleMute}
                  title={muted ? "Desmutar" : "Mutar"}
                  className="p-1.5 text-[#71717a] hover:text-[#0a0a0a]"
                >
                  {muted || volume === 0 ? (
                    <VolumeX className="size-4 text-rose-600" />
                  ) : (
                    <Volume2 className="size-4" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={togglePlay}
                  className="flex size-8 items-center justify-center rounded-lg text-white"
                  style={{ backgroundColor: "var(--brand-primary, #0a0a0a)" }}
                  title={playing ? "Pausar" : "Escutar"}
                >
                  {playing ? (
                    <Pause className="size-3.5 fill-white" />
                  ) : (
                    <Play className="size-3.5 fill-white" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setMinimized(false)}
                  className="p-1.5 text-[#a1a1aa] hover:text-[#0a0a0a]"
                  title="Expandir controles"
                >
                  <ChevronUp className="size-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Versão completa com controles de escutar e mutar */
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Lado Esquerdo: Identificação da rádio da empresa */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-xs"
                    style={{ backgroundColor: "var(--brand-primary, #0a0a0a)" }}
                  >
                    <Radio className={`size-5 ${playing ? "animate-pulse" : ""}`} />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        RÁDIO NO AR
                      </span>
                      <span className="truncate text-[10px] text-[#71717a]">
                        {companyName || "Empresa"}
                      </span>
                    </div>

                    <h4 className="mt-0.5 truncate text-xs font-extrabold text-[#0a0a0a] sm:text-sm">
                      {currentStation.name}
                    </h4>
                    <p className="truncate text-[11px] text-[#71717a]">
                      {currentStation.genre} · <span className="text-[#a1a1aa]">Controle pelo gestor</span>
                    </p>
                  </div>
                </div>

                {/* Lado Direito: Apenas Escutar (Play/Pause) e Mutar (Mute/Volume) */}
                <div className="flex items-center gap-2 sm:gap-2.5 ml-auto">
                  {/* Equalizador animado quando tocando */}
                  {playing && (
                    <div className="hidden sm:flex items-center gap-0.5 h-3.5 px-1">
                      <span className="w-0.5 h-2.5 bg-emerald-500 animate-[bounce_0.8s_infinite]" />
                      <span className="w-0.5 h-3.5 bg-emerald-500 animate-[bounce_1.1s_infinite]" />
                      <span className="w-0.5 h-1.5 bg-emerald-500 animate-[bounce_0.6s_infinite]" />
                      <span className="w-0.5 h-3 bg-emerald-500 animate-[bounce_0.9s_infinite]" />
                    </div>
                  )}

                  {/* Mutar / Volume */}
                  <div className="flex items-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-[#fafaf9] px-2 py-1 shadow-2xs">
                    <button
                      type="button"
                      onClick={toggleMute}
                      title={muted ? "Desmutar rádio" : "Mutar rádio"}
                      className="text-[#71717a] transition hover:text-[#0a0a0a]"
                    >
                      {muted || volume === 0 ? (
                        <VolumeX className="size-4 text-rose-600" />
                      ) : (
                        <Volume2 className="size-4 text-[#0a0a0a]" />
                      )}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={muted ? 0 : volume}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      aria-label="Volume da rádio"
                      className="h-1.5 w-14 cursor-pointer accent-[#0a0a0a] sm:w-16"
                    />
                  </div>

                  {/* Escutar / Pausar */}
                  <button
                    type="button"
                    onClick={togglePlay}
                    disabled={loading}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-white shadow-xs transition hover:opacity-90 active:scale-98 disabled:opacity-60"
                    style={{ backgroundColor: "var(--brand-primary, #0a0a0a)" }}
                  >
                    {loading ? (
                      <span className="size-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : playing ? (
                      <Pause className="size-3.5 fill-white" />
                    ) : (
                      <Play className="size-3.5 fill-white" />
                    )}
                    <span>{playing ? "Pausar" : "Escutar"}</span>
                  </button>

                  {/* Botão Minimizar */}
                  <button
                    type="button"
                    onClick={() => setMinimized(true)}
                    className="p-1 text-[#a1a1aa] hover:text-[#0a0a0a]"
                    title="Minimizar rádio"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                </div>
              </div>

              {error && (
                <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] text-rose-800">
                  <AlertCircle className="size-3 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
