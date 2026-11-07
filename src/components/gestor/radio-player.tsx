"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  Clock,
  Disc,
  Headphones,
  ListMusic,
  Loader2,
  Music,
  Pause,
  Play,
  Plus,
  Radio,
  RadioTower,
  Search,
  Settings2,
  SkipBack,
  SkipForward,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import {
  getMusicCatalogAction,
  getRadioPlaylistAction,
  getRadioSpotIntervalAction,
  saveRadioPlaylistAction,
  saveRadioSpotIntervalAction,
  saveRadioStationAction,
} from "@/server/controllers/settings.controller";
import {
  CURATED_STATIONS,
  DEFAULT_MUSIC_CATALOG,
  TARGET_PLAYLIST_TRACKS,
  TARGET_RADIO_SPOTS,
  type RadioSpot,
  type RadioStation,
  type RadioTrack,
} from "@/server/models/radio.model";

export type { RadioStation, RadioSpot, RadioTrack };
export { CURATED_STATIONS, DEFAULT_MUSIC_CATALOG, TARGET_PLAYLIST_TRACKS, TARGET_RADIO_SPOTS };

interface RadioBrowserResult {
  stationuuid: string;
  name: string;
  tags: string;
  countrycode: string;
  url_resolved: string;
}

const STORAGE_KEY_VOLUME = "triagem:radio:volume";

function formatTimer(totalSecs: number): string {
  const m = Math.floor(Math.max(0, totalSecs) / 60);
  const s = Math.max(0, totalSecs) % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function GestorRadioPlayer({
  initialStation,
  canManage = false,
  companySlug,
}: {
  initialStation?: RadioStation | null;
  canManage?: boolean;
  companySlug?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const spotAudioRef = useRef<HTMLAudioElement | null>(null);
  const localChannelRef = useRef<BroadcastChannel | null>(null);
  const realtimeChannelsRef = useRef<any[]>([]);

  // Normaliza o nome oficial da Rádio Tarhget
  const normalizeStation = useCallback((st: RadioStation): RadioStation => {
    if (st.url === "playlist:target") {
      return { ...st, name: "Rádio Tarhget", genre: "Músicas Selecionadas + Spots IA" };
    }
    return st;
  }, []);

  const defaultStation = initialStation ? normalizeStation(initialStation) : CURATED_STATIONS[0];
  const [stations, setStations] = useState<RadioStation[]>(() => {
    const list = CURATED_STATIONS.map((s) => normalizeStation(s));
    if (initialStation && !list.some((s) => s.url === initialStation.url)) {
      return [list[0], normalizeStation(initialStation), ...list.slice(1)];
    }
    return list;
  });

  const [current, setCurrent] = useState<RadioStation>(defaultStation);
  const isPlaylistMode = current.url === "playlist:target";

  // Fila de reprodução da Rádio Tarhget
  const [playlistTracks, setPlaylistTracks] = useState<RadioTrack[]>(DEFAULT_MUSIC_CATALOG);
  const [trackIndex, setTrackIndex] = useState(0);
  const currentTrack: RadioTrack =
    playlistTracks[trackIndex % (playlistTracks.length || 1)] ?? DEFAULT_MUSIC_CATALOG[0];

  const activeAudioSrc = isPlaylistMode ? currentTrack?.audioUrl : current.url;

  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);

  // Spots / Vinhetas
  const [previewingSpotId, setPreviewingSpotId] = useState<string | null>(null);
  const [liveBroadcastSpot, setLiveBroadcastSpot] = useState<RadioSpot | null>(null);

  // Painéis e abas de controle
  const [configOpen, setConfigOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"fila" | "estacao" | "spots">("fila");

  // Fecha o Estúdio DJ com a tecla Esc
  useEffect(() => {
    if (!configOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfigOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [configOpen]);

  // Busca de rádios FM públicas
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<RadioStation[]>([]);

  // Catálogo e busca de músicas
  const [musicCatalog, setMusicCatalog] = useState<RadioTrack[]>(DEFAULT_MUSIC_CATALOG);
  const [musicSearchQuery, setMusicSearchQuery] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customArtist, setCustomArtist] = useState("");
  const [customUrl, setCustomUrl] = useState("");

  const [savingStation, setSavingStation] = useState(false);
  const [savedStation, setSavedStation] = useState(false);
  const [savingPlaylist, setSavingPlaylist] = useState(false);
  const [savedPlaylist, setSavedPlaylist] = useState(false);
  const [broadcastNotification, setBroadcastNotification] = useState<string | null>(null);

  // Intervalo e temporizador automático dos Spots / Vinhetas (0 = manual apenas, padrão)
  const [spotIntervalMinutes, setSpotIntervalMinutes] = useState(0);
  const [savingInterval, setSavingInterval] = useState(false);
  const [nextSpotSeconds, setNextSpotSeconds] = useState(0);
  const spotIndexRef = useRef(0);

  // Conecta ao Supabase Realtime e BroadcastChannel para sincronização instantânea
  const resolvedSlug = companySlug && companySlug !== "__admin__" ? companySlug : "global";

  // 1. BroadcastChannel instantâneo para sincronia entre abas locais no mesmo navegador
  useEffect(() => {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      localChannelRef.current = new BroadcastChannel("triagem_radio_sync");
      return () => {
        localChannelRef.current?.close();
        localChannelRef.current = null;
      };
    }
  }, []);

  // 2. Conexão Supabase Realtime para sincronização remota entre navegadores/dispositivos
  useEffect(() => {
    try {
      const supabase = createClient();
      const channels: any[] = [];
      const mainCh = supabase.channel(`radio:${resolvedSlug}`, {
        config: { broadcast: { ack: false } },
      });
      mainCh.subscribe();
      channels.push(mainCh);

      if (resolvedSlug !== "global") {
        const globalCh = supabase.channel("radio:global", {
          config: { broadcast: { ack: false } },
        });
        globalCh.subscribe();
        channels.push(globalCh);
      }

      realtimeChannelsRef.current = channels;

      return () => {
        for (const ch of channels) {
          void ch.unsubscribe();
        }
        realtimeChannelsRef.current = [];
      };
    } catch {
      // Ignora erro se não configurado
    }
  }, [resolvedSlug]);

  // Funções de transmissão ao vivo para a área do candidato
  const broadcastTrackChange = useCallback((newIndex: number, track: RadioTrack) => {
    if (!track) return;

    // Transmissão instantânea para abas locais (zero latência)
    localChannelRef.current?.postMessage({
      type: "track_change",
      trackIndex: newIndex,
      track,
      timestamp: Date.now(),
    });

    // Transmissão via Supabase Realtime
    for (const ch of realtimeChannelsRef.current) {
      ch.send({
        type: "broadcast",
        event: "track_change",
        payload: {
          trackIndex: newIndex,
          track,
          timestamp: Date.now(),
        },
      });
    }
  }, []);

  const broadcastStationChange = useCallback((newStation: RadioStation) => {
    // Transmissão instantânea para abas locais
    localChannelRef.current?.postMessage({
      type: "station_change",
      station: newStation,
      isPlaylistMode: newStation.url === "playlist:target",
      trackIndex: 0,
      track: playlistTracks[0],
      timestamp: Date.now(),
    });

    // Transmissão via Supabase Realtime
    for (const ch of realtimeChannelsRef.current) {
      ch.send({
        type: "broadcast",
        event: "station_change",
        payload: {
          station: newStation,
          isPlaylistMode: newStation.url === "playlist:target",
          trackIndex: 0,
          track: playlistTracks[0],
          timestamp: Date.now(),
        },
      });
    }
  }, [playlistTracks]);

  // Carrega a fila salva, catálogo e intervalo de spots da empresa
  useEffect(() => {
    void (async () => {
      try {
        const [savedQueue, catalog, savedInterval] = await Promise.all([
          getRadioPlaylistAction(),
          getMusicCatalogAction(),
          getRadioSpotIntervalAction(),
        ]);
        if (savedQueue && savedQueue.length > 0) {
          setPlaylistTracks(savedQueue);
        }
        if (catalog && catalog.length > 0) {
          setMusicCatalog(catalog);
        }
        if (typeof savedInterval === "number") {
          setSpotIntervalMinutes(savedInterval);
          setNextSpotSeconds(savedInterval > 0 ? savedInterval * 60 : 0);
        } else {
          setSpotIntervalMinutes(0);
          setNextSpotSeconds(0);
        }
      } catch {
        // Fallback para valores padrão
      }
    })();
  }, []);

  // Temporizador para disparar spot a cada X minutos automaticamente
  useEffect(() => {
    if (!playing || spotIntervalMinutes <= 0) return;

    const timer = setInterval(() => {
      setNextSpotSeconds((prev) => {
        if (prev <= 1) {
          const spot = TARGET_RADIO_SPOTS[spotIndexRef.current % TARGET_RADIO_SPOTS.length];
          spotIndexRef.current += 1;
          broadcastSpotLive(spot);
          return spotIntervalMinutes * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [playing, spotIntervalMinutes]);

  const handleIntervalChange = async (minutes: number) => {
    setSpotIntervalMinutes(minutes);
    setNextSpotSeconds(minutes > 0 ? minutes * 60 : 0);
    setSavingInterval(true);
    try {
      await saveRadioSpotIntervalAction(minutes);
    } catch {
      // Ignora erro
    } finally {
      setSavingInterval(false);
    }
  };

  const triggerNextSpotNow = () => {
    const spot = TARGET_RADIO_SPOTS[spotIndexRef.current % TARGET_RADIO_SPOTS.length];
    spotIndexRef.current += 1;
    broadcastSpotLive(spot);
    if (spotIntervalMinutes > 0) {
      setNextSpotSeconds(spotIntervalMinutes * 60);
    }
  };

  // Sincroniza se o servidor atualizar a estação inicial
  useEffect(() => {
    if (initialStation && initialStation.url !== current.url) {
      const norm = normalizeStation(initialStation);
      setCurrent(norm);
      setStations((prev) =>
        prev.some((s) => s.url === norm.url) ? prev : [norm, ...prev]
      );
    }
  }, [initialStation, normalizeStation, current.url]);

  // Restaura o volume salvo localmente
  useEffect(() => {
    try {
      const savedVol = localStorage.getItem(STORAGE_KEY_VOLUME);
      if (savedVol !== null) {
        const parsed = parseFloat(savedVol);
        if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          setVolume(parsed);
        }
      }
    } catch {
      // Ignora
    }
  }, []);

  // Aplica volume com ducking se houver vinheta
  useEffect(() => {
    if (audioRef.current) {
      if (previewingSpotId || liveBroadcastSpot) {
        audioRef.current.volume = muted ? 0 : Math.max(0, volume * 0.15);
      } else {
        audioRef.current.volume = muted ? 0 : volume;
      }
    }
    if (spotAudioRef.current) {
      spotAudioRef.current.volume = muted ? 0 : Math.min(1, volume * 1.25);
    }
  }, [volume, muted, previewingSpotId, liveBroadcastSpot]);

  // Atualiza áudio se a faixa mudar em reprodução
  useEffect(() => {
    if (isPlaylistMode && audioRef.current && playing && currentTrack?.audioUrl) {
      if (audioRef.current.src !== currentTrack.audioUrl) {
        audioRef.current.src = currentTrack.audioUrl;
        audioRef.current.play().catch(() => {});
      }
    }
  }, [trackIndex, isPlaylistMode, currentTrack?.audioUrl, playing]);

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
      const currentSrc = audio.currentSrc || audio.src;
      if (!currentSrc || (!currentSrc.endsWith(activeAudioSrc) && currentSrc !== activeAudioSrc)) {
        audio.src = activeAudioSrc;
      }
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
      setError("Estação ou faixa indisponível no momento.");
    } finally {
      setLoading(false);
    }
  };

  const playNextTrack = () => {
    if (!isPlaylistMode || playlistTracks.length === 0) return;
    const nextIdx = (trackIndex + 1) % playlistTracks.length;
    setTrackIndex(nextIdx);
    const track = playlistTracks[nextIdx];
    if (track) broadcastTrackChange(nextIdx, track);
  };

  const playPrevTrack = () => {
    if (!isPlaylistMode || playlistTracks.length === 0) return;
    const prevIdx = (trackIndex - 1 + playlistTracks.length) % playlistTracks.length;
    setTrackIndex(prevIdx);
    const track = playlistTracks[prevIdx];
    if (track) broadcastTrackChange(prevIdx, track);
  };

  const selectStationAsAdmin = async (station: RadioStation) => {
    if (!canManage) return;
    const norm = normalizeStation(station);
    setCurrent(norm);
    setError(null);
    setStations((prev) =>
      prev.some((s) => s.url === norm.url) ? prev : [norm, ...prev]
    );

    // Transmite a nova estação para os candidatos imediatamente
    broadcastStationChange(norm);

    setSavingStation(true);
    setSavedStation(false);
    try {
      const res = await saveRadioStationAction(norm);
      if (res?.ok) {
        setSavedStation(true);
        setTimeout(() => setSavedStation(false), 3000);
      }
    } catch {
      // Ignora erro
    } finally {
      setSavingStation(false);
    }

    const audio = audioRef.current;
    if (!audio) return;

    try {
      setLoading(true);
      const targetSrc =
        norm.url === "playlist:target"
          ? (playlistTracks[0]?.audioUrl || DEFAULT_MUSIC_CATALOG[0].audioUrl)
          : norm.url;
      audio.src = targetSrc;
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
      setError("Não foi possível tocar esta rádio.");
    } finally {
      setLoading(false);
    }
  };

  const handleVolumeChange = (nextVolume: number) => {
    setVolume(nextVolume);
    if (nextVolume > 0 && muted) setMuted(false);
    try {
      localStorage.setItem(STORAGE_KEY_VOLUME, String(nextVolume));
    } catch {
      // Ignora
    }
  };

  // Pré-visualizar vinheta no fone local
  const toggleSpotPreview = (spot: RadioSpot) => {
    const audio = spotAudioRef.current;
    if (!audio) return;
    if (previewingSpotId === spot.id) {
      audio.pause();
      setPreviewingSpotId(null);
      return;
    }
    audio.src = spot.audioUrl;
    audio.play().then(() => {
      setPreviewingSpotId(spot.id);
    }).catch(() => setPreviewingSpotId(null));
  };

  // Disparar Vinheta no Ar AO VIVO para os Candidatos
  const broadcastSpotLive = (spot: RadioSpot) => {
    const audio = spotAudioRef.current;
    if (audio) {
      audio.src = spot.audioUrl;
      audio.play().then(() => {
        setLiveBroadcastSpot(spot);
      }).catch(() => {});
    }

    // 1. Transmissão instantânea local entre abas
    localChannelRef.current?.postMessage({
      type: "play_spot",
      spotId: spot.id,
      title: spot.title,
      subtitle: spot.subtitle,
      audioUrl: spot.audioUrl,
      timestamp: Date.now(),
    });

    // 2. Transmissão via Supabase Realtime
    for (const ch of realtimeChannelsRef.current) {
      ch.send({
        type: "broadcast",
        event: "play_spot",
        payload: {
          spotId: spot.id,
          title: spot.title,
          subtitle: spot.subtitle,
          audioUrl: spot.audioUrl,
        },
      });
    }

    setBroadcastNotification(`🔴 Vinheta "${spot.title}" transmitida no ar!`);
    setTimeout(() => setBroadcastNotification(null), 4000);
  };

  // Operações de Fila (Reordenar, Adicionar, Remover)
  const addTrackToQueue = (track: RadioTrack) => {
    setPlaylistTracks((prev) => {
      const exists = prev.some((t) => t.id === track.id || t.audioUrl === track.audioUrl);
      if (exists) return prev;
      return [...prev, track];
    });
  };

  const removeTrackFromQueue = (index: number) => {
    setPlaylistTracks((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== index);
      if (trackIndex >= next.length) {
        setTrackIndex(0);
      }
      return next;
    });
  };

  const moveTrackInQueue = (index: number, direction: "up" | "down") => {
    setPlaylistTracks((prev) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const item = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = item;
      return copy;
    });
  };

  const saveAndSyncQueue = async () => {
    setSavingPlaylist(true);
    setSavedPlaylist(false);
    try {
      const res = await saveRadioPlaylistAction(playlistTracks);
      if (res?.ok) {
        setSavedPlaylist(true);
        setTimeout(() => setSavedPlaylist(false), 3000);

        // 1. Local BroadcastChannel
        localChannelRef.current?.postMessage({
          type: "playlist_sync",
          tracks: playlistTracks,
          trackIndex,
          timestamp: Date.now(),
        });

        // 2. Supabase Realtime
        for (const ch of realtimeChannelsRef.current) {
          ch.send({
            type: "broadcast",
            event: "playlist_sync",
            payload: {
              tracks: playlistTracks,
              trackIndex,
            },
          });
        }
      }
    } catch {
      // Ignora erro
    } finally {
      setSavingPlaylist(false);
    }
  };

  const addCustomTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim() || !customTitle.trim()) return;
    const newTrack: RadioTrack = {
      id: `custom-${Date.now()}`,
      title: customTitle.trim(),
      artist: customArtist.trim() || "Rádio Tarhget",
      audioUrl: customUrl.trim(),
    };
    addTrackToQueue(newTrack);
    setCustomTitle("");
    setCustomArtist("");
    setCustomUrl("");
  };

  const searchRadioBrowser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    const trimmed = query.trim();
    if (!trimmed) return;

    setSearching(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        name: trimmed,
        limit: "8",
        hidebroken: "true",
        order: "clickcount",
        reverse: "true",
        is_https: "true",
      });
      const res = await fetch(
        `https://de1.api.radio-browser.info/json/stations/search?${params.toString()}`,
      );
      if (!res.ok) throw new Error("Falha na busca");
      const data = (await res.json()) as RadioBrowserResult[];
      const mapped: RadioStation[] = data
        .filter((item) => item.url_resolved?.startsWith("https://"))
        .map((item) => ({
          id: item.stationuuid,
          name: item.name.trim(),
          genre: item.tags?.split(",")[0] || item.countrycode || "Rádio Online",
          url: item.url_resolved,
        }));
      setSearchResults(mapped);
    } catch {
      setError("Erro ao buscar rádios.");
    } finally {
      setSearching(false);
    }
  };

  const filteredCatalog = musicCatalog.filter(
    (t) =>
      t.title.toLowerCase().includes(musicSearchQuery.toLowerCase()) ||
      t.artist.toLowerCase().includes(musicSearchQuery.toLowerCase())
  );

  return (
    <div className="mx-3 mb-2 rounded-xl border border-[#e7e5e4] bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <audio
        ref={audioRef}
        preload="none"
        onEnded={() => {
          if (isPlaylistMode) {
            playNextTrack();
          }
        }}
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
      <audio
        ref={spotAudioRef}
        preload="none"
        onEnded={() => {
          setPreviewingSpotId(null);
          setLiveBroadcastSpot(null);
        }}
        onError={() => {
          setPreviewingSpotId(null);
          setLiveBroadcastSpot(null);
        }}
      />

      {/* Alerta de Transmissão ao Vivo */}
      {broadcastNotification && (
        <div className="mb-2 rounded-md bg-amber-500/15 px-2 py-1 text-center text-[10px] font-bold text-amber-800 animate-pulse">
          {broadcastNotification}
        </div>
      )}

      {/* Linha Principal do Player: Play/Pause + Título + Volume + Config */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Pausar rádio" : "Tocar rádio"}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg transition-opacity hover:opacity-90"
          style={{
            backgroundColor: playing ? "var(--brand-primary, #1c1917)" : "#1c1917",
            color: playing ? "var(--brand-foreground, #ffffff)" : "#ffffff",
          }}
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : playing ? (
            <Pause className="size-3.5 fill-current" />
          ) : (
            <Play className="size-3.5 translate-x-[0.5px] fill-current" />
          )}
        </button>

        {isPlaylistMode && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={playPrevTrack}
              title="Música anterior"
              className="flex size-6 items-center justify-center rounded text-[#71717a] hover:bg-stone-100 hover:text-stone-900"
            >
              <SkipBack className="size-3" />
            </button>
            <button
              type="button"
              onClick={playNextTrack}
              title="Próxima música"
              className="flex size-6 items-center justify-center rounded text-[#71717a] hover:bg-stone-100 hover:text-stone-900"
            >
              <SkipForward className="size-3" />
            </button>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <Radio
              className="size-3 shrink-0 text-[#71717a]"
              style={playing ? { color: "var(--brand-primary, #1c1917)" } : undefined}
            />
            <span className="truncate text-[11px] font-semibold text-[#0a0a0a]">
              {isPlaylistMode ? "Rádio Tarhget" : current.name}
            </span>
          </div>
          <p className="truncate text-[10px] text-[#71717a]">
            {liveBroadcastSpot
              ? `🔴 NO AR: ${liveBroadcastSpot.title}`
              : savingStation
                ? "Salvando rádio p/ equipe..."
                : playing
                  ? isPlaylistMode
                    ? `${currentTrack?.title} • ${currentTrack?.artist}${spotIntervalMinutes > 0 ? ` • Spot em ${formatTimer(nextSpotSeconds)}` : ""}`
                    : `Ao vivo • ${current.genre}${spotIntervalMinutes > 0 ? ` • Spot em ${formatTimer(nextSpotSeconds)}` : ""}`
                  : isPlaylistMode
                    ? `${playlistTracks.length} faixas • Rádio Tarhget${spotIntervalMinutes > 0 ? ` • A cada ${spotIntervalMinutes}m` : ""}`
                    : current.genre}
          </p>
        </div>

        {/* Volume */}
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Ativar som" : "Silenciar"}
          className="text-[#71717a] hover:text-[#0a0a0a]"
        >
          {muted || volume === 0 ? (
            <VolumeX className="size-3.5" />
          ) : (
            <Volume2 className="size-3.5" />
          )}
        </button>

        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          aria-label="Volume da rádio"
          value={muted ? 0 : volume}
          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
          className="h-1 w-9 cursor-pointer accent-[#1c1917]"
        />

        {/* Botão de Abrir Estúdio DJ */}
        <button
          type="button"
          onClick={() => setConfigOpen(true)}
          title="Abrir Estúdio DJ da Rádio Tarhget"
          className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-900 hover:text-white transition active:scale-95"
        >
          <Headphones className="size-3.5 text-amber-600" />
        </button>
      </div>

      {/* BOTÕES DE ACESSO RÁPIDO AO ESTÚDIO DJ */}
      <div className="mt-2 flex gap-1 border-t border-[#f4f4f5] pt-1.5">
        <button
          type="button"
          onClick={() => {
            setActiveTab("fila");
            setConfigOpen(true);
          }}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#e7e5e4] bg-[#fafaf9] py-1 text-[10px] font-semibold text-[#1c1917] transition hover:bg-stone-100 hover:border-amber-400 active:scale-98"
        >
          <ListMusic className="size-3 text-amber-600" />
          <span>Fila ({playlistTracks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("spots");
            setConfigOpen(true);
          }}
          className="flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50/60 px-2 py-1 text-[10px] font-semibold text-violet-900 transition hover:bg-violet-100 active:scale-98"
        >
          <Sparkles className="size-3 text-violet-600" />
          <span>
            Spots {spotIntervalMinutes > 0 ? `⏱️ ${formatTimer(nextSpotSeconds)}` : "(Manual)"}
          </span>
        </button>
      </div>

      {/* MODAL / ESTÚDIO DJ PROFISSIONAL FLUTUANTE (ESPAÇO OTIMIZADO) */}
      {configOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Estúdio DJ Rádio Tarhget"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfigOpen(false);
          }}
        >
          <div className="flex flex-col w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header do Estúdio DJ */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-900 text-white">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500 text-stone-950 font-bold shadow-xs">
                  <Headphones className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-bold tracking-tight text-white">
                      Estúdio DJ — Rádio Tarhget
                    </h2>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                      <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                      {playing ? "TRANSMITINDO NO AR" : "ESTÚDIO PRONTO"}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400">
                    Controle de músicas em tempo real, vinhetas institucionais ao vivo e sincronização com candidatos
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfigOpen(false)}
                  title="Fechar Estúdio DJ (Esc)"
                  className="flex size-9 items-center justify-center rounded-xl bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-white transition"
                >
                  <X className="size-4.5" />
                </button>
              </div>
            </div>

            {/* Menu de Abas Superior */}
            <div className="flex items-center border-b border-stone-200 bg-stone-100 px-6 gap-2 pt-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("fila")}
                className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold transition ${
                  activeTab === "fila"
                    ? "border-amber-600 text-stone-950 bg-white rounded-t-xl shadow-xs"
                    : "border-transparent text-stone-600 hover:text-stone-900"
                }`}
              >
                <ListMusic className="size-4 text-amber-600" />
                <span>Fila de Músicas & Catálogo</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-900 font-bold">
                  {playlistTracks.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("spots")}
                className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold transition ${
                  activeTab === "spots"
                    ? "border-violet-600 text-stone-950 bg-white rounded-t-xl shadow-xs"
                    : "border-transparent text-stone-600 hover:text-stone-900"
                }`}
              >
                <Sparkles className="size-4 text-violet-600" />
                <span>Spots & Vinhetas no Ar</span>
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] text-violet-900 font-bold">
                  {TARGET_RADIO_SPOTS.length} spots
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("estacao")}
                className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold transition ${
                  activeTab === "estacao"
                    ? "border-stone-900 text-stone-950 bg-white rounded-t-xl shadow-xs"
                    : "border-transparent text-stone-600 hover:text-stone-900"
                }`}
              >
                <Radio className="size-4 text-stone-700" />
                <span>Rádios FM & Estações</span>
              </button>
            </div>

            {/* Conteúdo com Espaço Amplo e Scroll Interno */}
            <div className="flex-1 overflow-y-auto bg-stone-50/50 p-6">
              {/* ABA 1: FILA DE MÚSICAS & CATÁLOGO */}
              {activeTab === "fila" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Coluna Esquerda: Fila Atual no Ar (7 cols) */}
                  <div className="lg:col-span-7 flex flex-col space-y-3">
                    <div className="flex items-center justify-between bg-white rounded-xl border border-stone-200 p-3.5 shadow-xs">
                      <div>
                        <h3 className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                          <Music className="size-4 text-amber-600" />
                          Fila de Reprodução da Rádio Tarhget
                        </h3>
                        <p className="text-xs text-stone-500">
                          {playlistTracks.length} faixas na ordem de transmissão aos candidatos
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={saveAndSyncQueue}
                        disabled={savingPlaylist}
                        className="flex items-center gap-1.5 rounded-lg bg-stone-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-black active:scale-95 transition disabled:opacity-50"
                      >
                        {savingPlaylist ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : savedPlaylist ? (
                          <Check className="size-3.5 text-emerald-400" />
                        ) : null}
                        {savedPlaylist ? "Salvo no Ar!" : "Salvar Fila no Ar"}
                      </button>
                    </div>

                    {!isPlaylistMode && (
                      <button
                        type="button"
                        onClick={() => selectStationAsAdmin(CURATED_STATIONS[0])}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-500/20 transition"
                      >
                        <RadioTower className="size-4 text-amber-700" />
                        <span>Sintonizar Rádio Tarhget para Tocar a Fila</span>
                      </button>
                    )}

                    {/* Lista com Espaço Amplo */}
                    <div className="flex-1 max-h-[460px] overflow-y-auto space-y-1.5 rounded-xl border border-stone-200 bg-white p-2 shadow-xs">
                      {playlistTracks.map((track, idx) => {
                        const isCurrent = isPlaylistMode && idx === trackIndex;
                        return (
                          <div
                            key={`${track.id}-${idx}`}
                            className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition ${
                              isCurrent
                                ? "bg-amber-500/15 border border-amber-500/30 text-stone-950 font-bold"
                                : "bg-stone-50/80 hover:bg-stone-100 text-stone-800 border border-transparent"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (!isPlaylistMode) selectStationAsAdmin(CURATED_STATIONS[0]);
                                setTrackIndex(idx);
                                broadcastTrackChange(idx, playlistTracks[idx]);
                                if (!playing) togglePlay();
                              }}
                              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                            >
                              <span className="text-xs font-mono font-bold text-stone-400 w-5 shrink-0">
                                {String(idx + 1).padStart(2, "0")}
                              </span>
                              {isCurrent ? (
                                <Disc className="size-4 text-amber-600 shrink-0 animate-spin" />
                              ) : (
                                <Play className="size-3.5 text-stone-400 shrink-0 hover:text-stone-900" />
                              )}
                              <div className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-semibold text-stone-900">
                                  {track.title}
                                </span>
                                <span className="block truncate text-[11px] text-stone-500 font-normal">
                                  {track.artist}
                                </span>
                              </div>
                            </button>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => moveTrackInQueue(idx, "up")}
                                disabled={idx === 0}
                                title="Mover para cima"
                                className="p-1.5 rounded-md text-stone-500 hover:bg-stone-200 hover:text-stone-900 transition disabled:opacity-20"
                              >
                                <ArrowUp className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveTrackInQueue(idx, "down")}
                                disabled={idx === playlistTracks.length - 1}
                                title="Mover para baixo"
                                className="p-1.5 rounded-md text-stone-500 hover:bg-stone-200 hover:text-stone-900 transition disabled:opacity-20"
                              >
                                <ArrowDown className="size-3.5" />
                              </button>
                              {playlistTracks.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeTrackFromQueue(idx)}
                                  title="Remover da fila"
                                  className="p-1.5 rounded-md text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Coluna Direita: Catálogo & Adicionar Músicas (5 cols) */}
                  <div className="lg:col-span-5 flex flex-col space-y-4">
                    {/* Busca no Catálogo */}
                    <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs space-y-3">
                      <div>
                        <h4 className="font-bold text-stone-900 text-xs">
                          Catálogo de Músicas da Tarhget
                        </h4>
                        <p className="text-[11px] text-stone-500">
                          Adicione faixas eletrônicas, pop e lofi selecionadas à sua fila
                        </p>
                      </div>

                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" />
                        <input
                          type="text"
                          value={musicSearchQuery}
                          onChange={(e) => setMusicSearchQuery(e.target.value)}
                          placeholder="Buscar por título ou artista..."
                          className="h-8 w-full rounded-lg border border-stone-200 pl-8 pr-3 text-xs text-stone-900 placeholder:text-stone-400 focus:border-stone-800 focus:outline-none"
                        />
                      </div>

                      <div className="max-h-[220px] overflow-y-auto space-y-1.5 pr-1">
                        {filteredCatalog.map((item) => {
                          const inQueue = playlistTracks.some(
                            (t) => t.id === item.id || t.audioUrl === item.audioUrl
                          );
                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 p-2 text-xs border border-stone-100"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="block truncate font-semibold text-stone-800">
                                  {item.title}
                                </span>
                                <span className="block truncate text-[10px] text-stone-500">
                                  {item.artist}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => addTrackToQueue(item)}
                                disabled={inQueue}
                                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold transition shrink-0 ${
                                  inQueue
                                    ? "text-stone-400 bg-stone-200/60 cursor-default"
                                    : "bg-stone-900 text-white hover:bg-black active:scale-95"
                                }`}
                              >
                                {inQueue ? "Na fila" : <><Plus className="size-3" /> Fila</>}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Adicionar Link Direto (MP3) */}
                    <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs space-y-2.5">
                      <h4 className="font-bold text-stone-900 text-xs">
                        Adicionar Música por Link Direto (MP3)
                      </h4>
                      <form onSubmit={addCustomTrack} className="space-y-2">
                        <input
                          type="text"
                          value={customTitle}
                          onChange={(e) => setCustomTitle(e.target.value)}
                          placeholder="Título da música"
                          className="h-7 w-full rounded-lg border border-stone-200 px-2.5 text-xs text-stone-900"
                        />
                        <input
                          type="text"
                          value={customArtist}
                          onChange={(e) => setCustomArtist(e.target.value)}
                          placeholder="Artista"
                          className="h-7 w-full rounded-lg border border-stone-200 px-2.5 text-xs text-stone-900"
                        />
                        <input
                          type="url"
                          value={customUrl}
                          onChange={(e) => setCustomUrl(e.target.value)}
                          placeholder="https://.../musica.mp3"
                          className="h-7 w-full rounded-lg border border-stone-200 px-2.5 text-xs text-stone-900 font-mono"
                        />
                        <button
                          type="submit"
                          className="w-full rounded-lg bg-stone-900 py-1.5 text-xs font-bold text-white hover:bg-black transition active:scale-98"
                        >
                          Adicionar à Fila
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 2: SPOTS & VINHETAS NO AR */}
              {activeTab === "spots" && (
                <div className="space-y-5">
                  {/* Card de Frequência e Temporizador */}
                  <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Clock className="size-4 text-violet-700" />
                          <h3 className="text-sm font-bold text-violet-950">
                            Frequência dos Spots Institucionais
                          </h3>
                          {savingInterval && (
                            <span className="text-xs font-semibold text-amber-700 animate-pulse">
                              Salvando…
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-violet-800/80">
                          Escolha se deseja disparar os spots apenas manualmente ou a cada X minutos com ducking na música
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          id="spot-interval"
                          value={spotIntervalMinutes}
                          onChange={(e) => handleIntervalChange(parseInt(e.target.value, 10))}
                          className="h-8 rounded-lg border border-violet-300 bg-white px-2.5 text-xs font-semibold text-stone-900 shadow-xs outline-none focus:border-violet-600"
                        >
                          <option value={0}>Apenas manual (acionar quando eu quiser)</option>
                          <option value={3}>A cada 3 minutos</option>
                          <option value={5}>A cada 5 minutos</option>
                          <option value={10}>A cada 10 minutos (Recomendado)</option>
                          <option value={15}>A cada 15 minutos</option>
                          <option value={20}>A cada 20 minutos</option>
                          <option value={30}>A cada 30 minutos</option>
                        </select>

                        <button
                          type="button"
                          onClick={triggerNextSpotNow}
                          title="Disparar a próxima vinheta agora"
                          className="flex items-center gap-1.5 rounded-lg bg-violet-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-violet-950 active:scale-95 shrink-0"
                        >
                          <Zap className="size-3.5 text-amber-300" />
                          <span>Disparar Agora</span>
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between rounded-lg bg-white/80 border border-violet-200/80 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 text-stone-700">
                        <Sparkles className="size-3.5 text-violet-600" />
                        {spotIntervalMinutes > 0 ? (
                          <span>
                            Próximo spot automático em:{" "}
                            <strong className="text-violet-950 font-mono font-bold text-sm bg-violet-100 px-1.5 py-0.5 rounded">
                              {formatTimer(nextSpotSeconds)}
                            </strong>
                          </span>
                        ) : (
                          <span className="text-stone-500 font-medium">
                            Disparo automático desativado. Vinhetas serão tocadas apenas quando você acionar.
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] text-violet-900 font-semibold">
                        Pronúncia correta: <strong>TÁR-GUET</strong>
                      </span>
                    </div>
                  </div>

                  {/* Grid Amplo de Vinhetas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {TARGET_RADIO_SPOTS.map((spot) => {
                      const isPreviewing = previewingSpotId === spot.id;
                      const isLive = liveBroadcastSpot?.id === spot.id;
                      return (
                        <div
                          key={spot.id}
                          className={`flex flex-col justify-between rounded-xl border p-4 transition shadow-xs ${
                            isLive
                              ? "border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/30"
                              : "border-stone-200 bg-white hover:border-stone-300"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-stone-900 text-sm">
                                {spot.title}
                              </span>
                              {spot.durationSeconds && (
                                <span className="rounded-md bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-900 shrink-0">
                                  ⏱️ {spot.durationSeconds}s
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-stone-500">
                              {spot.subtitle}
                            </p>
                          </div>

                          <div className="mt-4 flex items-center justify-end gap-2 border-t border-stone-100 pt-3">
                            <button
                              type="button"
                              onClick={() => toggleSpotPreview(spot)}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                isPreviewing
                                  ? "bg-stone-900 text-white"
                                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                              }`}
                            >
                              {isPreviewing ? "Parar Prévia" : "Ouvir Prévia"}
                            </button>

                            <button
                              type="button"
                              onClick={() => broadcastSpotLive(spot)}
                              className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-amber-700 active:scale-95"
                            >
                              <Radio className="size-3.5" />
                              <span>🔴 Transmitir No Ar</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ABA 3: SELEÇÃO DE ESTAÇÃO */}
              {activeTab === "estacao" && (
                <div className="max-w-2xl mx-auto space-y-4">
                  <div className="flex items-center justify-between bg-white rounded-xl border border-stone-200 p-4 shadow-xs">
                    <div>
                      <h3 className="font-bold text-stone-900 text-sm">
                        Estação da Empresa (Configuração do Painel)
                      </h3>
                      <p className="text-xs text-stone-500">
                        Selecione a Rádio Tarhget ou uma rádio pública online para os candidatos
                      </p>
                    </div>
                    {savingStation ? (
                      <span className="text-xs font-semibold text-amber-700 animate-pulse">
                        Salvando…
                      </span>
                    ) : savedStation ? (
                      <span className="text-xs font-semibold text-emerald-700">
                        ✓ Salvo para todos
                      </span>
                    ) : null}
                  </div>

                  <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs space-y-3">
                    <label className="text-xs font-bold text-stone-700 block">
                      Estação Ativa:
                    </label>
                    <select
                      aria-label="Selecionar estação de rádio para todos"
                      value={current.url}
                      onChange={(e) => {
                        const found = stations.find((s) => s.url === e.target.value);
                        if (found) selectStationAsAdmin(found);
                      }}
                      className="h-9 w-full truncate rounded-lg border border-stone-200 bg-stone-50 px-3 text-xs text-stone-900 font-medium outline-none focus:border-stone-800"
                    >
                      {stations.map((s) => (
                        <option key={s.url} value={s.url}>
                          {s.url === "playlist:target" ? "⭐ Rádio Tarhget (Playlist Oficial + Spots)" : s.name}
                        </option>
                      ))}
                    </select>

                    {current.url !== "playlist:target" && (
                      <button
                        type="button"
                        onClick={() => selectStationAsAdmin(CURATED_STATIONS[0])}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-stone-900 bg-stone-900 px-3 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-black active:scale-98"
                      >
                        <Radio className="size-4 text-amber-400" />
                        <span>Sintonizar Rádio Tarhget Agora</span>
                      </button>
                    )}
                  </div>

                  <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs space-y-3">
                    <h4 className="font-bold text-stone-900 text-xs">
                      Buscar Rádio Online no Mundo (Radio-Browser)
                    </h4>
                    <form onSubmit={searchRadioBrowser} className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" />
                        <input
                          type="text"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Buscar por nome (ex: Antena 1, Jovem Pan, Ibiza Global, BBC)..."
                          className="h-8 w-full rounded-lg border border-stone-200 pl-8 pr-3 text-xs text-stone-900 placeholder:text-stone-400 focus:border-stone-800 focus:outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={searching}
                        className="rounded-lg bg-stone-900 px-4 text-xs font-bold text-white hover:bg-black disabled:opacity-50 transition"
                      >
                        {searching ? "Buscando..." : "Buscar"}
                      </button>
                    </form>

                    {searchResults.length > 0 && (
                      <ul className="max-h-48 space-y-1 overflow-y-auto pr-1">
                        {searchResults.map((station) => (
                          <li key={station.id}>
                            <button
                              type="button"
                              onClick={() => {
                                selectStationAsAdmin(station);
                                setConfigOpen(false);
                              }}
                              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-stone-900 hover:bg-stone-100 transition"
                            >
                              <span className="truncate font-semibold">{station.name}</span>
                              <span className="ml-2 shrink-0 text-[11px] text-stone-500">
                                {station.genre}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer do Estúdio DJ com Barra de Status e Controles Rápidos */}
            <div className="flex items-center justify-between border-t border-stone-200 bg-white px-6 py-3 text-xs">
              <div className="flex items-center gap-2">
                <Radio className="size-4 text-amber-600 animate-pulse" />
                <span className="text-stone-500 font-medium">Sintonizado:</span>
                <strong className="text-stone-900 font-bold truncate max-w-sm">
                  {isPlaylistMode ? `${currentTrack?.title} • ${currentTrack?.artist}` : current.name}
                </strong>
              </div>

              <button
                type="button"
                onClick={() => setConfigOpen(false)}
                className="rounded-lg bg-stone-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-black transition active:scale-95"
              >
                Concluir & Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-[10px] font-medium text-red-600">{error}</p>
      )}
    </div>
  );
}