"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  Disc,
  ListMusic,
  Loader2,
  Music,
  Pause,
  Play,
  Plus,
  Radio,
  Search,
  Settings2,
  SkipBack,
  SkipForward,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import {
  getMusicCatalogAction,
  getRadioPlaylistAction,
  saveRadioPlaylistAction,
  saveRadioStationAction,
} from "@/server/controllers/settings.controller";
import {
  CURATED_STATIONS,
  TARGET_PLAYLIST_TRACKS,
  TARGET_RADIO_SPOTS,
  type RadioSpot,
  type RadioStation,
  type RadioTrack,
} from "@/server/models/radio.model";

export type { RadioStation, RadioSpot, RadioTrack };
export { CURATED_STATIONS, TARGET_PLAYLIST_TRACKS, TARGET_RADIO_SPOTS };

interface RadioBrowserResult {
  stationuuid: string;
  name: string;
  tags: string;
  countrycode: string;
  url_resolved: string;
}

const STORAGE_KEY_VOLUME = "triagem:radio:volume";

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

  // Normaliza o nome da Rádio Tarhget
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
  const [playlistTracks, setPlaylistTracks] = useState<RadioTrack[]>(TARGET_PLAYLIST_TRACKS);
  const [trackIndex, setTrackIndex] = useState(0);
  const currentTrack: RadioTrack =
    playlistTracks[trackIndex % (playlistTracks.length || 1)] ?? TARGET_PLAYLIST_TRACKS[0];

  const activeAudioSrc = isPlaylistMode ? currentTrack?.audioUrl : current.url;

  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);

  // Spots / Vinhetas
  const [previewingSpotId, setPreviewingSpotId] = useState<string | null>(null);
  const [liveBroadcastSpot, setLiveBroadcastSpot] = useState<RadioSpot | null>(null);

  // Painéis de configuração e fila
  const [configOpen, setConfigOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"estacao" | "fila" | "spots">("estacao");

  // Busca de rádios FM públicas
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<RadioStation[]>([]);

  // Catálogo e busca de músicas
  const [musicCatalog, setMusicCatalog] = useState<RadioTrack[]>(TARGET_PLAYLIST_TRACKS);
  const [musicSearchQuery, setMusicSearchQuery] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customArtist, setCustomArtist] = useState("");
  const [customUrl, setCustomUrl] = useState("");

  const [savingStation, setSavingStation] = useState(false);
  const [savedStation, setSavedStation] = useState(false);
  const [savingPlaylist, setSavingPlaylist] = useState(false);
  const [savedPlaylist, setSavedPlaylist] = useState(false);
  const [broadcastNotification, setBroadcastNotification] = useState<string | null>(null);

  // Conecta ao Supabase Realtime para transmitir vinhetas e atualizar playlists em tempo real
  useEffect(() => {
    if (!companySlug) return;
    try {
      const supabase = createClient();
      const channel = supabase.channel(`radio:${companySlug}`);
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
  }, [companySlug]);

  // Carrega a playlist salva e o catálogo de músicas do servidor
  useEffect(() => {
    void (async () => {
      try {
        const [savedQueue, catalog] = await Promise.all([
          getRadioPlaylistAction(),
          getMusicCatalogAction(),
        ]);
        if (savedQueue && savedQueue.length > 0) {
          setPlaylistTracks(savedQueue);
        }
        if (catalog && catalog.length > 0) {
          setMusicCatalog(catalog);
        }
      } catch {
        // Fallback para valores padrão
      }
    })();
  }, []);

  // Sincroniza se o servidor atualizar a estação
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

  // Aplica volumes
  useEffect(() => {
    if (audioRef.current) {
      // Se houver vinheta tocando, aplica ducking no áudio da rádio
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

  // Se a faixa da playlist mudar enquanto está tocando
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
    setTrackIndex((i) => (i + 1) % playlistTracks.length);
  };

  const playPrevTrack = () => {
    if (!isPlaylistMode || playlistTracks.length === 0) return;
    setTrackIndex((i) => (i - 1 + playlistTracks.length) % playlistTracks.length);
  };

  const selectStationAsAdmin = async (station: RadioStation) => {
    if (!canManage) return;
    const norm = normalizeStation(station);
    setCurrent(norm);
    setError(null);
    setStations((prev) =>
      prev.some((s) => s.url === norm.url) ? prev : [norm, ...prev]
    );

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
          ? (playlistTracks[0]?.audioUrl || TARGET_PLAYLIST_TRACKS[0].audioUrl)
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
    // 1. Toca no player do gestor com ducking
    const audio = spotAudioRef.current;
    if (audio) {
      audio.src = spot.audioUrl;
      audio.play().then(() => {
        setLiveBroadcastSpot(spot);
      }).catch(() => {});
    }

    // 2. Dispara sinal via Realtime para todos os candidatos
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
      const exists = prev.some((t) => t.id === track.id && t.audioUrl === track.audioUrl);
      if (exists) return prev;
      return [...prev, track];
    });
  };

  const removeTrackFromQueue = (index: number) => {
    setPlaylistTracks((prev) => {
      if (prev.length <= 1) return prev; // Mantém pelo menos 1 música
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

        // Notifica candidatos via Realtime
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

  // Filtra músicas do catálogo para a busca
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

      {/* Notificação de Vinheta no Ar */}
      {broadcastNotification && (
        <div className="mb-2 rounded-md bg-amber-500/10 px-2 py-1 text-center text-[10px] font-bold text-amber-700 animate-pulse">
          {broadcastNotification}
        </div>
      )}

      {/* Player: Controles + Título + Volume */}
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
                    ? `${currentTrack?.title} • ${currentTrack?.artist}`
                    : `Ao vivo • ${current.genre}`
                  : isPlaylistMode
                    ? `${playlistTracks.length} faixas • Rádio Oficial`
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

        {/* Botão de Fila & Músicas (acessível quando em playlist) */}
        <button
          type="button"
          onClick={() => {
            setQueueOpen((prev) => !prev);
            if (!queueOpen) setConfigOpen(false);
          }}
          title="Fila de músicas da Rádio Tarhget"
          className={`flex size-6 shrink-0 items-center justify-center rounded-md ${
            queueOpen
              ? "bg-stone-900 text-white"
              : "text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
          }`}
        >
          <ListMusic className="size-3.5" />
        </button>

        {/* Botão de configuração de estação / spots */}
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setConfigOpen((prev) => !prev);
              if (!configOpen) setQueueOpen(false);
            }}
            title="Estações, Fila e Vinhetas no Ar"
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
        )}
      </div>

      {/* PAINEL: Fila e Músicas da Rádio Tarhget */}
      {queueOpen && (
        <div className="mt-2.5 space-y-2 border-t border-[#e7e5e4] pt-2 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="font-bold text-stone-900 flex items-center gap-1">
              <Music className="size-3 text-amber-600" />
              Fila da Rádio Tarhget ({playlistTracks.length})
            </span>
            <button
              type="button"
              onClick={saveAndSyncQueue}
              disabled={savingPlaylist}
              className="flex items-center gap-1 rounded bg-stone-900 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-black disabled:opacity-50"
            >
              {savingPlaylist ? (
                <Loader2 className="size-2.5 animate-spin" />
              ) : savedPlaylist ? (
                <Check className="size-2.5 text-emerald-400" />
              ) : null}
              {savedPlaylist ? "Sincronizado!" : "Salvar Fila"}
            </button>
          </div>

          {/* Lista da Fila Atual com Reordenação */}
          <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
            {playlistTracks.map((track, idx) => {
              const isCurrent = isPlaylistMode && idx === trackIndex;
              return (
                <div
                  key={`${track.id}-${idx}`}
                  className={`flex items-center justify-between gap-1 rounded px-1.5 py-1 ${
                    isCurrent
                      ? "bg-amber-500/10 border border-amber-500/20 font-medium text-stone-900"
                      : "bg-[#fafaf9] text-[#27272a] hover:bg-stone-100"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setTrackIndex(idx);
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
                      {track.title} · <span className="text-[#71717a]">{track.artist}</span>
                    </span>
                  </button>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveTrackInQueue(idx, "up")}
                      disabled={idx === 0}
                      title="Mover para cima"
                      className="p-0.5 text-[#71717a] hover:text-stone-900 disabled:opacity-20"
                    >
                      <ArrowUp className="size-2.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTrackInQueue(idx, "down")}
                      disabled={idx === playlistTracks.length - 1}
                      title="Mover para baixo"
                      className="p-0.5 text-[#71717a] hover:text-stone-900 disabled:opacity-20"
                    >
                      <ArrowDown className="size-2.5" />
                    </button>
                    {playlistTracks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTrackFromQueue(idx)}
                        title="Remover da fila"
                        className="p-0.5 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="size-2.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Busca no Catálogo Local de Músicas */}
          <div className="pt-1.5 border-t border-[#f4f4f5]">
            <p className="text-[10px] font-semibold text-stone-700 mb-1">
              Buscar e Adicionar Músicas
            </p>
            <div className="relative mb-1.5">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-[#a1a1aa]" />
              <input
                type="text"
                value={musicSearchQuery}
                onChange={(e) => setMusicSearchQuery(e.target.value)}
                placeholder="Buscar (ex: RÜFÜS, Tinlicker, Lo-Fi)..."
                className="h-6 w-full rounded border border-[#e4e4e7] pl-6 pr-2 text-[10px] text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#71717a] focus:outline-none"
              />
            </div>

            <div className="max-h-24 overflow-y-auto space-y-1">
              {filteredCatalog.map((item) => {
                const inQueue = playlistTracks.some(
                  (t) => t.id === item.id || t.audioUrl === item.audioUrl
                );
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-1 rounded bg-[#fafaf9] px-1.5 py-0.5"
                  >
                    <span className="truncate text-[10px] text-stone-800">
                      {item.title} <span className="text-stone-400">· {item.artist}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => addTrackToQueue(item)}
                      disabled={inQueue}
                      className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-semibold ${
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

          {/* Adicionar Link Externo / MP3 Próprio */}
          <details className="text-[10px] text-stone-600">
            <summary className="cursor-pointer font-medium hover:text-stone-900">
              + Adicionar áudio por URL direta (MP3)
            </summary>
            <form onSubmit={addCustomTrack} className="mt-1 space-y-1">
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Título da música"
                className="h-6 w-full rounded border border-[#e4e4e7] px-1.5 text-[10px]"
              />
              <input
                type="text"
                value={customArtist}
                onChange={(e) => setCustomArtist(e.target.value)}
                placeholder="Artista / Produtor"
                className="h-6 w-full rounded border border-[#e4e4e7] px-1.5 text-[10px]"
              />
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://.../musica.mp3"
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

      {/* PAINEL: Estações e Vinhetas no Ar (Exclusivo Admin/Gestor) */}
      {canManage && configOpen && (
        <div className="mt-2.5 space-y-2.5 border-t border-[#e7e5e4] pt-2">
          {/* Navegação por abas dentro das configurações */}
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-stone-100 p-0.5 text-[10px] font-semibold text-stone-600">
            <button
              type="button"
              onClick={() => setActiveTab("estacao")}
              className={`rounded-md py-1 transition ${
                activeTab === "estacao" ? "bg-white text-stone-900 shadow-xs" : ""
              }`}
            >
              Estação
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("spots")}
              className={`flex items-center justify-center gap-1 rounded-md py-1 transition ${
                activeTab === "spots" ? "bg-white text-stone-900 shadow-xs" : ""
              }`}
            >
              <Sparkles className="size-2.5 text-amber-600" />
              Spots & Vinhetas
            </button>
          </div>

          {activeTab === "estacao" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium text-[#71717a]">
                  Estação da equipe & candidatos
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
                  <span>Ativar Rádio Tarhget Oficial</span>
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

          {activeTab === "spots" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-stone-900 flex items-center gap-1">
                  <Sparkles className="size-3 text-amber-600" />
                  Vinhetas Tarhget Masterizadas
                </span>
                <span className="text-[9px] text-[#71717a]">
                  Pronúncia Oficial: Tár-guet
                </span>
              </div>
              <p className="text-[9px] text-stone-500">
                Ao disparar no ar, o volume da música dos candidatos baixa suavemente e a vinheta toca com efeitos de rádio FM.
              </p>

              <div className="space-y-1.5 pt-1">
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
                          <p className="truncate text-[10px] font-bold text-stone-900">
                            {spot.title}
                          </p>
                          <p className="truncate text-[9px] text-[#71717a]">
                            {spot.subtitle}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 ml-1.5">
                          {/* Testar no fone local */}
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

                          {/* Disparar AO VIVO para os candidatos */}
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
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-[10px] font-medium text-red-600">{error}</p>
      )}
    </div>
  );
}