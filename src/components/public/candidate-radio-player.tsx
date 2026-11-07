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
  candidateName,
  spotsEnabled = true,
  playlist,
  spotIntervalMinutes = 0,
  spots,
}: {
  station?: RadioStation | null;
  companyName?: string;
  companySlug?: string;
  candidateName?: string | null;
  spotsEnabled?: boolean;
  playlist?: RadioTrack[];
  spotIntervalMinutes?: number;
  spots?: RadioSpot[];
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const spotAudioRef = useRef<HTMLAudioElement | null>(null);
  const sfxAudioRef = useRef<HTMLAudioElement | null>(null);
  const spotTimerRef = useRef<NodeJS.Timeout | null>(null);
  const spotIndexRef = useRef<number>(0);
  const playedSongsCountRef = useRef<number>(0);

  // Se o gestor não configurou nenhuma estação ainda, usa a padrão (Playlist Oficial Target)
  const [currentStation, setCurrentStation] = useState<RadioStation>(
    station ?? CURATED_STATIONS[0]
  );
  const isPlaylistMode = currentStation.url === "playlist:target";

  const [playlistTracks, setPlaylistTracks] = useState<RadioTrack[]>(
    playlist && playlist.length > 0 ? playlist : TARGET_PLAYLIST_TRACKS
  );

  const [activeSpotsList, setActiveSpotsList] = useState<RadioSpot[]>(
    spots && spots.length > 0 ? spots : TARGET_RADIO_SPOTS
  );

  useEffect(() => {
    if (spots && spots.length > 0) setActiveSpotsList(spots);
  }, [spots]);

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
  const [liveBroadcastNote, setLiveBroadcastNote] = useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string | null>(null);

  // Refs de estado para callbacks assíncronos e Realtime estável
  const playingRef = useRef(playing);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  const playlistTracksRef = useRef(playlistTracks);
  useEffect(() => {
    playlistTracksRef.current = playlistTracks;
  }, [playlistTracks]);

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

  // Função para transição suave entre músicas (Crossfade rádio FM)
  const fadeTransitionToTrack = useCallback((nextAudioUrl: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    const currentSrc = audio.currentSrc || audio.src;
    if (currentSrc.endsWith(nextAudioUrl) || currentSrc === nextAudioUrl) return;

    if (!playingRef.current) {
      audio.src = nextAudioUrl;
      return;
    }

    // Crossfade: Fade-out suave (800ms) -> Troca fonte -> Fade-in suave (800ms)
    const baseVol = muted ? 0 : volume;
    let step = 0;
    const totalSteps = 8;
    const interval = setInterval(() => {
      step++;
      const factor = Math.max(0, (totalSteps - step) / totalSteps);
      if (audio) audio.volume = baseVol * factor;
      if (step >= totalSteps) {
        clearInterval(interval);
        audio.src = nextAudioUrl;
        audio.play().then(() => {
          let inStep = 0;
          const inInterval = setInterval(() => {
            inStep++;
            const inFactor = inStep / totalSteps;
            if (audio) audio.volume = baseVol * inFactor;
            if (inStep >= totalSteps) clearInterval(inInterval);
          }, 80);
        }).catch(() => {});
      }
    }, 80);
  }, [muted, volume]);

  // Função para tocar um spot institucional com ducking suave da rádio
  const playSpot = useCallback(
    (chosenSpot?: RadioSpot) => {
      if (!spotsEnabled) return;
      const validSpots = activeSpotsList.filter((s) => s.enabled !== false);
      if (!validSpots.length) return;

      const spot =
        chosenSpot ??
        validSpots[spotIndexRef.current % validSpots.length];
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
    [activeSpotsList, finishSpot, muted, spotsEnabled, volume]
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

  // Sincroniza se a estação inicial do servidor mudar
  useEffect(() => {
    if (station) {
      setCurrentStation(station);
    }
  }, [station]);

  // Prevenção de reproduções sobrepostas / duplicadas (BroadcastChannel + Realtime)
  const processedAudioEventsRef = useRef<Map<string, number>>(new Map());

  const shouldProcessAudioEvent = useCallback((key: string): boolean => {
    const now = Date.now();
    const last = processedAudioEventsRef.current.get(key);
    if (last && now - last < 10000) {
      return false; // Ignora duplicatas recebidas de múltiplos canais simultâneos
    }
    processedAudioEventsRef.current.set(key, now);
    for (const [k, t] of processedAudioEventsRef.current.entries()) {
      if (now - t > 30000) processedAudioEventsRef.current.delete(k);
    }
    return true;
  }, []);

  // Callbacks de sincronização em tempo real (estáveis para Realtime e BroadcastChannel)
  const handleSpotReceived = useCallback(
    (payload?: { spotId?: string; audioUrl?: string; title?: string; subtitle?: string; timestamp?: number }) => {
      if (!payload) return;
      const dedupeKey = `spot_${payload.spotId || ""}_${payload.audioUrl || ""}`;
      if (!shouldProcessAudioEvent(dedupeKey)) return;

      const found = TARGET_RADIO_SPOTS.find(
        (s) => s.id === payload.spotId || s.audioUrl === payload.audioUrl
      );
      if (found) {
        playSpot(found);
      } else if (payload.audioUrl) {
        playSpot({
          id: payload.spotId || "spot-live",
          title: payload.title || "Rádio Tarhget no Ar",
          subtitle: payload.subtitle || "Vinheta Oficial",
          audioUrl: payload.audioUrl,
        });
      }
    },
    [playSpot, shouldProcessAudioEvent]
  );

  const handleTrackChangeReceived = useCallback(
    (payload?: { trackIndex?: number; track?: RadioTrack }) => {
      if (!payload) return;

      // Sincroniza modo Rádio Tarhget imediatamente
      setCurrentStation((prev) => (prev.url === "playlist:target" ? prev : CURATED_STATIONS[0]));

      if (typeof payload.trackIndex === "number") {
        setTrackIndex(payload.trackIndex);
      }
      if (payload.track?.title) {
        setLiveBroadcastNote(`🎵 No Ar: ${payload.track.title} • ${payload.track.artist || "Rádio Tarhget"}`);
        setTimeout(() => setLiveBroadcastNote(null), 4000);
      }

      if (payload.track?.audioUrl) {
        fadeTransitionToTrack(payload.track.audioUrl);
      }
    },
    [fadeTransitionToTrack]
  );

  const handleStationChangeReceived = useCallback(
    (payload?: { station?: RadioStation; track?: RadioTrack }) => {
      if (!payload?.station) return;
      setCurrentStation(payload.station);
      setLiveBroadcastNote(`📻 Estação sintonizada: ${payload.station.name}`);
      setTimeout(() => setLiveBroadcastNote(null), 4000);

      const nextSrc =
        payload.station.url === "playlist:target"
          ? (payload.track?.audioUrl || playlistTracksRef.current[0]?.audioUrl || TARGET_PLAYLIST_TRACKS[0].audioUrl)
          : payload.station.url;
      if (nextSrc) {
        fadeTransitionToTrack(nextSrc);
      }
    },
    [fadeTransitionToTrack]
  );

  const handlePlaylistSyncReceived = useCallback(
    (payload?: { tracks?: RadioTrack[]; trackIndex?: number }) => {
      if (Array.isArray(payload?.tracks) && payload.tracks.length > 0) {
        setPlaylistTracks(payload.tracks);
      }
      if (typeof payload?.trackIndex === "number") {
        setTrackIndex(payload.trackIndex);
      }
    },
    []
  );

  const handleSpotsSyncReceived = useCallback(
    (payload?: { spots?: RadioSpot[] }) => {
      if (Array.isArray(payload?.spots) && payload.spots.length > 0) {
        setActiveSpotsList(payload.spots);
      }
    },
    []
  );

  const handlePlaySfxReceived = useCallback(
    (payload?: { sfxUrl?: string; name?: string; timestamp?: number }) => {
      if (!payload?.sfxUrl) return;
      const dedupeKey = `sfx_${payload.sfxUrl}_${payload.timestamp || ""}`;
      if (!shouldProcessAudioEvent(dedupeKey)) return;

      if (sfxAudioRef.current) {
        sfxAudioRef.current.pause();
        sfxAudioRef.current.currentTime = 0;
        sfxAudioRef.current.src = payload.sfxUrl;
        sfxAudioRef.current.volume = muted ? 0 : Math.min(1, volume * 1.25);
        sfxAudioRef.current.play().catch(() => {});
      }
    },
    [muted, shouldProcessAudioEvent, volume]
  );

  const handleLiveAnnouncementReceived = useCallback(
    (payload?: { message?: string; audioUrl?: string; timestamp?: number }) => {
      if (!payload?.message) return;
      const dedupeKey = `announcement_${payload.audioUrl || ""}_${payload.message}_${payload.timestamp || ""}`;
      if (!shouldProcessAudioEvent(dedupeKey)) return;

      setLiveAnnouncement(payload.message);
      setTimeout(() => setLiveAnnouncement(null), 12000);

      if (payload.audioUrl && spotAudioRef.current) {
        setActiveSpot({
          id: "live-announcement",
          title: "🎙️ Recado ao Vivo",
          subtitle: payload.message,
          audioUrl: payload.audioUrl,
        });
        if (audioRef.current) {
          audioRef.current.volume = muted ? 0 : Math.max(0, volume * 0.12);
        }
        spotAudioRef.current.pause();
        spotAudioRef.current.currentTime = 0;
        spotAudioRef.current.src = payload.audioUrl;
        spotAudioRef.current.volume = muted ? 0 : Math.min(1, volume * 1.25);
        spotAudioRef.current.play().catch(() => finishSpot());
      }
    },
    [finishSpot, muted, shouldProcessAudioEvent, volume]
  );

  const handleLiveShoutoutReceived = useCallback(
    (payload?: {
      targetCandidateName?: string;
      message?: string;
      audioUrl?: string;
      broadcastMode?: "all" | "private";
      timestamp?: number;
    }) => {
      if (!payload?.message) return;
      const dedupeKey = `shoutout_${payload.audioUrl || ""}_${payload.message}_${payload.timestamp || ""}`;
      if (!shouldProcessAudioEvent(dedupeKey)) return;

      const myStoredName =
        typeof window !== "undefined" ? localStorage.getItem("triagem:candidate:name") : "";
      const myName = (candidateName || myStoredName || "").trim().toLowerCase();
      const targetName = (payload.targetCandidateName || "").trim().toLowerCase();
      const isTargetedToMe = Boolean(
        myName && targetName && (myName.includes(targetName) || targetName.includes(myName))
      );
      const isBroadcastToAll = payload.broadcastMode !== "private" || !payload.targetCandidateName;

      // Se o recado for direcionado para mim ou para todos na rádio
      if (isTargetedToMe || isBroadcastToAll) {
        setLiveAnnouncement(
          isTargetedToMe
            ? `🌟 Mensagem Especial no Ar para você: "${payload.message}"`
            : `🎙️ Recado da Rádio para ${payload.targetCandidateName || "você"}: "${payload.message}"`
        );
        setTimeout(() => setLiveAnnouncement(null), 16000);

        if (payload.audioUrl && spotAudioRef.current) {
          setActiveSpot({
            id: "live-shoutout",
            title: isTargetedToMe
              ? `🌟 Alô Especial para ${candidateName || myStoredName || payload.targetCandidateName}`
              : `🎙️ Alô no Ar para ${payload.targetCandidateName || "Candidatos"}`,
            subtitle: payload.message,
            audioUrl: payload.audioUrl,
          });

          // Ducking suave da música para 12%
          if (audioRef.current) {
            audioRef.current.volume = muted ? 0 : Math.max(0, volume * 0.12);
          }
          spotAudioRef.current.pause();
          spotAudioRef.current.currentTime = 0;
          spotAudioRef.current.src = payload.audioUrl;
          spotAudioRef.current.volume = muted ? 0 : Math.min(1, volume * 1.3);
          spotAudioRef.current.play().catch(() => finishSpot());
        }
      }
    },
    [candidateName, finishSpot, muted, shouldProcessAudioEvent, volume]
  );

  // Escuta transmissões ao vivo da Rádio Tarhget via BroadcastChannel (local) e Supabase Realtime (remoto)
  useEffect(() => {
    // 1. Canal local BroadcastChannel: sincronização instantânea sem atraso entre abas abertas
    let bc: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      bc = new BroadcastChannel("triagem_radio_sync");
      bc.onmessage = (event) => {
        const data = event.data;
        if (!data) return;
        if (data.type === "play_spot") {
          handleSpotReceived(data);
        } else if (data.type === "track_change") {
          handleTrackChangeReceived(data);
        } else if (data.type === "station_change") {
          handleStationChangeReceived(data);
        } else if (data.type === "playlist_sync") {
          handlePlaylistSyncReceived(data);
        } else if (data.type === "spots_sync") {
          handleSpotsSyncReceived(data);
        } else if (data.type === "play_sfx") {
          handlePlaySfxReceived(data);
        } else if (data.type === "live_announcement") {
          handleLiveAnnouncementReceived(data);
        } else if (data.type === "live_shoutout") {
          handleLiveShoutoutReceived(data);
        }
      };
    }

    // 2. Supabase Realtime: sincronização em tempo real entre dispositivos e redes
    const slug = companySlug && companySlug !== "__admin__" ? companySlug : "global";
    let supabase: ReturnType<typeof createClient> | null = null;
    try {
      supabase = createClient();
    } catch {
      supabase = null;
    }

    const channels: any[] = [];
    if (supabase) {
      const mainCh = supabase.channel(`radio:${slug}`, { config: { broadcast: { ack: false } } });
      channels.push(mainCh);
      if (slug !== "global") {
        const globalCh = supabase.channel("radio:global", { config: { broadcast: { ack: false } } });
        channels.push(globalCh);
      }

      for (const ch of channels) {
        ch.on("broadcast", { event: "play_spot" }, (e: any) => handleSpotReceived(e.payload))
          .on("broadcast", { event: "track_change" }, (e: any) => handleTrackChangeReceived(e.payload))
          .on("broadcast", { event: "station_change" }, (e: any) => handleStationChangeReceived(e.payload))
          .on("broadcast", { event: "playlist_sync" }, (e: any) => handlePlaylistSyncReceived(e.payload))
          .on("broadcast", { event: "spots_sync" }, (e: any) => handleSpotsSyncReceived(e.payload))
          .on("broadcast", { event: "play_sfx" }, (e: any) => handlePlaySfxReceived(e.payload))
          .on("broadcast", { event: "live_announcement" }, (e: any) => handleLiveAnnouncementReceived(e.payload))
          .on("broadcast", { event: "live_shoutout" }, (e: any) => handleLiveShoutoutReceived(e.payload))
          .subscribe();
      }
    }

    return () => {
      bc?.close();
      for (const ch of channels) {
        void ch.unsubscribe();
      }
    };
  }, [
    companySlug,
    handleSpotReceived,
    handleTrackChangeReceived,
    handleStationChangeReceived,
    handlePlaylistSyncReceived,
    handleSpotsSyncReceived,
    handlePlaySfxReceived,
    handleLiveAnnouncementReceived,
    handleLiveShoutoutReceived,
  ]);

  // Quando uma faixa da playlist termina, avança normalmente para a próxima
  const handleTrackEnded = () => {
    if (!isPlaylistMode) return;
    playedSongsCountRef.current += 1;
    nextTrack();
  };

  // Se o trackIndex mudar enquanto está tocando, toca a nova faixa
  useEffect(() => {
    if (isPlaylistMode && audioRef.current && playing) {
      const currentSrc = audioRef.current.currentSrc || audioRef.current.src;
      if (!currentSrc.endsWith(currentTrack.audioUrl) && currentSrc !== currentTrack.audioUrl) {
        audioRef.current.src = currentTrack.audioUrl;
        audioRef.current.play().catch(() => {});
      }
    }
  }, [trackIndex, isPlaylistMode, currentTrack.audioUrl, playing]);

  // Agendamento periódico de spots: apenas se o gestor tiver ativado explicitamente intervalo > 0
  useEffect(() => {
    if (!playing || !spotsEnabled || spotIntervalMinutes <= 0) {
      if (spotTimerRef.current) {
        clearTimeout(spotTimerRef.current);
        spotTimerRef.current = null;
      }
      return;
    }

    const intervalMs = spotIntervalMinutes * 60 * 1000;
    spotTimerRef.current = setTimeout(() => {
      playSpot();
    }, intervalMs);

    return () => {
      if (spotTimerRef.current) {
        clearTimeout(spotTimerRef.current);
      }
    };
  }, [playing, spotsEnabled, spotIntervalMinutes, playSpot]);

  // Quando o áudio do spot terminar
  const handleSpotEnded = () => {
    finishSpot();
    // Agenda o próximo spot somente se o gestor ativou intervalo automático > 0
    if (playing && spotsEnabled && spotIntervalMinutes > 0) {
      if (spotTimerRef.current) clearTimeout(spotTimerRef.current);
      const intervalMs = spotIntervalMinutes * 60 * 1000;
      spotTimerRef.current = setTimeout(() => {
        playSpot();
      }, intervalMs);
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
      const currentSrc = audio.currentSrc || audio.src;
      if (!currentSrc.endsWith(activeAudioSrc) && currentSrc !== activeAudioSrc) {
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

      {/* Áudio terciário para efeitos sonoros rápidos (SFX) */}
      <audio
        ref={sfxAudioRef}
        preload="none"
      />

      {/* Dock Flutuante Persistente em Todas as Telas do Candidato */}
      <aside
        aria-label="Rádio da Empresa"
        className="fixed bottom-4 inset-x-3 sm:inset-x-6 z-40 max-w-xl mx-auto"
      >
        <div className="relative overflow-hidden rounded-2xl border border-[#e4e4e7] bg-white/95 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur-md transition-all hover:border-[#0a0a0a]/20 sm:p-3.5">
          {/* Notificação Especial VIP de Alô / Recado no Ar */}
          {liveAnnouncement && (
            <div className="mb-2.5 rounded-xl border border-amber-500/60 bg-gradient-to-r from-amber-500/25 via-amber-400/20 to-orange-500/25 p-2.5 shadow-md animate-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="flex items-center gap-1.5 text-[10px] font-extrabold text-amber-950 uppercase tracking-wider">
                  <span className="size-2 rounded-full bg-red-600 animate-ping" />
                  <span>🎙️ Recado Exclusivo no Ar</span>
                </span>
                <button
                  type="button"
                  onClick={() => setLiveAnnouncement(null)}
                  className="text-stone-400 hover:text-stone-800 text-xs font-bold px-1"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs font-bold text-stone-900 leading-snug">
                {liveAnnouncement}
              </p>
            </div>
          )}

          {/* Notificação de Transmissão ao Vivo */}
          {liveBroadcastNote && (
            <div className="mb-2 rounded-lg bg-amber-500/15 border border-amber-500/30 px-2 py-1 text-center text-[10px] font-bold text-amber-900 animate-pulse">
              {liveBroadcastNote}
            </div>
          )}

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
