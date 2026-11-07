"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  Clock,
  Disc,
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
  const realtimeChannelRef = useRef<any>(null);

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

  // Intervalo e temporizador automático dos Spots / Vinhetas
  const [spotIntervalMinutes, setSpotIntervalMinutes] = useState(10);
  const [savingInterval, setSavingInterval] = useState(false);
  const [nextSpotSeconds, setNextSpotSeconds] = useState(10 * 60);
  const spotIndexRef = useRef(0);

  // Conecta ao Supabase Realtime para sincronização com candidatos
  const resolvedSlug = companySlug && companySlug !== "__admin__" ? companySlug : "global";

  useEffect(() => {
    try {
      const supabase = createClient();
      const channel = supabase.channel(`radio:${resolvedSlug}`);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          realtimeChannelRef.current = channel;
        }
      });

      return () => {
        void channel.unsubscribe();
        realtimeChannelRef.current = null;
      };
    } catch {
      // Ignora erro se não configurado
    }
  }, [resolvedSlug]);

  // Funções de transmissão ao vivo para a área do candidato
  const broadcastTrackChange = useCallback((newIndex: number, track: RadioTrack) => {
    const channel = realtimeChannelRef.current;
    if (channel) {
      channel.send({
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
    const channel = realtimeChannelRef.current;
    if (channel) {
      channel.send({
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
      if (!audio.src || audio.src !== activeAudioSrc) {
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

    const channel = realtimeChannelRef.current;
    if (channel) {
      channel.send({
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

        const channel = realtimeChannelRef.current;
        if (channel) {
          channel.send({
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

        {/* Botão de Configurações, Fila e Vinhetas */}
        <button
          type="button"
          onClick={() => setConfigOpen((prev) => !prev)}
          title="Fila de músicas, estações e spots"
          className={`flex size-6 shrink-0 items-center justify-center rounded-md ${
            configOpen
              ? "bg-stone-900 text-white"
              : "text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
          }`}
        >
          {configOpen ? (
            <X className="size-3.5" />
          ) : (
            <Settings2 className="size-3.5" />
          )}
        </button>
      </div>

      {/* BOTÕES DE ACESSO RÁPIDO VISÍVEIS (quando o painel não está aberto) */}
      {!configOpen && (
        <div className="mt-2 flex gap-1 border-t border-[#f4f4f5] pt-1.5">
          <button
            type="button"
            onClick={() => {
              setActiveTab("fila");
              setConfigOpen(true);
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#e7e5e4] bg-[#fafaf9] py-1 text-[10px] font-semibold text-[#1c1917] transition hover:bg-stone-100"
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
            className="flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50/60 px-2 py-1 text-[10px] font-semibold text-violet-900 transition hover:bg-violet-100"
          >
            <Sparkles className="size-3 text-violet-600" />
            <span>
              Spots {spotIntervalMinutes > 0 ? `⏱️ ${formatTimer(nextSpotSeconds)}` : "(Manual)"}
            </span>
          </button>
        </div>
      )}

      {/* PAINEL COMPLETO COM ABAS */}
      {configOpen && (
        <div className="mt-2.5 space-y-2.5 border-t border-[#e7e5e4] pt-2">
          {/* Menu de Abas */}
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-stone-100 p-0.5 text-[10px] font-semibold text-stone-600">
            <button
              type="button"
              onClick={() => setActiveTab("fila")}
              className={`flex items-center justify-center gap-1 rounded-md py-1 transition ${
                activeTab === "fila" ? "bg-white text-stone-900 shadow-xs" : ""
              }`}
            >
              <ListMusic className="size-3 text-amber-600" />
              <span>Fila ({playlistTracks.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("spots")}
              className={`flex items-center justify-center gap-1 rounded-md py-1 transition ${
                activeTab === "spots" ? "bg-white text-stone-900 shadow-xs" : ""
              }`}
            >
              <Sparkles className="size-3 text-violet-600" />
              <span>Spots {spotIntervalMinutes > 0 ? `(${formatTimer(nextSpotSeconds)})` : ""}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("estacao")}
              className={`flex items-center justify-center gap-1 rounded-md py-1 transition ${
                activeTab === "estacao" ? "bg-white text-stone-900 shadow-xs" : ""
              }`}
            >
              <Radio className="size-3 text-stone-600" />
              <span>Estação</span>
            </button>
          </div>

          {/* ABA 1: FILA DE MÚSICAS & BUSCA (DESTAQUE) */}
          {activeTab === "fila" && (
            <div className="space-y-2 text-[11px]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-stone-900 flex items-center gap-1">
                    <Music className="size-3 text-amber-600" />
                    Fila da Rádio Tarhget
                  </p>
                  <p className="text-[9px] text-[#71717a]">
                    Ordene as músicas e salve para todos os candidatos
                  </p>
                </div>
                <button
                  type="button"
                  onClick={saveAndSyncQueue}
                  disabled={savingPlaylist}
                  className="flex items-center gap-1 rounded-md bg-stone-900 px-2.5 py-1 text-[10px] font-bold text-white shadow-xs hover:bg-black active:scale-95 disabled:opacity-50"
                >
                  {savingPlaylist ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : savedPlaylist ? (
                    <Check className="size-3 text-emerald-400" />
                  ) : null}
                  {savedPlaylist ? "Salvo no Ar!" : "Salvar Fila"}
                </button>
              </div>

              {/* Se a rádio ativa não for a Tarhget, botão para ativar com 1 clique */}
              {!isPlaylistMode && (
                <button
                  type="button"
                  onClick={() => selectStationAsAdmin(CURATED_STATIONS[0])}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] font-bold text-amber-900 hover:bg-amber-500/20"
                >
                  <RadioTower className="size-3 text-amber-700" />
                  <span>Sintonizar Rádio Tarhget para Tocar a Fila</span>
                </button>
              )}

              {/* Lista das músicas da Fila Atual */}
              <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-[#f4f4f5] p-1 bg-[#fafaf9]">
                {playlistTracks.map((track, idx) => {
                  const isCurrent = isPlaylistMode && idx === trackIndex;
                  return (
                    <div
                      key={`${track.id}-${idx}`}
                      className={`flex items-center justify-between gap-1 rounded px-2 py-1 ${
                        isCurrent
                          ? "bg-amber-500/15 border border-amber-500/25 font-bold text-stone-900"
                          : "bg-white text-[#27272a] hover:bg-stone-50 border border-transparent"
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
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                      >
                        <span className="text-[9px] font-mono text-[#a1a1aa] w-3 shrink-0">
                          {idx + 1}
                        </span>
                        {isCurrent ? (
                          <Disc className="size-3 text-amber-600 shrink-0 animate-spin" />
                        ) : null}
                        <span className="truncate text-[10px]">
                          {track.title} · <span className="text-[#71717a] font-normal">{track.artist}</span>
                        </span>
                      </button>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveTrackInQueue(idx, "up")}
                          disabled={idx === 0}
                          title="Mover para cima"
                          className="p-1 rounded text-[#71717a] hover:bg-stone-200 hover:text-stone-900 disabled:opacity-20"
                        >
                          <ArrowUp className="size-2.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveTrackInQueue(idx, "down")}
                          disabled={idx === playlistTracks.length - 1}
                          title="Mover para baixo"
                          className="p-1 rounded text-[#71717a] hover:bg-stone-200 hover:text-stone-900 disabled:opacity-20"
                        >
                          <ArrowDown className="size-2.5" />
                        </button>
                        {playlistTracks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeTrackFromQueue(idx)}
                            title="Remover da fila"
                            className="p-1 rounded text-red-500 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="size-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Busca e Adição de Músicas do Catálogo */}
              <div className="rounded-lg border border-[#e7e5e4] bg-white p-2 space-y-1.5">
                <p className="text-[10px] font-bold text-stone-900">
                  Buscar no Catálogo de Músicas
                </p>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-[#a1a1aa]" />
                  <input
                    type="text"
                    value={musicSearchQuery}
                    onChange={(e) => setMusicSearchQuery(e.target.value)}
                    placeholder="Buscar (ex: RÜFÜS, Tinlicker, Tiësto, Beats)..."
                    className="h-6 w-full rounded border border-[#e4e4e7] pl-6 pr-2 text-[10px] text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#71717a] focus:outline-none"
                  />
                </div>

                <div className="max-h-28 overflow-y-auto space-y-1">
                  {filteredCatalog.map((item) => {
                    const inQueue = playlistTracks.some(
                      (t) => t.id === item.id || t.audioUrl === item.audioUrl
                    );
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-1 rounded bg-[#fafaf9] px-2 py-1 text-[10px]"
                      >
                        <span className="truncate">
                          <strong className="font-semibold text-stone-800">{item.title}</strong>{" "}
                          <span className="text-[#71717a]">· {item.artist}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => addTrackToQueue(item)}
                          disabled={inQueue}
                          className={`flex items-center gap-0.5 rounded px-2 py-0.5 text-[9px] font-bold transition ${
                            inQueue
                              ? "text-stone-400 bg-stone-100 cursor-default"
                              : "bg-stone-900 text-white hover:bg-black"
                          }`}
                        >
                          {inQueue ? "Na fila" : <><Plus className="size-2.5" /> Fila</>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Adicionar por URL direta */}
              <details className="text-[10px] text-stone-600">
                <summary className="cursor-pointer font-medium hover:text-stone-900">
                  + Inserir música por link direto (MP3)
                </summary>
                <form onSubmit={addCustomTrack} className="mt-1 space-y-1">
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Nome da música"
                    className="h-6 w-full rounded border border-[#e4e4e7] px-1.5 text-[10px]"
                  />
                  <input
                    type="text"
                    value={customArtist}
                    onChange={(e) => setCustomArtist(e.target.value)}
                    placeholder="Artista"
                    className="h-6 w-full rounded border border-[#e4e4e7] px-1.5 text-[10px]"
                  />
                  <input
                    type="url"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://.../audio.mp3"
                    className="h-6 w-full rounded border border-[#e4e4e7] px-1.5 text-[10px]"
                  />
                  <button
                    type="submit"
                    className="w-full rounded bg-stone-900 py-1 text-[10px] font-bold text-white hover:bg-black"
                  >
                    Adicionar à Fila
                  </button>
                </form>
              </details>
            </div>
          )}

          {/* ABA 2: SPOTS & VINHETAS NO AR */}
          {activeTab === "spots" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-stone-900 flex items-center gap-1">
                  <Sparkles className="size-3 text-amber-600" />
                  Vinhetas & Spots Tarhget
                </span>
                <span className="text-[9px] text-[#71717a]">
                  Pronúncia: Tár-guet
                </span>
              </div>

              {/* Card de Frequência / Tempo Definido */}
              <div className="rounded-lg border border-[#e7e5e4] bg-[#fafaf9] p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="spot-interval" className="text-[10px] font-bold text-stone-800 flex items-center gap-1">
                    <Clock className="size-3 text-violet-600" />
                    Frequência no Ar
                  </label>
                  {savingInterval ? (
                    <span className="text-[9px] font-semibold text-amber-700 animate-pulse">
                      Salvando…
                    </span>
                  ) : (
                    <span className="text-[9px] text-[#71717a]">
                      {spotIntervalMinutes > 0 ? "Automático" : "Manual"}
                    </span>
                  )}
                </div>

                <select
                  id="spot-interval"
                  value={spotIntervalMinutes}
                  onChange={(e) => handleIntervalChange(parseInt(e.target.value, 10))}
                  className="h-6 w-full rounded border border-[#e4e4e7] bg-white px-1.5 text-[10px] text-[#0a0a0a] outline-none"
                >
                  <option value={0}>Apenas manual (acionar quando eu quiser)</option>
                  <option value={3}>A cada 3 minutos</option>
                  <option value={5}>A cada 5 minutos</option>
                  <option value={10}>A cada 10 minutos (Recomendado)</option>
                  <option value={15}>A cada 15 minutos</option>
                  <option value={20}>A cada 20 minutos</option>
                  <option value={30}>A cada 30 minutos</option>
                </select>

                {/* Status do temporizador e disparo rápido */}
                <div className="flex items-center justify-between gap-1 rounded-md bg-white border border-[#e4e4e7] p-1.5 shadow-xs">
                  <div className="text-[10px] text-stone-700 flex items-center gap-1.5">
                    <Clock className="size-3.5 text-violet-600 shrink-0" />
                    {spotIntervalMinutes > 0 ? (
                      <span>
                        Próximo spot em:{" "}
                        <strong className="text-violet-950 font-mono font-bold text-[11px] bg-violet-100 px-1 py-0.5 rounded">
                          {formatTimer(nextSpotSeconds)}
                        </strong>
                      </span>
                    ) : (
                      <span className="text-[#71717a] text-[9.5px]">
                        Disparo automático desligado
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={triggerNextSpotNow}
                    title="Disparar a próxima vinheta agora"
                    className="flex items-center gap-1 rounded bg-violet-900 px-2 py-1 text-[9px] font-bold text-white shadow-xs transition hover:bg-violet-950 active:scale-95 shrink-0"
                  >
                    <Zap className="size-2.5 text-amber-300" />
                    <span>Disparar Agora</span>
                  </button>
                </div>
              </div>

              {/* Lista das Vinhetas com Disparo Imediato */}
              <div className="space-y-1.5 pt-0.5">
                <p className="text-[9px] text-stone-500">
                  Ou selecione uma vinheta específica para acionar na hora:
                </p>
                {TARGET_RADIO_SPOTS.map((spot) => {
                  const isPreviewing = previewingSpotId === spot.id;
                  const isLive = liveBroadcastSpot?.id === spot.id;
                  return (
                    <div
                      key={spot.id}
                      className={`rounded-lg border p-1.5 transition ${
                        isLive
                          ? "border-amber-400 bg-amber-500/10"
                          : "border-stone-200 bg-[#fafaf9]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[10px] font-bold text-stone-900">
                              {spot.title}
                            </span>
                            {spot.durationSeconds && (
                              <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[8.5px] font-bold text-violet-800 shrink-0">
                                ⏱️ {spot.durationSeconds}s
                              </span>
                            )}
                          </div>
                          <p className="truncate text-[9px] text-[#71717a]">
                            {spot.subtitle}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 ml-1.5">
                          <button
                            type="button"
                            onClick={() => toggleSpotPreview(spot)}
                            className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition ${
                              isPreviewing
                                ? "bg-stone-800 text-white"
                                : "bg-stone-200 text-stone-700 hover:bg-stone-300"
                            }`}
                          >
                            {isPreviewing ? "Parar" : "Ouvir"}
                          </button>

                          <button
                            type="button"
                            onClick={() => broadcastSpotLive(spot)}
                            className="flex items-center gap-1 rounded bg-amber-600 px-2 py-0.5 text-[9px] font-bold text-white shadow-xs transition hover:bg-amber-700 active:scale-95"
                          >
                            <Radio className="size-2.5" />
                            <span>No Ar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ABA 3: SELEÇÃO DE ESTAÇÃO */}
          {activeTab === "estacao" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium text-[#71717a]">
                  Estação da equipe (Admin)
                </p>
                {savingStation ? (
                  <span className="text-[9px] font-semibold text-amber-700 animate-pulse">
                    Salvando…
                  </span>
                ) : savedStation ? (
                  <span className="text-[9px] font-semibold text-emerald-700">
                    ✓ Salvo para todos
                  </span>
                ) : null}
              </div>

              <select
                aria-label="Selecionar estação de rádio para todos"
                value={current.url}
                onChange={(e) => {
                  const found = stations.find((s) => s.url === e.target.value);
                  if (found) selectStationAsAdmin(found);
                }}
                className="h-7 w-full truncate rounded-md border border-[#e4e4e7] bg-[#fafaf9] px-1.5 text-[11px] text-[#0a0a0a] outline-none focus:border-[#a1a1aa]"
              >
                {stations.map((s) => (
                  <option key={s.url} value={s.url}>
                    {s.url === "playlist:target" ? "Rádio Tarhget (Playlist Oficial)" : s.name}
                  </option>
                ))}
              </select>

              {current.url !== "playlist:target" && (
                <button
                  type="button"
                  onClick={() => selectStationAsAdmin(CURATED_STATIONS[0])}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md border border-stone-800 bg-stone-900 px-2 py-1 text-[10px] font-bold text-white shadow-xs transition hover:bg-black active:scale-98"
                >
                  <Radio className="size-3 text-amber-400" />
                  <span>Sintonizar Rádio Tarhget</span>
                </button>
              )}

              <form onSubmit={searchRadioBrowser} className="flex gap-1">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-[#a1a1aa]" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar outra rádio FM/Web..."
                    className="h-7 w-full rounded-md border border-[#e4e4e7] pl-6 pr-2 text-[11px] text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#71717a] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching}
                  className="rounded-md bg-[#1c1917] px-2 text-[11px] font-medium text-white hover:bg-[#292524] disabled:opacity-50"
                >
                  {searching ? "..." : "Buscar"}
                </button>
              </form>

              {searchResults.length > 0 && (
                <ul className="max-h-28 space-y-0.5 overflow-y-auto">
                  {searchResults.map((station) => (
                    <li key={station.id}>
                      <button
                        type="button"
                        onClick={() => {
                          selectStationAsAdmin(station);
                          setConfigOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded px-1.5 py-1 text-left text-[11px] text-[#0a0a0a] hover:bg-[#f4f4f5]"
                      >
                        <span className="truncate font-medium">{station.name}</span>
                        <span className="ml-2 shrink-0 text-[10px] text-[#71717a]">
                          {station.genre}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-[10px] font-medium text-red-600">{error}</p>
      )}
    </div>
  );
}