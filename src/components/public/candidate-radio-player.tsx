"use client";

import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Music,
  Pause,
  Play,
  Radio,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import {
  CURATED_STATIONS,
  TARGET_PLAYLIST_TRACKS,
  TARGET_RADIO_SPOTS,
  type RadioSpot,
  type RadioStation,
  type RadioTrack,
} from "@/server/models/radio.model";

const STORAGE_KEY_CANDIDATE_VOLUME = "triagem:candidate:radio:volume";
const STORAGE_KEY_CANDIDATE_PAUSED = "triagem:candidate:radio:paused";

export function CandidateRadioPlayer({
  station,
  companyName,
  companySlug,
  spotsEnabled = true,
  playlist,
}: {
  station?: RadioStation | null;
  companyName?: string;
  companySlug?: string;
  spotsEnabled?: boolean;
  playlist?: RadioTrack[];
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const spotAudioRef = useRef<HTMLAudioElement | null>(null);
  const spotTimerRef = useRef<NodeJS.Timeout | null>(null);
  const spotIndexRef = useRef<number>(0);
  const playedSongsCountRef = useRef<number>(0);

  // Se o gestor não configurou nenhuma estação ainda, usa a padrão (Playlist Oficial Target)
  const currentStation = station ?? CURATED_STATIONS[0];
  const isPlaylistMode = currentStation.url === "playlist:target";

  const [playlistTracks, setPlaylistTracks] = useState<RadioTrack[]>(
    playlist && playlist.length > 0 ? playlist : TARGET_PLAYLIST_TRACKS
  );

  const [trackIndex, setTrackIndex] = useState(0);
  const currentTrack: RadioTrack =
    playlistTracks[trackIndex % (playlistTracks.length || 1)] ?? TARGET_PLAYLIST_TRACKS[0];

  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [activeSpot, setActiveSpot] = useState<RadioSpot | null>(null);

  // Define qual áudio carregar na rádio (faixa da playlist ou stream ao vivo)
  const activeAudioSrc = isPlaylistMode
    ? currentTrack.audioUrl
    : currentStation.url;

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

  // Aplica volume e mute no elemento de áudio (com ducking suave se spot estiver tocando)
  useEffect(() => {
    if (audioRef.current) {
      if (muted) {
        audioRef.current.volume = 0;
      } else if (activeSpot) {
        audioRef.current.volume = Math.max(0, volume * 0.15); // Ducking para 15%
      } else {
        audioRef.current.volume = volume;
      }
    }
    if (spotAudioRef.current) {
      spotAudioRef.current.volume = muted ? 0 : Math.min(1, volume * 1.25);
    }
  }, [volume, muted, activeSpot]);

  // Sincroniza se a estação mudar no servidor (quando o gestor alterar)
  useEffect(() => {
    if (station && audioRef.current && playing) {
      const nextSrc =
        station.url === "playlist:target"
          ? currentTrack.audioUrl
          : station.url;
      if (audioRef.current.src !== nextSrc) {
        audioRef.current.src = nextSrc;
        audioRef.current.play().catch(() => {});
      }
    }
  }, [station, playing, currentTrack.audioUrl]);

  // Função para restaurar o som da rádio e limpar o spot ativo
  const finishSpot = useCallback(() => {
    setActiveSpot(null);
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume;
    }
  }, [muted, volume]);

  // Função para tocar um spot institucional com ducking suave da rádio
  const playSpot = useCallback(
    (chosenSpot?: RadioSpot) => {
      if (!spotsEnabled || !TARGET_RADIO_SPOTS.length) return;
      const spot =
        chosenSpot ??
        TARGET_RADIO_SPOTS[spotIndexRef.current % TARGET_RADIO_SPOTS.length];
      spotIndexRef.current += 1;

      setActiveSpot(spot);

      // Ducking imediato na música
      if (audioRef.current) {
        audioRef.current.volume = muted ? 0 : Math.max(0, volume * 0.15);
      }

      if (spotAudioRef.current) {
        spotAudioRef.current.src = spot.audioUrl;
        spotAudioRef.current.volume = muted ? 0 : Math.min(1, volume * 1.25);
        spotAudioRef.current.play().catch(() => {
          finishSpot();
        });
      }
    },
    [finishSpot, muted, spotsEnabled, volume]
  );

  // Pular o spot atual
  const skipCurrentSpot = useCallback(() => {
    if (spotAudioRef.current) {
      spotAudioRef.current.pause();
      spotAudioRef.current.currentTime = 0;
    }
    finishSpot();
  }, [finishSpot]);

  // Avançar para a próxima música da playlist
  const nextTrack = useCallback(() => {
    if (!isPlaylistMode || playlistTracks.length === 0) return;
    setTrackIndex((prev) => (prev + 1) % playlistTracks.length);
  }, [isPlaylistMode, playlistTracks.length]);

  // Sincroniza playlist quando fornecida externamente
  useEffect(() => {
    if (playlist && playlist.length > 0) {
      setPlaylistTracks(playlist);
    }
  }, [playlist]);

  // Escuta transmissões ao vivo da Rádio Tarhget via Supabase Realtime
  useEffect(() => {
    if (!companySlug) return;
    let supabase: ReturnType<typeof createClient> | null = null;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    const channel = supabase.channel(`radio:${companySlug}`);
    channel
      .on("broadcast", { event: "play_spot" }, (e) => {
        const payload = e.payload as { spotId?: string; audioUrl?: string; title?: string };
        const found = TARGET_RADIO_SPOTS.find(
          (s) => s.id === payload?.spotId || s.audioUrl === payload?.audioUrl
        );
        if (found) {
          playSpot(found);
        } else if (payload?.audioUrl) {
          playSpot({
            id: payload.spotId || "spot-live",
            title: payload.title || "Tarhget no Ar",
            subtitle: "Vinheta Oficial",
            audioUrl: payload.audioUrl,
          });
        }
      })
      .on("broadcast", { event: "playlist_sync" }, (e) => {
        const payload = e.payload as { tracks?: RadioTrack[]; trackIndex?: number };
        if (Array.isArray(payload?.tracks) && payload.tracks.length > 0) {
          setPlaylistTracks(payload.tracks);
        }
        if (typeof payload?.trackIndex === "number") {
          setTrackIndex(payload.trackIndex);
        }
      })
      .subscribe();

    return () => {
      void channel.unsubscribe();
    };
  }, [companySlug, playSpot]);

  // Quando uma faixa da playlist termina
  const handleTrackEnded = () => {
    if (!isPlaylistMode) return;

    playedSongsCountRef.current += 1;

    // A cada 2 músicas finalizadas, injeta um spot da Target
    if (spotsEnabled && playedSongsCountRef.current % 2 === 0) {
      playSpot();
    }

    nextTrack();
  };

  // Se o trackIndex mudar enquanto está tocando, toca a nova faixa
  useEffect(() => {
    if (isPlaylistMode && audioRef.current && playing) {
      audioRef.current.src = currentTrack.audioUrl;
      audioRef.current.play().catch(() => {});
    }
  }, [trackIndex, isPlaylistMode, currentTrack.audioUrl, playing]);

  // Agendamento periódico de spots enquanto a rádio estiver tocando (para streams contínuos ou intervalo)
  useEffect(() => {
    if (!playing || !spotsEnabled) {
      if (spotTimerRef.current) {
        clearTimeout(spotTimerRef.current);
        spotTimerRef.current = null;
      }
      if (activeSpot) {
        skipCurrentSpot();
      }
      return;
    }

    // Primeiro spot toca após 50 segundos de rádio tocando
    const initialDelay = 50000;
    spotTimerRef.current = setTimeout(() => {
      playSpot();
    }, initialDelay);

    return () => {
      if (spotTimerRef.current) {
        clearTimeout(spotTimerRef.current);
      }
    };
  }, [playing, spotsEnabled, playSpot, activeSpot, skipCurrentSpot]);

  // Quando o áudio do spot terminar
  const handleSpotEnded = () => {
    finishSpot();
    // Agenda o próximo spot para daqui a 3.5 minutos
    if (playing && spotsEnabled) {
      if (spotTimerRef.current) clearTimeout(spotTimerRef.current);
      spotTimerRef.current = setTimeout(() => {
        playSpot();
      }, 210000);
    }
  };

  // Tenta reprodução automática (autoplay)
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
      audio.src = activeAudioSrc;
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
  }, [activeAudioSrc]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    setError(null);

    if (playing) {
      audio.pause();
      if (spotAudioRef.current) {
        spotAudioRef.current.pause();
      }
      finishSpot();
      setPlaying(false);
      setLoading(false);
      try {
        sessionStorage.setItem(STORAGE_KEY_CANDIDATE_PAUSED, "true");
      } catch {}
      return;
    }

    try {
      setLoading(true);
      if (audio.src !== activeAudioSrc) {
        audio.src = activeAudioSrc;
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
      {/* Stream principal da rádio musical / playlist oficial */}
      <audio
        ref={audioRef}
        preload="auto"
        onEnded={handleTrackEnded}
        onPlaying={() => {
          setLoading(false);
          setPlaying(true);
        }}
        onWaiting={() => setLoading(true)}
        onError={() => {
          if (playing) {
            setPlaying(false);
            setLoading(false);
            setError("Áudio temporariamente offline.");
          }
        }}
      />

      {/* Áudio secundário dedicado aos spots / vinhetas institucionais da Target */}
      <audio
        ref={spotAudioRef}
        preload="auto"
        onEnded={handleSpotEnded}
        onError={() => finishSpot()}
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
                    {isPlaylistMode ? currentTrack.title : currentStation.name}
                  </span>
                  <span className="block text-[10px] text-[#71717a]">
                    {playing ? "Rádio no ar" : "Pausada"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {isPlaylistMode && (
                  <button
                    type="button"
                    onClick={nextTrack}
                    title="Próxima música"
                    className="p-1.5 text-[#71717a] hover:text-[#0a0a0a]"
                  >
                    <SkipForward className="size-3.5" />
                  </button>
                )}

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
                {/* Lado Esquerdo: Identificação da rádio e faixa atual */}
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
                        {companyName || "Empresa"} · {currentStation.name}
                      </span>
                    </div>

                    <h4 className="mt-0.5 truncate text-xs font-extrabold text-[#0a0a0a] sm:text-sm">
                      {isPlaylistMode ? currentTrack.title : currentStation.name}
                    </h4>
                    <p className="truncate text-[11px] text-[#71717a]">
                      {isPlaylistMode ? currentTrack.artist : currentStation.genre}
                    </p>
                  </div>
                </div>

                {/* Lado Direito: Ações de Play, Mute, Volume e Próxima Faixa */}
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

                  {/* Botão de Próxima Música (disponível no modo playlist) */}
                  {isPlaylistMode && (
                    <button
                      type="button"
                      onClick={nextTrack}
                      title="Pular para a próxima música"
                      className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-[#e4e4e7] bg-[#fafaf9] px-2 py-1 text-[11px] font-medium text-[#27272a] transition hover:bg-[#f4f4f5] active:scale-95"
                    >
                      <SkipForward className="size-3 text-[#71717a]" />
                      <span>Próxima</span>
                    </button>
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
