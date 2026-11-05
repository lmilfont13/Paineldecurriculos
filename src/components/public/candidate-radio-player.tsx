"use client";

import { AlertCircle, Music, Pause, Play, Radio, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CURATED_STATIONS, type RadioStation } from "@/server/models/radio.model";

const STORAGE_KEY_CANDIDATE_VOLUME = "triagem:candidate:radio:volume";

export function CandidateRadioPlayer({
  station,
  companyName,
}: {
  station?: RadioStation | null;
  companyName?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Se o gestor não configurou nenhuma estação ainda, usa a padrão (Hunter FM - Pop Hits)
  const currentStation = station ?? CURATED_STATIONS[0];

  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);

  // Sincroniza se a estação mudar no servidor (quando o gestor alterar)
  useEffect(() => {
    if (station && audioRef.current && playing) {
      if (audioRef.current.src !== station.url) {
        audioRef.current.src = station.url;
        audioRef.current.play().catch(() => {});
      }
    }
  }, [station, playing]);

  // Carrega volume salvo pelo candidato
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

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume;
    }
  }, [volume, muted]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    setError(null);

    if (playing) {
      audio.pause();
      setPlaying(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      if (audio.src !== currentStation.url) {
        audio.src = currentStation.url;
      }
      await audio.play();
      setPlaying(true);
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
    } catch {
      // Ignora erro de localStorage
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-[#e4e4e7] bg-linear-to-b from-white via-white to-[#fafaf9] p-4 shadow-xs transition hover:border-[#0a0a0a]/20 sm:p-5">
      <audio
        ref={audioRef}
        preload="none"
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

      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Lado Esquerdo: Identificação da Rádio + Equalizador */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white shadow-xs"
            style={{ backgroundColor: "var(--brand-primary, #0a0a0a)" }}
          >
            <Radio className={`size-5 ${playing ? "animate-pulse" : ""}`} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                RÁDIO NO AR
              </span>
              <span className="text-[10px] font-medium text-[#71717a]">
                Sintonia de {companyName || "Empresa"}
              </span>
            </div>

            <h3 className="mt-1 truncate text-sm font-extrabold text-[#0a0a0a]">
              {currentStation.name}
            </h3>
            <p className="truncate text-xs text-[#71717a]">
              {currentStation.genre} · <span className="text-[11px] text-[#a1a1aa]">Controle pelo gestor</span>
            </p>
          </div>
        </div>

        {/* Lado Direito: Apenas Controles de Escutar (Play/Pause) e Mutar (Mute/Volume) */}
        <div className="flex items-center gap-3">
          {/* Ondas Sonoras Animadas quando estiver tocando */}
          {playing && (
            <div className="hidden sm:flex items-center gap-0.5 h-4 px-1">
              <span className="w-0.5 h-3 bg-emerald-500 animate-[bounce_0.8s_infinite]" />
              <span className="w-0.5 h-4 bg-emerald-500 animate-[bounce_1.1s_infinite]" />
              <span className="w-0.5 h-2 bg-emerald-500 animate-[bounce_0.6s_infinite]" />
              <span className="w-0.5 h-3.5 bg-emerald-500 animate-[bounce_0.9s_infinite]" />
            </div>
          )}

          {/* Controle de Mute / Volume */}
          <div className="flex items-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-white px-2.5 py-1.5 shadow-2xs">
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
              className="h-1.5 w-16 cursor-pointer accent-[#0a0a0a] sm:w-20"
            />
          </div>

          {/* Botão Escutar / Pausar */}
          <button
            type="button"
            onClick={togglePlay}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold text-white shadow-xs transition hover:opacity-90 active:scale-98 disabled:opacity-60"
            style={{ backgroundColor: "var(--brand-primary, #0a0a0a)" }}
          >
            {loading ? (
              <span className="size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : playing ? (
              <Pause className="size-4 fill-white" />
            ) : (
              <Play className="size-4 fill-white" />
            )}
            <span>{playing ? "Pausar" : "Escutar Rádio"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-xs text-rose-800">
          <AlertCircle className="size-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
