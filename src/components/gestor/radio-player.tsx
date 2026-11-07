"use client";

import {
  ArrowDown,
  ArrowUp,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Disc,
  Headphones,
  ListMusic,
  Loader2,
  Mic,
  Music,
  Pause,
  Play,
  Plus,
  Radio,
  RadioTower,
  RefreshCw,
  Search,
  Send,
  Settings2,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  User,
  Users,
  Volume1,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { createClient } from "@/lib/supabase/client";
import { playVoiceSpeech, stopVoiceSpeech } from "@/lib/audio-speech";
import { NewsTicker } from "@/components/common/news-ticker";
import {
  generateRadioSpotAction,
  getMusicCatalogAction,
  getRadioPlaylistAction,
  getRadioSpotIntervalAction,
  getRadioSpotsAction,
  saveRadioPlaylistAction,
  saveRadioSpotIntervalAction,
  saveRadioSpotsAction,
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
const STORAGE_KEY_DELETED_SPOTS = "triagem:radio:deleted_spots";
const STORAGE_KEY_SPOTS_CACHE = "triagem:radio:spots_cache";

function readDeletedSpotIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_SPOTS);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function writeDeletedSpotIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_DELETED_SPOTS, JSON.stringify(Array.from(ids)));
  } catch {
    // Ignora erro de storage
  }
}

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
  const sfxAudioRef = useRef<HTMLAudioElement | null>(null);
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

  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);
  const [crossfadeEnabled, setCrossfadeEnabled] = useState(true);
  const [playbackMode, setPlaybackMode] = useState<"auto" | "manual">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("triagem:gestor:radio:mode") as "auto" | "manual") || "auto";
    }
    return "auto";
  });
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const val = localStorage.getItem("triagem:gestor:radio:broadcasting");
      return val !== "false";
    }
    return true;
  });

  // Spots / Vinhetas gerenciadas
  const [spotsList, setSpotsList] = useState<RadioSpot[]>(() => {
    const deleted = readDeletedSpotIds();
    return TARGET_RADIO_SPOTS.filter((s) => !deleted.has(s.id));
  });
  const [previewingSpotId, setPreviewingSpotId] = useState<string | null>(null);
  const [liveBroadcastSpot, setLiveBroadcastSpot] = useState<RadioSpot | null>(null);
  const [savingSpots, setSavingSpots] = useState(false);
  const [savedSpots, setSavedSpots] = useState(false);
  const [previewingShoutout, setPreviewingShoutout] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const needsTransitionOutroRef = useRef<boolean>(false);

  // Modal de Criação de Vinheta com IA
  const [showNewSpotModal, setShowNewSpotModal] = useState(false);
  const [newSpotTitle, setNewSpotTitle] = useState("");
  const [newSpotScript, setNewSpotScript] = useState("");
  const [newSpotVoice, setNewSpotVoice] = useState("pt-BR-FranciscaNeural");
  const [newSpotSfx, setNewSpotSfx] = useState("raio-trovao");
  const [generatingSpot, setGeneratingSpot] = useState(false);

  // Painéis e abas de controle
  const [configOpen, setConfigOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"fila" | "spots" | "alo" | "estacao">("fila");

  // Candidatos Online via Supabase Presence + Local BroadcastChannel
  const [onlineCandidates, setOnlineCandidates] = useState<
    Array<{ key: string; name?: string; path?: string; isRegistered?: boolean; lastSeen?: number }>
  >([]);
  const [customCandidateInput, setCustomCandidateInput] = useState<string>("");

  // Estúdio de Alô no Ar & Recados aos Candidatos Online
  const [selectedCandidate, setSelectedCandidate] = useState<string>("all");
  const [shoutoutMessage, setShoutoutMessage] = useState<string>(
    "Olá! A equipe da Tarhget viu que você está por aqui. Seja muito bem-vindo ao nosso portal e tenha um excelente dia!"
  );
  const [shoutoutVoice, setShoutoutVoice] = useState<string>("pt-BR-FranciscaNeural");
  const [sendingShoutout, setSendingShoutout] = useState(false);
  const [sentShoutout, setSentShoutout] = useState(false);

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
  const [uploadingMp3, setUploadingMp3] = useState(false);
  const mp3FileInputRef = useRef<HTMLInputElement | null>(null);
  const [broadcastNotification, setBroadcastNotification] = useState<string | null>(null);

  // Intervalo e temporizador automático dos Spots / Vinhetas (0 = manual apenas, padrão)
  const [spotIntervalMinutes, setSpotIntervalMinutes] = useState(0);
  const [savingInterval, setSavingInterval] = useState(false);
  const [nextSpotSeconds, setNextSpotSeconds] = useState(0);
  const spotIndexRef = useRef(0);

  // Conecta ao Supabase Realtime e BroadcastChannel para sincronização instantânea
  const resolvedSlug = companySlug && companySlug !== "__admin__" ? companySlug : "global";

  // 1. BroadcastChannel instantâneo para sincronia de comandos e detecção imediata de abas de candidatos
  useEffect(() => {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      const bc = new BroadcastChannel("triagem_radio_sync");
      localChannelRef.current = bc;

      bc.onmessage = (event) => {
        const data = event.data;
        if (!data) return;
        if (data.type === "candidate_presence_ping") {
          setOnlineCandidates((prev) => {
            const now = Date.now();
            const key = data.key || `bc_${data.name || "visitante"}`;
            const idx = prev.findIndex((c) => c.key === key);
            const item = {
              key,
              name: data.name,
              path: data.path,
              isRegistered: Boolean(data.name),
              lastSeen: now,
            };
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = item;
              return copy;
            }
            return [item, ...prev];
          });
        } else if (data.type === "candidate_presence_bye") {
          setOnlineCandidates((prev) => prev.filter((c) => c.key !== data.key));
        }
      };

      return () => {
        bc.close();
        localChannelRef.current = null;
      };
    }
  }, []);

  // Sincronização direta dos Candidatos Online com o OnlineCounterBadge da aplicação
  useEffect(() => {
    if (typeof window === "undefined") return;

    const current = (window as any).__triagem_online_candidates;
    if (Array.isArray(current) && current.length > 0) {
      setOnlineCandidates(current);
    }

    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (Array.isArray(customEvent.detail)) {
        setOnlineCandidates(customEvent.detail);
      }
    };

    window.addEventListener("triagem:online-candidates", handleSync);
    window.dispatchEvent(new CustomEvent("triagem:request-online-candidates"));

    return () => {
      window.removeEventListener("triagem:online-candidates", handleSync);
    };
  }, []);

  // Quando o modal do Estúdio DJ abre, solicita os candidatos online mais recentes
  useEffect(() => {
    if (configOpen && typeof window !== "undefined") {
      const current = (window as any).__triagem_online_candidates;
      if (Array.isArray(current) && current.length > 0) {
        setOnlineCandidates(current);
      }
      window.dispatchEvent(new CustomEvent("triagem:request-online-candidates"));
    }
  }, [configOpen]);

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

  // 3. Rastreamento dos Candidatos Online em tempo real via Presence (escuta canal do tenant + global)
  useEffect(() => {
    try {
      const supabase = createClient();
      const channels: any[] = [];
      const chNames = [`online:${resolvedSlug}`];
      if (resolvedSlug !== "global") {
        chNames.push("online:global");
      }

      for (const name of chNames) {
        const ch = supabase.channel(name, {
          config: { presence: { key: `dj-${Date.now()}` } },
        });

        ch.on("presence", { event: "sync" }, () => {
          const state = ch.presenceState<{
            role: "candidato" | "equipe";
            name?: string;
            path?: string;
            isRegistered?: boolean;
          }>();

          setOnlineCandidates((prev) => {
            const map = new Map<
              string,
              { key: string; name?: string; path?: string; isRegistered?: boolean; lastSeen?: number }
            >();
            for (const item of prev) {
              map.set(item.key, item);
            }
            for (const [key, presences] of Object.entries(state)) {
              for (const p of presences) {
                if (p.role === "candidato") {
                  map.set(key, {
                    key,
                    name: p.name,
                    path: p.path,
                    isRegistered: p.isRegistered,
                    lastSeen: Date.now(),
                  });
                }
              }
            }
            return Array.from(map.values());
          });
        });

        ch.subscribe();
        channels.push(ch);
      }

      return () => {
        for (const ch of channels) {
          void ch.unsubscribe();
        }
      };
    } catch {
      // Supabase opcional
    }
  }, [resolvedSlug]);

  // Funções de transmissão ao vivo para a área do candidato
  const broadcastBroadcastState = useCallback((isOnline: boolean, mode: "auto" | "manual", trackId?: string) => {
    const payload = {
      type: "radio_broadcast_state",
      isBroadcasting: isOnline,
      playbackMode: mode,
      trackId,
      timestamp: Date.now(),
    };
    try {
      localChannelRef.current?.postMessage(payload);
    } catch {}
    for (const ch of realtimeChannelsRef.current) {
      ch?.send?.({
        type: "broadcast",
        event: "radio_broadcast_state",
        payload,
      }).catch?.(() => {});
    }
  }, []);

  const togglePlaybackMode = (mode: "auto" | "manual") => {
    setPlaybackMode(mode);
    try {
      localStorage.setItem("triagem:gestor:radio:mode", mode);
    } catch {}
    broadcastBroadcastState(isBroadcasting, mode, currentTrack?.id);
    setBroadcastNotification(
      mode === "auto"
        ? "📻 Modo Automático ativado: playlist toca continuamente."
        : "🎛️ Modo Sob Comando ativado: a rádio só toca o que você disparar."
    );
    setTimeout(() => setBroadcastNotification(null), 4000);
  };

  const toggleBroadcasting = () => {
    const next = !isBroadcasting;
    setIsBroadcasting(next);
    try {
      localStorage.setItem("triagem:gestor:radio:broadcasting", String(next));
    } catch {}
    broadcastBroadcastState(next, playbackMode, currentTrack?.id);
    setBroadcastNotification(
      next
        ? "🟢 Transmissão Aberta: Rádio no ar para todos os candidatos."
        : "🔴 Transmissão Interrompida: Rádio pausada para todos os candidatos."
    );
    setTimeout(() => setBroadcastNotification(null), 4000);
  };

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

  const broadcastStationChange = useCallback(
    (newStation: RadioStation) => {
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
    },
    [playlistTracks]
  );

  // Carrega a fila salva, catálogo, spots configurados e intervalo
  useEffect(() => {
    void (async () => {
      try {
        const [savedQueue, catalog, savedInterval, savedSpots] = await Promise.all([
          getRadioPlaylistAction(),
          getMusicCatalogAction(),
          getRadioSpotIntervalAction(),
          getRadioSpotsAction(),
        ]);
        if (savedQueue && savedQueue.length > 0) {
          setPlaylistTracks(savedQueue);
        }
        if (catalog && catalog.length > 0) {
          setMusicCatalog(catalog);
        }
        if (Array.isArray(savedSpots)) {
          const deleted = readDeletedSpotIds();
          const filtered = savedSpots.filter((s) => !deleted.has(s.id));
          setSpotsList(filtered);
          if (filtered.length !== savedSpots.length) {
            void saveRadioSpotsAction(filtered);
          }
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

  // Temporizador para disparar spot a cada X minutos automaticamente (somente os ativos!)
  useEffect(() => {
    if (!playing || spotIntervalMinutes <= 0) return;

    const timer = setInterval(() => {
      setNextSpotSeconds((prev) => {
        if (prev <= 1) {
          const activeSpots = spotsList.filter((s) => s.enabled !== false);
          if (activeSpots.length > 0) {
            const spot = activeSpots[spotIndexRef.current % activeSpots.length];
            spotIndexRef.current += 1;
            broadcastSpotLive(spot);
          }
          return spotIntervalMinutes * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [playing, spotIntervalMinutes, spotsList]);

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
    const activeSpots = spotsList.filter((s) => s.enabled !== false);
    const pool = activeSpots.length > 0 ? activeSpots : spotsList;
    if (pool.length === 0) return;
    const spot = pool[spotIndexRef.current % pool.length];
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
      const saved = localStorage.getItem(STORAGE_KEY_VOLUME);
      if (saved !== null) {
        const v = parseFloat(saved);
        if (!isNaN(v) && v >= 0 && v <= 1) setVolume(v);
      }
    } catch {
      // Ignora erro de storage
    }
  }, []);

  // Aplica o volume com ducking suave se spot/vinheta estiver no ar
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (muted) {
      audio.volume = 0;
    } else if (liveBroadcastSpot) {
      audio.volume = Math.max(0, volume * 0.15); // Ducking para 15%
    } else {
      audio.volume = volume;
    }
  }, [volume, muted, liveBroadcastSpot]);

  // Transição suave entre músicas (Crossfade rádio FM de 1.2s)
  const fadeTransitionToTrack = useCallback(
    (nextAudioUrl: string, onDone?: () => void) => {
      const audio = audioRef.current;
      if (!audio) return;
      const currentSrc = audio.currentSrc || audio.src;
      if (currentSrc.endsWith(nextAudioUrl) || currentSrc === nextAudioUrl) {
        onDone?.();
        return;
      }

      if (!playing || !crossfadeEnabled) {
        audio.src = nextAudioUrl;
        audio.play().catch(() => {});
        onDone?.();
        return;
      }

      // Fade-out suave (600ms) -> Troca -> Fade-in suave (600ms)
      const baseVol = muted ? 0 : volume;
      let step = 0;
      const totalSteps = 6;
      const interval = setInterval(() => {
        step++;
        const factor = Math.max(0, (totalSteps - step) / totalSteps);
        if (audio) audio.volume = baseVol * factor;
        if (step >= totalSteps) {
          clearInterval(interval);
          audio.src = nextAudioUrl;
          audio
            .play()
            .then(() => {
              let inStep = 0;
              const inInterval = setInterval(() => {
                inStep++;
                const inFactor = Math.min(1, inStep / totalSteps);
                if (audio) audio.volume = baseVol * inFactor;
                if (inStep >= totalSteps) {
                  clearInterval(inInterval);
                  onDone?.();
                }
              }, 100);
            })
            .catch(() => {
              if (audio) audio.volume = baseVol;
            });
        }
      }, 100);
    },
    [crossfadeEnabled, muted, playing, volume]
  );

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setError(null);

    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }

    try {
      setLoading(true);
      const targetSrc = isPlaylistMode
        ? currentTrack?.audioUrl || DEFAULT_MUSIC_CATALOG[0].audioUrl
        : current.url;

      if (!audio.src || !audio.src.endsWith(targetSrc)) {
        audio.src = targetSrc;
      }
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
      setError("Não foi possível conectar à rádio. Tente outra estação.");
    } finally {
      setLoading(false);
    }
  };

  const playNextTrack = () => {
    if (!isPlaylistMode || playlistTracks.length === 0) return;
    const nextIdx = (trackIndex + 1) % playlistTracks.length;
    setTrackIndex(nextIdx);
    const track = playlistTracks[nextIdx];
    if (track) {
      fadeTransitionToTrack(track.audioUrl);
      broadcastTrackChange(nextIdx, track);
    }
  };

  const playPrevTrack = () => {
    if (!isPlaylistMode || playlistTracks.length === 0) return;
    const prevIdx = (trackIndex - 1 + playlistTracks.length) % playlistTracks.length;
    setTrackIndex(prevIdx);
    const track = playlistTracks[prevIdx];
    if (track) {
      fadeTransitionToTrack(track.audioUrl);
      broadcastTrackChange(prevIdx, track);
    }
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
          ? playlistTracks[0]?.audioUrl || DEFAULT_MUSIC_CATALOG[0].audioUrl
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

  // Toca efeito de transição de rádio FM (entrada ou saída)
  const playFmTransitionSfx = useCallback(
    (direction: "in" | "out") => {
      const sfx = sfxAudioRef.current;
      if (!sfx || muted) return;
      sfx.src =
        direction === "in"
          ? "/audio/sfx/sfx-fm-transition-in.mp3"
          : "/audio/sfx/sfx-fm-transition-out.mp3";
      sfx.volume = Math.min(1, volume * 0.9);
      sfx.play().catch(() => {});
    },
    [muted, volume]
  );

  // Pré-visualizar vinheta no fone local (com transição de rádio se for vinheta sem SFX embutido)
  const toggleSpotPreview = (spot: RadioSpot) => {
    const audio = spotAudioRef.current;
    if (!audio) return;
    if (previewingSpotId === spot.id) {
      audio.pause();
      setPreviewingSpotId(null);
      needsTransitionOutroRef.current = false;
      if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
      return;
    }

    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : Math.max(0, volume * 0.16);
    }

    const useTransitionOverlay = !spot.hasEmbeddedSfx;
    needsTransitionOutroRef.current = useTransitionOverlay;

    if (useTransitionOverlay) {
      playFmTransitionSfx("in");
      setPreviewingSpotId(spot.id);
      setTimeout(() => {
        if (!spotAudioRef.current) return;
        spotAudioRef.current.src = spot.audioUrl;
        spotAudioRef.current.volume = muted ? 0 : Math.min(1, volume * 1.2);
        spotAudioRef.current.play().catch(() => setPreviewingSpotId(null));
      }, 280);
    } else {
      audio.src = spot.audioUrl;
      audio.volume = muted ? 0 : Math.min(1, volume * 1.2);
      audio
        .play()
        .then(() => {
          setPreviewingSpotId(spot.id);
        })
        .catch(() => setPreviewingSpotId(null));
    }
  };

  // Disparar Vinheta no Ar AO VIVO para os Candidatos
  const broadcastSpotLive = (spot: RadioSpot) => {
    const audio = spotAudioRef.current;
    const useTransitionOverlay = !spot.hasEmbeddedSfx;
    needsTransitionOutroRef.current = useTransitionOverlay;

    if (audio) {
      if (useTransitionOverlay) {
        playFmTransitionSfx("in");
        setLiveBroadcastSpot(spot);
        setTimeout(() => {
          if (!spotAudioRef.current) return;
          spotAudioRef.current.src = spot.audioUrl;
          spotAudioRef.current.volume = muted ? 0 : Math.min(1, volume * 1.2);
          spotAudioRef.current.play().catch(() => {});
        }, 280);
      } else {
        audio.src = spot.audioUrl;
        audio.volume = muted ? 0 : Math.min(1, volume * 1.2);
        audio
          .play()
          .then(() => {
            setLiveBroadcastSpot(spot);
          })
          .catch(() => {});
      }
    }

    // 1. Transmissão instantânea local entre abas
    localChannelRef.current?.postMessage({
      type: "play_spot",
      spotId: spot.id,
      title: spot.title,
      subtitle: spot.subtitle,
      audioUrl: spot.audioUrl,
      hasEmbeddedSfx: spot.hasEmbeddedSfx,
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
          hasEmbeddedSfx: spot.hasEmbeddedSfx,
        },
      });
    }

    setBroadcastNotification(`Vinheta "${spot.title}" transmitida no ar!`);
    setTimeout(() => setBroadcastNotification(null), 4000);
  };

  // Disparar Efeito Sonoro (SFX Soundboard)
  const triggerSfx = (sfxKey: string, sfxLabel: string) => {
    const sfxUrl = `/audio/sfx/${sfxKey}.mp3`;
    if (sfxAudioRef.current) {
      sfxAudioRef.current.src = sfxUrl;
      sfxAudioRef.current.volume = muted ? 0 : Math.min(1, volume * 1.3);
      sfxAudioRef.current.play().catch(() => {});
    }

    localChannelRef.current?.postMessage({
      type: "play_sfx",
      sfxUrl,
      timestamp: Date.now(),
    });

    for (const ch of realtimeChannelsRef.current) {
      ch.send({
        type: "broadcast",
        event: "play_sfx",
        payload: { sfxUrl, timestamp: Date.now() },
      });
    }

    setBroadcastNotification(`Efeito sonoro "${sfxLabel}" disparado no ar!`);
    setTimeout(() => setBroadcastNotification(null), 3000);
  };

  // Sincroniza e salva spots no servidor e abas conectadas
  const persistSpotsList = useCallback(async (nextSpots: RadioSpot[]) => {
    try {
      await saveRadioSpotsAction(nextSpots);
      localChannelRef.current?.postMessage({
        type: "spots_sync",
        spots: nextSpots,
        timestamp: Date.now(),
      });
      for (const ch of realtimeChannelsRef.current) {
        ch.send({
          type: "broadcast",
          event: "spots_sync",
          payload: { spots: nextSpots },
        });
      }
    } catch {
      // Ignora erro de rede
    }
  }, []);

  // Ativar / desativar vinheta na rotação automática (salva imediatamente)
  const toggleSpotEnabled = (spotId: string) => {
    setSpotsList((prev) => {
      const next = prev.map((s) =>
        s.id === spotId ? { ...s, enabled: s.enabled === false ? true : false } : s
      );
      void persistSpotsList(next);
      return next;
    });
  };

  // Apagar vinheta da lista permanentemente (nunca retorna)
  const deleteSpot = (spotId: string) => {
    if (previewingSpotId === spotId && spotAudioRef.current) {
      spotAudioRef.current.pause();
      setPreviewingSpotId(null);
    }
    const deleted = readDeletedSpotIds();
    deleted.add(spotId);
    writeDeletedSpotIds(deleted);

    setSpotsList((prev) => {
      const next = prev.filter((s) => s.id !== spotId);
      void persistSpotsList(next);
      return next;
    });

    setBroadcastNotification("Vinheta excluída permanentemente.");
    setTimeout(() => setBroadcastNotification(null), 3000);
  };

  // Salvar configuração dos spots e sincronizar com ouvintes
  const saveAndSyncSpots = async () => {
    setSavingSpots(true);
    setSavedSpots(false);
    try {
      const res = await saveRadioSpotsAction(spotsList);
      if (res?.ok) {
        setSavedSpots(true);
        setTimeout(() => setSavedSpots(false), 3000);

        localChannelRef.current?.postMessage({
          type: "spots_sync",
          spots: spotsList,
          timestamp: Date.now(),
        });

        for (const ch of realtimeChannelsRef.current) {
          ch.send({
            type: "broadcast",
            event: "spots_sync",
            payload: { spots: spotsList },
          });
        }
      }
    } catch {
      // Ignora erro
    } finally {
      setSavingSpots(false);
    }
  };

  // Restaurar spots oficiais padrão
  const restoreDefaultSpots = async () => {
    writeDeletedSpotIds(new Set());
    setSpotsList(TARGET_RADIO_SPOTS);
    await persistSpotsList(TARGET_RADIO_SPOTS);
    setBroadcastNotification("Vinhetas oficiais padrão restauradas!");
    setTimeout(() => setBroadcastNotification(null), 3500);
  };

  // Gerar nova vinheta com IA Michelin
  const handleGenerateNewSpot = async () => {
    if (!newSpotScript.trim()) return;
    setGeneratingSpot(true);
    try {
      const res = await generateRadioSpotAction({
        title: newSpotTitle.trim() || "Nova Vinheta Tarhget",
        script: newSpotScript.trim(),
        voice: newSpotVoice,
        sfxPreset: newSpotSfx,
      });

      if (res.ok && res.spot) {
        const updated = [res.spot, ...spotsList];
        setSpotsList(updated);
        await saveRadioSpotsAction(updated);
        setShowNewSpotModal(false);
        setNewSpotTitle("");
        setNewSpotScript("");
        setBroadcastNotification(`✨ Vinheta "${res.spot.title}" criada e adicionada com sucesso!`);
        setTimeout(() => setBroadcastNotification(null), 4000);
      } else {
        setError(res.error || "Falha ao gerar vinheta.");
      }
    } catch (err: any) {
      setError(err?.message || "Erro inesperado ao gerar vinheta com IA.");
    } finally {
      setGeneratingSpot(false);
    }
  };

  // Ouvir Prévia do Alô no Fone antes de colocar no ar (Exigência do usuário)
  const togglePreviewShoutout = async () => {
    if (!shoutoutMessage.trim()) return;

    if (previewingShoutout) {
      stopVoiceSpeech();
      if (spotAudioRef.current) {
        spotAudioRef.current.pause();
        spotAudioRef.current.currentTime = 0;
      }
      setPreviewingShoutout(false);
      setPreviewLoading(false);
      if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
      return;
    }

    setPreviewLoading(true);
    setError(null);

    const finishPreview = () => {
      setPreviewingShoutout(false);
      setPreviewLoading(false);
      if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
    };

    // Ducking imediato na música da rádio para ouvir a locução com clareza
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : Math.max(0, volume * 0.12);
    }

    try {
      const explicitTarget = customCandidateInput.trim();
      const targetName = explicitTarget || (selectedCandidate === "all" ? "" : selectedCandidate);

      // Tenta gerar áudio masterizado no servidor
      const res = await generateRadioSpotAction({
        title: `Prévia Alô para ${targetName || "Candidato"}`,
        script: shoutoutMessage,
        voice: shoutoutVoice,
        sfxPreset: "acolhimento-suave",
      });

      const audioUrl = res.ok && res.spot?.audioUrl ? res.spot.audioUrl : undefined;

      if (audioUrl && spotAudioRef.current) {
        setPreviewLoading(false);
        setPreviewingShoutout(true);
        spotAudioRef.current.pause();
        spotAudioRef.current.currentTime = 0;
        spotAudioRef.current.src = audioUrl;
        spotAudioRef.current.volume = muted ? 0 : volume;
        await spotAudioRef.current.play();
        return;
      }
    } catch {
      // Ignora erro do servidor: faz fallback nativo no navegador
    }

    setPreviewLoading(false);
    setPreviewingShoutout(true);

    const started = playVoiceSpeech(
      shoutoutMessage,
      shoutoutVoice,
      () => {
        if (audioRef.current) audioRef.current.volume = muted ? 0 : Math.max(0, volume * 0.12);
      },
      () => {
        finishPreview();
      }
    );

    if (!started) {
      finishPreview();
      setError("Navegador não suporta sintetizador para prévia.");
    }
  };

  // Transmitir Alô no Ar Personalizado para Candidato Online (Nível Michelin)
  const sendPersonalizedShoutout = async () => {
    if (!shoutoutMessage.trim()) return;

    // Se estiver tocando prévia, interrompe antes de transmitir
    if (previewingShoutout) {
      stopVoiceSpeech();
      if (spotAudioRef.current) {
        spotAudioRef.current.pause();
      }
      setPreviewingShoutout(false);
      setPreviewLoading(false);
    }

    setSendingShoutout(true);
    try {
      const explicitTarget = customCandidateInput.trim();
      const targetName = explicitTarget || (selectedCandidate === "all" ? "" : selectedCandidate);
      const isAll = !targetName;
      const shoutoutTimestamp = Date.now();

      // 1. Gera áudio com masterização Michelin usando a voz rigorosamente escolhida
      const res = await generateRadioSpotAction({
        title: isAll ? "Recado Especial no Ar" : `Alô Especial para ${targetName}`,
        script: shoutoutMessage,
        voice: shoutoutVoice,
        sfxPreset: "acolhimento-suave",
      });

      const audioUrl = res.ok && res.spot?.audioUrl ? res.spot.audioUrl : undefined;

      // 2. Transmite instantaneamente via BroadcastChannel com timestamp e voz
      localChannelRef.current?.postMessage({
        type: "live_shoutout",
        targetCandidateName: targetName,
        message: shoutoutMessage,
        voice: shoutoutVoice,
        audioUrl,
        broadcastMode: isAll ? "all" : "private",
        timestamp: shoutoutTimestamp,
      });

      // 3. Transmite via Supabase Realtime
      for (const ch of realtimeChannelsRef.current) {
        ch.send({
          type: "broadcast",
          event: "live_shoutout",
          payload: {
            targetCandidateName: targetName,
            message: shoutoutMessage,
            voice: shoutoutVoice,
            audioUrl,
            broadcastMode: isAll ? "all" : "private",
            timestamp: shoutoutTimestamp,
          },
        });
      }

      // 4. Toca no retorno do estúdio do DJ com DUCKING suave da música de fundo (sem sobreposição!)
      if (audioRef.current) {
        audioRef.current.volume = muted ? 0 : Math.max(0, volume * 0.12);
      }

      setLiveBroadcastSpot({
        id: `shoutout-${shoutoutTimestamp}`,
        title: `🎙️ Alô no Ar para ${targetName || "Candidatos"}`,
        subtitle: shoutoutMessage,
        audioUrl: audioUrl || "",
      });

      const restoreMusicVolume = () => {
        setLiveBroadcastSpot(null);
        if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
      };

      if (audioUrl && spotAudioRef.current) {
        spotAudioRef.current.pause();
        spotAudioRef.current.currentTime = 0;
        spotAudioRef.current.src = audioUrl;
        spotAudioRef.current.volume = muted ? 0 : volume;

        spotAudioRef.current.play().catch(() => {
          playVoiceSpeech(
            shoutoutMessage,
            shoutoutVoice,
            () => {
              if (audioRef.current) audioRef.current.volume = muted ? 0 : Math.max(0, volume * 0.12);
            },
            restoreMusicVolume
          );
        });
      } else {
        playVoiceSpeech(
          shoutoutMessage,
          shoutoutVoice,
          () => {
            if (audioRef.current) audioRef.current.volume = muted ? 0 : Math.max(0, volume * 0.12);
          },
          restoreMusicVolume
        );
      }

      setSentShoutout(true);
      setBroadcastNotification(
        `🎙️ Alô no ar transmitido com sucesso para ${isAll ? "todos os candidatos" : targetName}!`
      );
      setTimeout(() => {
        setSentShoutout(false);
        setBroadcastNotification(null);
      }, 5000);
    } catch {
      setError("Erro ao transmitir alô no ar.");
    } finally {
      setSendingShoutout(false);
    }
  };

  // Sincroniza e salva a fila de reprodução automaticamente no servidor e abas
  const persistPlaylistTracks = useCallback(
    async (nextTracks: RadioTrack[]) => {
      try {
        await saveRadioPlaylistAction(nextTracks);
        localChannelRef.current?.postMessage({
          type: "playlist_sync",
          tracks: nextTracks,
          trackIndex,
          timestamp: Date.now(),
        });
        for (const ch of realtimeChannelsRef.current) {
          ch.send({
            type: "broadcast",
            event: "playlist_sync",
            payload: {
              tracks: nextTracks,
              trackIndex,
            },
          });
        }
      } catch {
        // Ignora erro
      }
    },
    [trackIndex]
  );

  // Operações de Fila (Reordenar, Adicionar, Remover)
  const addTrackToQueue = (track: RadioTrack) => {
    setPlaylistTracks((prev) => {
      const exists = prev.some((t) => t.id === track.id || t.audioUrl === track.audioUrl);
      if (exists) return prev;
      const next = [...prev, track];
      void persistPlaylistTracks(next);
      return next;
    });
  };

  const removeTrackFromQueue = (index: number) => {
    setPlaylistTracks((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== index);
      if (trackIndex >= next.length) {
        setTrackIndex(0);
      }
      void persistPlaylistTracks(next);
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
      void persistPlaylistTracks(copy);
      return copy;
    });
  };

  // Carrega todas as faixas da pasta public/audio/music para a fila ativa
  const loadAllFolderTracksToQueue = async () => {
    setSavingPlaylist(true);
    try {
      const freshCatalog = await getMusicCatalogAction();
      const catalogToUse =
        freshCatalog && freshCatalog.length > 0 ? freshCatalog : musicCatalog;
      setMusicCatalog(catalogToUse);

      setPlaylistTracks((prev) => {
        const existingUrls = new Set(prev.map((t) => t.audioUrl.toLowerCase()));
        const missing = catalogToUse.filter(
          (t) => !existingUrls.has(t.audioUrl.toLowerCase())
        );
        const merged = missing.length > 0 ? [...prev, ...missing] : catalogToUse;
        void persistPlaylistTracks(merged);
        return merged;
      });

      setBroadcastNotification(
        `Todas as ${catalogToUse.length} músicas da pasta foram sincronizadas na fila!`
      );
      setTimeout(() => setBroadcastNotification(null), 4000);
    } catch {
      setError("Não foi possível sincronizar a pasta de músicas.");
    } finally {
      setSavingPlaylist(false);
    }
  };

  // Upload direto de arquivo(s) .MP3 do computador
  const handleMp3FileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingMp3(true);
    setError(null);
    const addedTracks: RadioTrack[] = [];

    try {
      for (const file of Array.from(files)) {
        let uploadedTrack: RadioTrack | null = null;

        // 1. Tenta enviar diretamente para /api/radio/upload-track (salva em public/audio/music local ou Supabase Storage)
        if (file.size <= 4.2 * 1024 * 1024 || window.location.hostname === "localhost") {
          try {
            const fd = new FormData();
            fd.append("file", file);
            if (customTitle.trim() && files.length === 1) {
              fd.append("title", customTitle.trim());
            }
            if (customArtist.trim() && files.length === 1) {
              fd.append("artist", customArtist.trim());
            }

            const res = await fetch("/api/radio/upload-track", {
              method: "POST",
              body: fd,
            });
            if (res.ok) {
              const data = await res.json();
              if (data?.ok && data?.track) {
                uploadedTrack = data.track as RadioTrack;
              }
            }
          } catch {
            // Se exceder limite de payload serverless, tenta URL assinada abaixo
          }
        }

        // 2. Fallback para arquivos MP3 grandes em produção (upload direto via URL assinada para Supabase Storage)
        if (!uploadedTrack) {
          const params = new URLSearchParams({ filename: file.name });
          if (customTitle.trim() && files.length === 1) {
            params.set("title", customTitle.trim());
          }
          if (customArtist.trim() && files.length === 1) {
            params.set("artist", customArtist.trim());
          }
          const signRes = await fetch(`/api/radio/upload-track?${params.toString()}`);
          const signData = await signRes.json();

          if (!signRes.ok || !signData?.ok || !signData?.signedUrl) {
            throw new Error(signData?.error || `Falha ao enviar ${file.name}`);
          }

          const putRes = await fetch(signData.signedUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type || "audio/mpeg" },
            body: file,
          });

          if (!putRes.ok) {
            throw new Error(`Erro no upload de ${file.name}`);
          }

          uploadedTrack = signData.track as RadioTrack;
        }

        if (uploadedTrack) {
          addedTracks.push(uploadedTrack);
        }
      }

      if (addedTracks.length > 0) {
        setMusicCatalog((prev) => {
          const urls = new Set(prev.map((t) => t.audioUrl.toLowerCase()));
          const unique = addedTracks.filter((t) => !urls.has(t.audioUrl.toLowerCase()));
          return [...unique, ...prev];
        });

        setPlaylistTracks((prev) => {
          const urls = new Set(prev.map((t) => t.audioUrl.toLowerCase()));
          const unique = addedTracks.filter((t) => !urls.has(t.audioUrl.toLowerCase()));
          const next = [...prev, ...unique];
          void persistPlaylistTracks(next);
          return next;
        });

        if (files.length === 1) {
          setCustomTitle("");
          setCustomArtist("");
        }

        setBroadcastNotification(
          addedTracks.length === 1
            ? `MP3 "${addedTracks[0].title}" adicionado à pasta e à fila!`
            : `${addedTracks.length} arquivos MP3 adicionados à pasta e à fila!`
        );
        setTimeout(() => setBroadcastNotification(null), 4000);
      }
    } catch (err: any) {
      setError(err?.message || "Erro ao enviar arquivo MP3.");
    } finally {
      setUploadingMp3(false);
      if (mp3FileInputRef.current) {
        mp3FileInputRef.current.value = "";
      }
    }
  };

  const saveAndSyncQueue = async () => {
    setSavingPlaylist(true);
    setSavedPlaylist(false);
    try {
      const res = await saveRadioPlaylistAction(playlistTracks);
      if (res?.ok) {
        setSavedPlaylist(true);
        setTimeout(() => setSavedPlaylist(false), 3000);

        localChannelRef.current?.postMessage({
          type: "playlist_sync",
          tracks: playlistTracks,
          trackIndex,
          timestamp: Date.now(),
        });

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
        `https://de1.api.radio-browser.info/json/stations/search?${params.toString()}`
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
            if (playbackMode === "auto") {
              playNextTrack();
            } else {
              setPlaying(false);
              broadcastBroadcastState(isBroadcasting, "manual", undefined);
            }
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
          if (needsTransitionOutroRef.current) {
            needsTransitionOutroRef.current = false;
            playFmTransitionSfx("out");
          }
          setPreviewingSpotId(null);
          setPreviewingShoutout(false);
          setPreviewLoading(false);
          setLiveBroadcastSpot(null);
          setTimeout(() => {
            if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
          }, 450);
        }}
        onError={() => {
          needsTransitionOutroRef.current = false;
          setPreviewingSpotId(null);
          setPreviewingShoutout(false);
          setPreviewLoading(false);
          setLiveBroadcastSpot(null);
          if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
        }}
      />
      <audio ref={sfxAudioRef} preload="none" />

      {/* Alerta de Transmissão ao Vivo */}
      {broadcastNotification && (
        <div className="mb-2 rounded-md border border-[#e4e4e7] bg-[#f4f4f5] px-2 py-1 text-center text-[10px] font-semibold text-[#0a0a0a]">
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
            <span
              className={`ml-1 rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                playbackMode === "auto"
                  ? "bg-[#eaf1fb] text-[#2f5fa8]"
                  : "bg-amber-100 text-amber-800"
              }`}
              title={playbackMode === "auto" ? "Modo Automático: Rotação contínua" : "Modo Sob Comando: Só toca o que você disparar"}
            >
              {playbackMode === "auto" ? "Auto" : "Comando"}
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

        {/* Botão de Abrir Estúdio da Rádio */}
        <button
          type="button"
          onClick={() => setConfigOpen(true)}
          title="Abrir configurações da Rádio"
          className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-[#e4e4e7] bg-[#fafaf9] text-[#52525b] hover:bg-[#1c1917] hover:text-white transition"
        >
          <Headphones className="size-3.5" />
        </button>
      </div>

      {/* BOTÕES DE ACESSO RÁPIDO À RÁDIO (PADRÃO NEUTRO DO SISTEMA) */}
      <div className="mt-2 flex gap-1 border-t border-[#f4f4f5] pt-1.5">
        <button
          type="button"
          onClick={() => {
            setActiveTab("fila");
            setConfigOpen(true);
          }}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#e4e4e7] bg-[#fafaf9] py-1 text-[10px] font-medium text-[#52525b] transition hover:bg-white hover:text-[#0a0a0a]"
        >
          <ListMusic className="size-3 text-[#71717a]" />
          <span>Fila ({playlistTracks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("spots");
            setConfigOpen(true);
          }}
          className="flex items-center gap-1 rounded-lg border border-[#e4e4e7] bg-[#fafaf9] px-2 py-1 text-[10px] font-medium text-[#52525b] transition hover:bg-white hover:text-[#0a0a0a]"
        >
          <Sparkles className="size-3 text-[#71717a]" />
          <span>
            Vinhetas {spotIntervalMinutes > 0 ? `(${formatTimer(nextSpotSeconds)})` : ""}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("alo");
            setConfigOpen(true);
          }}
          className="flex items-center gap-1 rounded-lg border border-[#e4e4e7] bg-[#fafaf9] px-2 py-1 text-[10px] font-medium text-[#52525b] transition hover:bg-white hover:text-[#0a0a0a]"
        >
          <Mic className="size-3 text-[#71717a]" />
          <span>Recado</span>
        </button>
      </div>

      {/* TELA SOBREPOSTA 100% OPACA (SEM MOSTRAR A TELA DE BAIXO) */}
      {configOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Configurações da Rádio"
            className="fixed inset-0 z-[200] flex flex-col bg-[#fafaf9]"
          >
            {/* Header no padrão neutro do sistema */}
            <div className="flex items-center justify-between border-b border-[#e4e4e7] bg-white px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl border border-[#e4e4e7] bg-[#fafaf9] text-[#0a0a0a]">
                  <Radio className="size-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-semibold tracking-tight text-[#0a0a0a]">
                      Rádio da Empresa
                    </h2>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e4e4e7] bg-[#f4f4f5] px-2.5 py-0.5 text-[11px] font-medium text-[#52525b]">
                      <span
                        className={`size-1.5 rounded-full ${
                          playing ? "bg-[#1f7a4d]" : "bg-[#a1a1aa]"
                        }`}
                      />
                      {playing ? "Em reprodução" : "Pausada"}
                    </span>
                  </div>
                  <p className="text-xs text-[#71717a]">
                    Gerencie a fila de músicas, vinhetas institucionais e avisos de áudio
                  </p>
                </div>
              </div>

              {/* Botões do Topo: Crossfade + Fechar */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setCrossfadeEnabled((c) => !c)}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                    crossfadeEnabled
                      ? "border-[#0a0a0a] bg-[#0a0a0a] text-white"
                      : "border-[#e4e4e7] bg-white text-[#71717a] hover:text-[#0a0a0a]"
                  }`}
                  title="Transição suave de volume entre faixas"
                >
                  <SlidersHorizontal className="size-3.5" />
                  <span>Transição suave: {crossfadeEnabled ? "Ativa" : "Inativa"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfigOpen(false)}
                  title="Fechar (Esc)"
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-white px-3.5 text-xs font-medium text-[#0a0a0a] hover:bg-[#f4f4f5] transition"
                >
                  <X className="size-4" />
                  <span>Voltar ao painel</span>
                </button>
              </div>
            </div>

            {/* Menu de Abas Superior no padrão do sistema */}
            <div className="border-b border-[#e4e4e7] bg-white px-6 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-[#71717a] uppercase tracking-wider">
                    Controle da Transmissão:
                  </span>
                  
                  {/* Interruptor de Transmissão Geral */}
                  <button
                    type="button"
                    onClick={toggleBroadcasting}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                      isBroadcasting
                        ? "border-[#c3e6cb] bg-[#f4faf6] text-[#155724] hover:bg-[#e4f6ec]"
                        : "border-[#f5c6cb] bg-[#fff5f5] text-[#721c24] hover:bg-[#fbeae8]"
                    }`}
                    title="Controla se os candidatos conseguem ouvir a rádio no portal"
                  >
                    <span className={`size-2 rounded-full ${isBroadcasting ? "bg-[#1f7a4d] animate-pulse" : "bg-[#c23b3b]"}`} />
                    <span>{isBroadcasting ? "Transmissão Aberta (No ar p/ candidatos)" : "Transmissão Pausada (Fora do ar)"}</span>
                  </button>

                  {/* Seletor de Modo de Reprodução */}
                  <div className="inline-flex items-center rounded-xl border border-[#e4e4e7] bg-[#fafaf9] p-0.5">
                    <button
                      type="button"
                      onClick={() => togglePlaybackMode("auto")}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        playbackMode === "auto"
                          ? "bg-white text-[#0a0a0a] shadow-xs"
                          : "text-[#71717a] hover:text-[#0a0a0a]"
                      }`}
                      title="Modo Automático: a rádio toca a fila continuamente"
                    >
                      ⚡ Automático (Auto DJ)
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePlaybackMode("manual")}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        playbackMode === "manual"
                          ? "bg-white text-[#0a0a0a] shadow-xs"
                          : "text-[#71717a] hover:text-[#0a0a0a]"
                      }`}
                      title="Modo Sob Comando: só toca a faixa ou vinheta que você clicar"
                    >
                      🎛️ Sob Comando ("Só toca o que eu quiser")
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-[#71717a]">
                  {playbackMode === "manual" ? (
                    <span className="font-semibold text-amber-700">Modo Manual: a faixa para ao terminar e aguarda seu comando.</span>
                  ) : (
                    <span>Modo Automático: playlist contínua em rotação.</span>
                  )}
                </div>
              </div>

              {/* Letreiro de Notícias de Varejo e Economia no Estúdio */}
              <div className="mt-2.5">
                <NewsTicker variant="compact" />
              </div>
            </div>

            <div className="flex items-center gap-1 border-b border-[#e4e4e7] bg-white px-6 text-xs overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab("fila")}
                className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-3 font-medium transition whitespace-nowrap ${
                  activeTab === "fila"
                    ? "border-[#0a0a0a] text-[#0a0a0a]"
                    : "border-transparent text-[#71717a] hover:text-[#0a0a0a]"
                }`}
              >
                <ListMusic className="size-4" />
                <span>Fila de Músicas</span>
                <span className="rounded-full bg-[#f1f0ed] px-2 py-0.5 text-[11px] font-medium text-[#57534e]">
                  {playlistTracks.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("spots")}
                className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-3 font-medium transition whitespace-nowrap ${
                  activeTab === "spots"
                    ? "border-[#0a0a0a] text-[#0a0a0a]"
                    : "border-transparent text-[#71717a] hover:text-[#0a0a0a]"
                }`}
              >
                <Sparkles className="size-4" />
                <span>Vinhetas</span>
                <span className="rounded-full bg-[#f1f0ed] px-2 py-0.5 text-[11px] font-medium text-[#57534e]">
                  {spotsList.filter((s) => s.enabled !== false).length}/{spotsList.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("alo")}
                className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-3 font-medium transition whitespace-nowrap ${
                  activeTab === "alo"
                    ? "border-[#0a0a0a] text-[#0a0a0a]"
                    : "border-transparent text-[#71717a] hover:text-[#0a0a0a]"
                }`}
              >
                <Mic className="size-4" />
                <span>Recado no Ar</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f0ed] px-2 py-0.5 text-[11px] font-medium text-[#57534e]">
                  {onlineCandidates.length} online
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("estacao")}
                className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-3 font-medium transition whitespace-nowrap ${
                  activeTab === "estacao"
                    ? "border-[#0a0a0a] text-[#0a0a0a]"
                    : "border-transparent text-[#71717a] hover:text-[#0a0a0a]"
                }`}
              >
                <Radio className="size-4" />
                <span>Estações FM</span>
              </button>
            </div>

            {/* Conteúdo 100% Sólido no Padrão do Sistema */}
            <div className="flex-1 overflow-y-auto bg-[#fafaf9] p-6">
              <div className="mx-auto max-w-5xl">
              {/* ABA 1: FILA DE MÚSICAS & CATÁLOGO */}
              {activeTab === "fila" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Coluna Esquerda: Fila Atual da Rádio */}
                  <div className="lg:col-span-7 flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white rounded-xl border border-stone-200 p-4 shadow-xs">
                      <div>
                        <h3 className="text-sm font-bold text-stone-900">
                          Fila de Reprodução da Rádio Tarhget
                        </h3>
                        <p className="text-xs text-stone-500">
                          Ordem das faixas que tocam automaticamente no ar para os candidatos
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={loadAllFolderTracksToQueue}
                          disabled={savingPlaylist}
                          title="Carregar todas as músicas presentes na pasta public/audio/music"
                          className="flex items-center gap-1.5 rounded-lg border border-[#e4e4e7] bg-[#fafaf9] px-3 py-1.5 text-xs font-semibold text-[#0a0a0a] transition hover:bg-[#f4f4f5] disabled:opacity-50"
                        >
                          <RefreshCw className="size-3.5 text-[#71717a]" />
                          <span>Sincronizar Pasta ({musicCatalog.length})</span>
                        </button>

                        <button
                          type="button"
                          onClick={saveAndSyncQueue}
                          disabled={savingPlaylist}
                          className="flex items-center gap-1.5 rounded-lg bg-[#1c1917] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:opacity-90 disabled:opacity-50"
                        >
                          {savingPlaylist ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : savedPlaylist ? (
                            <Check className="size-3.5 text-emerald-400" />
                          ) : (
                            <RadioTower className="size-3.5 text-white" />
                          )}
                          <span>
                            {savedPlaylist
                              ? "Fila Sincronizada!"
                              : savingPlaylist
                                ? "Sincronizando..."
                                : "Salvar Fila no Ar"}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Lista das Músicas na Fila */}
                    <div className="rounded-xl border border-[#e4e4e7] bg-white divide-y divide-[#f4f4f5] shadow-xs max-h-[460px] overflow-y-auto">
                      {playlistTracks.map((track, idx) => {
                        const isCurrentPlaying =
                          isPlaylistMode &&
                          trackIndex === idx &&
                          playing;
                        const isSelectedTrack = trackIndex === idx;

                        return (
                          <div
                            key={`${track.id}-${idx}`}
                            className={`flex items-center justify-between p-3.5 transition ${
                              isSelectedTrack
                                ? "bg-[#f4f4f5] font-medium"
                                : "hover:bg-[#fafaf9]"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#f4f4f5] text-xs font-bold text-[#52525b]">
                                {idx + 1}
                              </span>

                              <button
                                type="button"
                                onClick={() => {
                                  setTrackIndex(idx);
                                  fadeTransitionToTrack(track.audioUrl);
                                  broadcastTrackChange(idx, track);
                                }}
                                title="Tocar esta faixa agora"
                                className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition ${
                                  isCurrentPlaying
                                    ? "bg-[#1c1917] text-white"
                                    : "bg-[#f4f4f5] text-[#52525b] hover:bg-[#e4e4e7] hover:text-[#0a0a0a]"
                                }`}
                              >
                                {isCurrentPlaying ? (
                                  <Pause className="size-3.5 fill-current" />
                                ) : (
                                  <Play className="size-3.5 translate-x-[0.5px] fill-current" />
                                )}
                              </button>

                              <div className="min-w-0">
                                <p className="truncate text-xs font-bold text-[#0a0a0a]">
                                  {track.title}
                                </p>
                                <p className="truncate text-[11px] text-[#71717a]">
                                  {track.artist}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => moveTrackInQueue(idx, "up")}
                                disabled={idx === 0}
                                title="Mover para cima"
                                className="flex size-7 items-center justify-center rounded-md text-[#a1a1aa] hover:bg-[#f4f4f5] hover:text-[#0a0a0a] disabled:opacity-30"
                              >
                                <ArrowUp className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveTrackInQueue(idx, "down")}
                                disabled={idx === playlistTracks.length - 1}
                                title="Mover para baixo"
                                className="flex size-7 items-center justify-center rounded-md text-[#a1a1aa] hover:bg-[#f4f4f5] hover:text-[#0a0a0a] disabled:opacity-30"
                              >
                                <ArrowDown className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeTrackFromQueue(idx)}
                                title="Remover da fila"
                                className="flex size-7 items-center justify-center rounded-md text-[#a1a1aa] hover:bg-[#f4f4f5] hover:text-[#0a0a0a] disabled:opacity-30"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Coluna Direita: Upload Direto de MP3, Catálogo Completo & Link */}
                  <div className="lg:col-span-5 flex flex-col gap-4">
                    {/* Card 1: Enviar Arquivo(s) MP3 Diretamente do Computador */}
                    <div className="bg-white rounded-xl border border-[#e4e4e7] p-4 shadow-xs">
                      <h4 className="text-xs font-bold text-[#0a0a0a] mb-1 flex items-center gap-1.5">
                        <Plus className="size-3.5 text-[#0a0a0a]" />
                        <span>Adicionar Arquivo MP3 Diretamente</span>
                      </h4>
                      <p className="text-[11px] text-[#71717a] mb-3">
                        Selecione um ou mais arquivos <code className="font-mono text-[10px]">.mp3</code> do seu computador para incluir na pasta e na fila da rádio.
                      </p>

                      <input
                        ref={mp3FileInputRef}
                        type="file"
                        accept=".mp3,audio/mpeg,audio/mp3"
                        multiple
                        onChange={handleMp3FileSelect}
                        className="hidden"
                      />

                      <button
                        type="button"
                        onClick={() => mp3FileInputRef.current?.click()}
                        disabled={uploadingMp3}
                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#1c1917] px-4 py-2.5 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                      >
                        {uploadingMp3 ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            <span>Enviando arquivo(s) MP3...</span>
                          </>
                        ) : (
                          <>
                            <Music className="size-4" />
                            <span>Selecionar Arquivo(s) .MP3 do Computador</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Card 2: Formulário: Adicionar Faixa por Link */}
                    <div className="bg-white rounded-xl border border-[#e4e4e7] p-4 shadow-xs">
                      <h4 className="text-xs font-bold text-[#0a0a0a] mb-2 flex items-center gap-1.5">
                        <Plus className="size-3.5 text-[#71717a]" />
                        <span>Adicionar Faixa por Link de Áudio</span>
                      </h4>
                      <form onSubmit={addCustomTrack} className="space-y-2.5">
                        <input
                          type="text"
                          placeholder="Título da Música *"
                          value={customTitle}
                          onChange={(e) => setCustomTitle(e.target.value)}
                          className="w-full rounded-lg border border-[#e4e4e7] px-3 py-1.5 text-xs outline-none focus:border-[#0a0a0a]"
                        />
                        <input
                          type="text"
                          placeholder="Artista / Produtor"
                          value={customArtist}
                          onChange={(e) => setCustomArtist(e.target.value)}
                          className="w-full rounded-lg border border-[#e4e4e7] px-3 py-1.5 text-xs outline-none focus:border-[#0a0a0a]"
                        />
                        <input
                          type="url"
                          placeholder="URL do arquivo MP3 / Stream *"
                          value={customUrl}
                          onChange={(e) => setCustomUrl(e.target.value)}
                          className="w-full rounded-lg border border-[#e4e4e7] px-3 py-1.5 text-xs outline-none focus:border-[#0a0a0a]"
                        />
                        <button
                          type="submit"
                          disabled={!customTitle.trim() || !customUrl.trim()}
                          className="w-full rounded-lg bg-[#1c1917] py-1.5 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                        >
                          Adicionar à Fila do Ar
                        </button>
                      </form>
                    </div>

                    {/* Catálogo Curado de Músicas Tarhget */}
                    <div className="bg-white rounded-xl border border-[#e4e4e7] p-4 shadow-xs flex-1 flex flex-col">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <h4 className="text-xs font-bold text-[#0a0a0a] flex items-center gap-1.5">
                          <Music className="size-3.5 text-[#71717a]" />
                          <span>Catálogo Oficial Sugerido</span>
                        </h4>
                        <span className="text-[10px] text-stone-500 font-medium">
                          {filteredCatalog.length} faixas
                        </span>
                      </div>

                      <div className="relative mb-3">
                        <Search className="size-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="Buscar por nome ou artista..."
                          value={musicSearchQuery}
                          onChange={(e) => setMusicSearchQuery(e.target.value)}
                          className="w-full rounded-lg border border-stone-200 bg-stone-100 pl-8 pr-3 py-1.5 text-xs outline-none focus:border-stone-900"
                        />
                      </div>

                      <div className="overflow-y-auto max-h-[300px] divide-y divide-stone-100 rounded-lg border border-stone-100">
                        {filteredCatalog.map((track) => (
                          <div
                            key={track.id}
                            className="flex items-center justify-between p-2.5 hover:bg-stone-50 transition"
                          >
                            <div className="min-w-0 pr-2">
                              <p className="truncate text-xs font-semibold text-stone-900">
                                {track.title}
                              </p>
                              <p className="truncate text-[10px] text-stone-500">
                                {track.artist}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => addTrackToQueue(track)}
                              title="Adicionar à fila"
                              className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-900 hover:text-white transition active:scale-95"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 2: SPOTS & VINHETAS NO AR */}
              {activeTab === "spots" && (
                <div className="space-y-5">
                  {/* Card de Frequência, Ações Gerais e Gerador */}
                  <div className="rounded-xl border border-[#e4e4e7] bg-white p-4 shadow-xs">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Clock className="size-4 text-[#71717a]" />
                          <h3 className="text-sm font-semibold text-[#0a0a0a]">
                            Frequência das Vinhetas Institucionais
                          </h3>
                          {savingInterval && (
                            <span className="text-xs font-medium text-[#71717a]">
                              Salvando…
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#71717a]">
                          Defina o intervalo automático das vinhetas ou acione manualmente.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          id="spot-interval"
                          value={spotIntervalMinutes}
                          onChange={(e) => handleIntervalChange(parseInt(e.target.value, 10))}
                          className="h-8 rounded-lg border border-[#e4e4e7] bg-white px-2.5 text-xs font-medium text-[#0a0a0a] outline-none focus:border-[#0a0a0a]"
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
                          className="flex items-center gap-1.5 rounded-lg border border-[#e4e4e7] bg-[#fafaf9] px-3.5 py-1.5 text-xs font-semibold text-[#0a0a0a] transition hover:bg-[#f4f4f5] shrink-0"
                        >
                          <Radio className="size-3.5 text-[#71717a]" />
                          <span>Disparar Agora</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowNewSpotModal(true)}
                          className="flex items-center gap-1.5 rounded-lg bg-[#1c1917] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 shrink-0"
                        >
                          <Plus className="size-3.5" />
                          <span>Criar Vinheta</span>
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-[#fafaf9] border border-[#e4e4e7] px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 text-[#52525b]">
                        {spotIntervalMinutes > 0 ? (
                          <span>
                            Próxima vinheta automática em:{" "}
                            <strong className="text-[#0a0a0a] font-mono font-semibold text-xs bg-white border border-[#e4e4e7] px-1.5 py-0.5 rounded">
                              {formatTimer(nextSpotSeconds)}
                            </strong>
                          </span>
                        ) : (
                          <span className="text-[#71717a]">
                            Disparo automático desativado. Vinhetas serão tocadas apenas quando acionadas.
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={restoreDefaultSpots}
                          className="text-[11px] font-medium text-[#71717a] hover:text-[#0a0a0a] underline"
                        >
                          Restaurar padrão
                        </button>
                        <button
                          type="button"
                          onClick={saveAndSyncSpots}
                          disabled={savingSpots}
                          className="flex items-center gap-1 rounded-md bg-[#1c1917] px-3 py-1 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                        >
                          {savingSpots ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : savedSpots ? (
                            <Check className="size-3" />
                          ) : null}
                          <span>{savedSpots ? "Salvo" : "Salvar"}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Grid de Vinhetas da Empresa com Toggle, Exclusão e Prévia */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {spotsList.map((spot) => {
                      const isPreviewing = previewingSpotId === spot.id;
                      const isLive = liveBroadcastSpot?.id === spot.id;
                      const isEnabled = spot.enabled !== false;

                      return (
                        <div
                          key={spot.id}
                          className={`flex flex-col justify-between rounded-xl border p-4 transition ${
                            isLive
                              ? "border-[#0a0a0a] bg-white ring-1 ring-[#0a0a0a]"
                              : isEnabled
                                ? "border-[#e4e4e7] bg-white"
                                : "border-[#e4e4e7] bg-[#fafaf9] opacity-60"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => toggleSpotEnabled(spot.id)}
                                  title={isEnabled ? "Clique para desativar da rotação" : "Clique para ativar na rotação"}
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
                                    isEnabled
                                      ? "bg-[#e4f6ec] text-[#1f7a4d]"
                                      : "bg-[#f4f4f5] text-[#71717a]"
                                  }`}
                                >
                                  <span className={`size-1.5 rounded-full ${isEnabled ? "bg-[#1f7a4d]" : "bg-[#a1a1aa]"}`} />
                                  {isEnabled ? "Ativa" : "Pausada"}
                                </button>
                                <span className="font-semibold text-[#0a0a0a] text-sm truncate">
                                  {spot.title}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {spot.durationSeconds && (
                                  <span className="rounded-md bg-[#f4f4f5] px-2 py-0.5 text-xs font-medium text-[#52525b]">
                                    {spot.durationSeconds}s
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => deleteSpot(spot.id)}
                                  title="Apagar vinheta"
                                  className="flex size-7 items-center justify-center rounded-md text-[#a1a1aa] hover:bg-[#f4f4f5] hover:text-[#0a0a0a] transition"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </div>
                            <p className="mt-1 text-xs text-[#71717a]">
                              {spot.subtitle}
                            </p>
                          </div>

                          <div className="mt-4 flex items-center justify-end gap-2 border-t border-[#f4f4f5] pt-3">
                            <button
                              type="button"
                              onClick={() => toggleSpotPreview(spot)}
                              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                                isPreviewing
                                  ? "bg-[#1c1917] text-white"
                                  : "border border-[#e4e4e7] bg-[#fafaf9] text-[#52525b] hover:bg-white hover:text-[#0a0a0a]"
                              }`}
                            >
                              {isPreviewing ? "Parar prévia" : "Ouvir prévia"}
                            </button>

                            <button
                              type="button"
                              onClick={() => broadcastSpotLive(spot)}
                              className="flex items-center gap-1.5 rounded-lg bg-[#1c1917] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                            >
                              <Radio className="size-3.5" />
                              <span>Transmitir no ar</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ABA 3: RECADO NO AR & CANDIDATOS ONLINE */}
              {activeTab === "alo" && (
                <div className="space-y-6">
                  <div className="rounded-xl border border-[#e4e4e7] bg-white p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#e4e4e7] bg-[#fafaf9] text-[#0a0a0a]">
                        <Mic className="size-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-[#0a0a0a]">
                          Recado de Áudio no Ar para Candidatos Online
                        </h3>
                        <p className="text-xs text-[#71717a] mt-0.5 leading-relaxed">
                          Envie uma mensagem falada na rádio para um candidato específico ou para todos os ouvintes conectados no portal.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Coluna Esquerda: Candidatos Conectados Agora + Campo de Busca/Nome */}
                    <div className="lg:col-span-5 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-[#0a0a0a] flex items-center gap-1.5">
                          <Users className="size-4 text-[#71717a]" />
                          <span>Candidatos Conectados Agora ({onlineCandidates.length})</span>
                        </h4>
                        <span className="text-[10px] text-[#1f7a4d] font-bold bg-[#e4f6ec] px-2 py-0.5 rounded-full flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-[#1f7a4d] animate-pulse" />
                          Ao Vivo
                        </span>
                      </div>

                      {/* Campo Direto para Buscar ou Digitar o Nome (ex: Vanessa) */}
                      <div className="flex items-center gap-2 rounded-xl border border-[#e4e4e7] bg-white px-3 py-2 shadow-2xs">
                        <Search className="size-4 text-[#71717a] shrink-0" />
                        <input
                          type="text"
                          placeholder="Digitar nome da candidata (ex: Vanessa)..."
                          value={customCandidateInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomCandidateInput(val);
                            if (val.trim()) {
                              setSelectedCandidate(val.trim());
                            } else {
                              setSelectedCandidate("all");
                            }
                          }}
                          className="flex-1 bg-transparent text-xs font-bold text-[#0a0a0a] placeholder:text-[#a1a1aa] placeholder:font-normal outline-none"
                        />
                        {customCandidateInput && (
                          <button
                            type="button"
                            onClick={() => {
                              setCustomCandidateInput("");
                              setSelectedCandidate("all");
                            }}
                            className="text-[#a1a1aa] hover:text-[#0a0a0a]"
                            title="Limpar nome"
                          >
                            <X className="size-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="rounded-xl border border-[#e4e4e7] bg-white divide-y divide-[#f4f4f5] shadow-xs max-h-[380px] overflow-y-auto">
                        {/* Opção para Todos os Candidatos */}
                        <div
                          onClick={() => {
                            setCustomCandidateInput("");
                            setSelectedCandidate("all");
                            setShoutoutMessage(
                              "Atenção a todos os candidatos conectados na rádio Tarhget! Nossa equipe de RH deseja um dia excelente e muito sucesso na sua trajetória profissional. Voltem sempre ao nosso portal!"
                            );
                          }}
                          className={`flex items-center justify-between p-3 cursor-pointer transition ${
                            selectedCandidate === "all" && !customCandidateInput.trim()
                              ? "bg-[#f4f4f5] border-l-4 border-[#0a0a0a] font-medium"
                              : "hover:bg-[#fafaf9]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#1c1917] text-white text-xs font-bold">
                              📢
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[#0a0a0a]">
                                Todos os Candidatos Conectados
                              </p>
                              <p className="text-[10px] text-[#71717a]">
                                Transmissão coletiva no ar
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-[#52525b] bg-[#f4f4f5] px-2 py-0.5 rounded-md">
                            Geral
                          </span>
                        </div>

                        {/* Card do Nome Digitado (se preenchido e não houver match exato na lista) */}
                        {customCandidateInput.trim() && (
                          <div
                            onClick={() => setSelectedCandidate(customCandidateInput.trim())}
                            className="flex items-center justify-between p-3 cursor-pointer bg-[#f4f4f5] border-l-4 border-[#0a0a0a] font-medium"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#1c1917] text-white text-xs font-bold">
                                👤
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-[#0a0a0a] truncate">
                                  {customCandidateInput.trim()}
                                </p>
                                <p className="text-[10px] text-[#71717a]">
                                  Candidato Selecionado para Recado no Ar
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-[#1f7a4d] bg-[#e4f6ec] px-2 py-0.5 rounded-md">
                              Alvo
                            </span>
                          </div>
                        )}

                        {/* Lista de candidatos online detectados */}
                        {(() => {
                          const query = customCandidateInput.trim().toLowerCase();
                          const listToShow = query
                            ? onlineCandidates.filter(
                                (c) =>
                                  (c.name && c.name.toLowerCase().includes(query)) ||
                                  (c.path && c.path.toLowerCase().includes(query))
                              )
                            : onlineCandidates;

                          if (listToShow.length === 0) {
                            return (
                              <div className="p-4 text-center text-xs text-[#71717a] space-y-1">
                                <p className="font-semibold text-[#52525b]">
                                  {query
                                    ? `Nenhum candidato online encontrado com "${customCandidateInput.trim()}".`
                                    : "Nenhum candidato na lista de presença neste segundo."}
                                </p>
                                <p className="text-[11px] text-[#71717a]">
                                  {query
                                    ? "Você pode transmitir para o nome digitado usando o card acima!"
                                    : "Quando candidatos acessarem vagas ou perfil, aparecerão automaticamente aqui."}
                                </p>
                              </div>
                            );
                          }

                          return listToShow.map((cand, idx) => {
                            const name = cand.name || `Candidato #${idx + 1}`;
                            const isSelected = selectedCandidate.toLowerCase() === name.toLowerCase();

                            return (
                              <div
                                key={cand.key}
                                onClick={() => {
                                  setSelectedCandidate(name);
                                  setCustomCandidateInput(cand.name || "");
                                  setShoutoutMessage(
                                    `Olá ${name}! A equipe da Tarhget viu que você está por aqui. Seja muito bem-vinda ao nosso portal e conte conosco para o seu crescimento profissional!`
                                  );
                                }}
                                className={`flex items-center justify-between p-3 cursor-pointer transition ${
                                  isSelected
                                    ? "bg-[#f4f4f5] border-l-4 border-[#0a0a0a] font-medium"
                                    : "hover:bg-[#fafaf9]"
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#f4f4f5] text-[#0a0a0a] text-xs font-bold">
                                    <User className="size-4" />
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-[#0a0a0a] truncate">
                                      {name}
                                    </p>
                                    <p className="text-[10px] text-[#71717a] truncate">
                                      {cand.path || "Navegando no portal"}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[10px] font-bold text-[#1f7a4d] bg-[#e4f6ec] px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <span className="size-1.5 rounded-full bg-[#1f7a4d] animate-pulse" />
                                  Online
                                </span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {/* Coluna Direita: Estúdio de Criação do Alô & Envio */}
                    <div className="lg:col-span-7 flex flex-col gap-4 bg-white rounded-xl border border-[#e4e4e7] p-5 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#f4f4f5]">
                        <h4 className="text-xs font-bold text-[#0a0a0a]">
                          Texto do Recado no Ar
                        </h4>
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#f4f4f5] border border-[#e4e4e7] px-3 py-1 text-xs font-bold text-[#0a0a0a]">
                          <span>Destinatário:</span>
                          <span className="text-[#52525b]">
                            {customCandidateInput.trim()
                              ? `👤 ${customCandidateInput.trim()}`
                              : selectedCandidate === "all"
                                ? "📢 Todos os Ouvintes"
                                : `👤 ${selectedCandidate}`}
                          </span>
                        </div>
                      </div>

                      {/* Roteiros Estratégicos Prontos (1-Click) */}
                      <div>
                        <span className="text-[11px] font-semibold text-[#52525b] block mb-2">
                          Sugestões de Acolhimento & Retenção:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const target = customCandidateInput.trim() || (selectedCandidate === "all" ? "amigos" : selectedCandidate);
                              setShoutoutMessage(
                                `Atenção ${target}! A equipe de atração de talentos viu sua chegada. Seja muito bem-vindo ao nosso portal e sinta-se em casa. Acreditamos no seu potencial!`
                              );
                            }}
                            className="text-left rounded-lg border border-[#e4e4e7] bg-white p-2.5 text-[11px] font-medium text-[#52525b] hover:border-[#0a0a0a] hover:bg-[#fafaf9] transition"
                          >
                            <span className="font-bold block text-[#0a0a0a] mb-0.5">Boas-Vindas & Acolhimento</span>
                            <span className="text-[#71717a] line-clamp-1">&quot;Atenção {customCandidateInput.trim() || "candidato"}! Seja bem-vindo...&quot;</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const target = customCandidateInput.trim() || (selectedCandidate === "all" ? "amigos" : selectedCandidate);
                              setShoutoutMessage(
                                `Passando no ar da rádio Tarhget para desejar um dia espetacular e muito produtivo para ${target}! Curta a seleção musical e foque no seu futuro!`
                              );
                            }}
                            className="text-left rounded-lg border border-[#e4e4e7] bg-white p-2.5 text-[11px] font-medium text-[#52525b] hover:border-[#0a0a0a] hover:bg-[#fafaf9] transition"
                          >
                            <span className="font-bold block text-[#0a0a0a] mb-0.5">Energia & Ótimo Dia</span>
                            <span className="text-[#71717a] line-clamp-1">&quot;Passando no ar para desejar um dia espetacular para {customCandidateInput.trim() || "você"}...&quot;</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const target = customCandidateInput.trim() || (selectedCandidate === "all" ? "candidatos" : selectedCandidate);
                              setShoutoutMessage(
                                `Dica de ouro da nossa equipe para ${target}: conte suas experiências reais e mantenha seu currículo atualizado. Estamos sempre em busca de talentos como você!`
                              );
                            }}
                            className="text-left rounded-lg border border-[#e4e4e7] bg-white p-2.5 text-[11px] font-medium text-[#52525b] hover:border-[#0a0a0a] hover:bg-[#fafaf9] transition"
                          >
                            <span className="font-bold block text-[#0a0a0a] mb-0.5">Dica dos Recrutadores</span>
                            <span className="text-[#71717a] line-clamp-1">&quot;Dica de ouro da nossa equipe para {customCandidateInput.trim() || "você"}...&quot;</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const target = customCandidateInput.trim() || (selectedCandidate === "all" ? "candidatos" : selectedCandidate);
                              setShoutoutMessage(
                                `Aviso especial para ${target}: parabéns por dar esse passo na sua carreira! Nosso portal de vagas é atualizado diariamente, volte sempre!`
                              );
                            }}
                            className="text-left rounded-lg border border-[#e4e4e7] bg-white p-2.5 text-[11px] font-medium text-[#52525b] hover:border-[#0a0a0a] hover:bg-[#fafaf9] transition"
                          >
                            <span className="font-bold block text-[#0a0a0a] mb-0.5">Incentivo & Retorno</span>
                            <span className="text-[#71717a] line-clamp-1">&quot;Parabéns pelo passo na carreira, volte sempre...&quot;</span>
                          </button>
                        </div>
                      </div>

                      {/* Textarea do Alô (100% Sólido) */}
                      <div>
                        <label className="text-[11px] font-semibold text-[#52525b] block mb-1">
                          Mensagem que o Locutor irá Falar no Ar:
                        </label>
                        <textarea
                          rows={3}
                          value={shoutoutMessage}
                          onChange={(e) => setShoutoutMessage(e.target.value)}
                          placeholder="Digite o recado ao vivo..."
                          className="w-full rounded-xl border border-[#e4e4e7] bg-white p-3 text-xs text-[#0a0a0a] outline-none focus:border-[#0a0a0a] leading-relaxed"
                        />
                      </div>

                      {/* Opções de Voz de Estúdio e Ações (Ouvir Prévia + Transmitir no Ar) */}
                      <div className="flex flex-col gap-3 pt-3 border-t border-[#f4f4f5]">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#52525b] whitespace-nowrap">Voz do Locutor:</span>
                            <select
                              value={shoutoutVoice}
                              onChange={(e) => setShoutoutVoice(e.target.value)}
                              className="h-8 rounded-lg border border-[#e4e4e7] bg-white px-2.5 text-xs font-semibold text-[#0a0a0a] outline-none focus:border-[#0a0a0a]"
                            >
                              <option value="pt-BR-FranciscaNeural">🎙️ Francisca FM (Comercial & Ultra Animada)</option>
                              <option value="pt-BR-ThalitaMultilingualNeural">🎙️ Thalita HD (Ultra Realista & Acolhedora)</option>
                              <option value="pt-BR-AntonioNeural">🎙️ Antônio FM (Locutor Impacto & Energia)</option>
                              <option value="pt-BR-FabioNeural">🎙️ Lucas FM (Jovem & Dinâmico)</option>
                            </select>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {/* BOTÃO 1: OUVIR PRÉVIA NO FONE ANTES DE TRANSMITIR (Exigência do usuário) */}
                            <button
                              type="button"
                              onClick={togglePreviewShoutout}
                              disabled={!shoutoutMessage.trim() || sendingShoutout}
                              className={`flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition active:scale-95 disabled:opacity-50 shrink-0 ${
                                previewingShoutout
                                  ? "bg-[#1c1917] text-white"
                                  : "bg-[#fafaf9] text-[#52525b] hover:bg-[#f4f4f5] border border-[#e4e4e7]"
                              }`}
                              title="Ouvir como a locução soará antes de colocar no ar"
                            >
                              {previewLoading ? (
                                <Loader2 className="size-4 animate-spin text-[#52525b]" />
                              ) : previewingShoutout ? (
                                <Pause className="size-4 text-white fill-current" />
                              ) : (
                                <Headphones className="size-4 text-[#52525b]" />
                              )}
                              <span>
                                {previewingShoutout
                                  ? "Parar Prévia"
                                  : previewLoading
                                    ? "Preparando..."
                                    : "Ouvir Prévia"}
                              </span>
                            </button>

                            {/* BOTÃO 2: TRANSMITIR AO VIVO NO AR */}
                            <button
                              type="button"
                              onClick={sendPersonalizedShoutout}
                              disabled={sendingShoutout || !shoutoutMessage.trim()}
                              className="flex items-center justify-center gap-2 rounded-xl bg-[#1c1917] px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:opacity-90 active:scale-95 disabled:opacity-50 shrink-0"
                            >
                              {sendingShoutout ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : sentShoutout ? (
                                <Check className="size-4 text-emerald-300" />
                              ) : (
                                <Send className="size-4" />
                              )}
                              <span>
                                {sentShoutout
                                  ? "Recado Transmitido!"
                                  : sendingShoutout
                                    ? "Transmitindo..."
                                    : customCandidateInput.trim()
                                      ? `Transmitir para ${customCandidateInput.trim()}`
                                      : selectedCandidate !== "all"
                                        ? `Transmitir para ${selectedCandidate}`
                                        : "Transmitir Recado Geral"}
                              </span>
                            </button>
                          </div>
                        </div>

                        {previewingShoutout && (
                          <div className="flex items-center gap-2 rounded-lg bg-[#fafaf9] border border-[#e4e4e7] px-3 py-1.5 text-xs text-[#52525b] font-semibold">
                            <Headphones className="size-4 text-[#0a0a0a] shrink-0" />
                            <span>
                              Reproduzindo prévia da mensagem no fone com atenuação da música. Ajuste o texto ou locutor antes de transmitir.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 4: SELEÇÃO DE ESTAÇÃO */}
              {activeTab === "estacao" && (
                <div className="max-w-2xl mx-auto space-y-4">
                  <div className="flex items-center justify-between bg-white rounded-xl border border-[#e4e4e7] p-4 shadow-xs">
                    <div>
                      <h3 className="font-bold text-[#0a0a0a] text-sm">
                        Estação da Empresa (Configuração do Painel)
                      </h3>
                      <p className="text-xs text-[#71717a]">
                        A rádio escolhida abaixo tocará tanto para o gestor quanto para todos os candidatos
                      </p>
                    </div>
                    {savedStation && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-[#1f7a4d] animate-in fade-in">
                        <Check className="size-3.5" /> Salva no servidor!
                      </span>
                    )}
                  </div>

                  {/* Lista de Estações Curadas */}
                  <div className="divide-y divide-[#f4f4f5] rounded-xl border border-[#e4e4e7] bg-white shadow-xs">
                    {stations.map((st) => {
                      const isCurrent = current.url === st.url;
                      return (
                        <div
                          key={st.id}
                          className={`flex items-center justify-between p-3.5 transition ${
                            isCurrent ? "bg-[#f4f4f5]" : "hover:bg-[#fafaf9]"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                                isCurrent
                                  ? "bg-[#1c1917] text-white font-bold"
                                  : "bg-[#f4f4f5] text-[#52525b]"
                              }`}
                            >
                              <Radio className="size-4" />
                            </span>
                            <div>
                              <p className="font-bold text-[#0a0a0a] text-xs">
                                {st.name}
                              </p>
                              <p className="text-[11px] text-[#71717a]">
                                {st.genre}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => selectStationAsAdmin(st)}
                            disabled={!canManage || isCurrent}
                            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                              isCurrent
                                ? "bg-[#1c1917] text-white"
                                : "bg-[#f4f4f5] text-[#52525b] hover:bg-[#e4e4e7]"
                            } disabled:opacity-50`}
                          >
                            {isCurrent ? "Estação Ativa" : "Sintonizar Empresa"}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Busca Pública no Radio Browser */}
                  {canManage && (
                    <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs">
                      <h4 className="font-bold text-xs text-stone-900 mb-2">
                        Buscar Estações de Rádio Online (Radio Browser Global)
                      </h4>
                      <form onSubmit={searchRadioBrowser} className="flex gap-2 mb-3">
                        <input
                          type="text"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Ex: Antena 1, Jovem Pan, Lofi Girl, Jazz..."
                          className="flex-1 rounded-lg border border-stone-200 px-3 py-1.5 text-xs outline-none focus:border-stone-900"
                        />
                        <button
                          type="submit"
                          disabled={searching || !query.trim()}
                          className="flex items-center gap-1.5 rounded-lg bg-stone-900 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-stone-800 disabled:opacity-50"
                        >
                          {searching ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
                          <span>Buscar</span>
                        </button>
                      </form>

                      {searchResults.length > 0 && (
                        <div className="divide-y divide-stone-100 rounded-lg border border-stone-100 max-h-48 overflow-y-auto">
                          {searchResults.map((res) => (
                            <div
                              key={res.id}
                              className="flex items-center justify-between p-2.5 hover:bg-stone-50"
                            >
                              <div className="min-w-0 pr-2">
                                <p className="truncate text-xs font-semibold text-stone-900">
                                  {res.name}
                                </p>
                                <p className="truncate text-[10px] text-stone-500">
                                  {res.genre}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => selectStationAsAdmin(res)}
                                className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-bold text-stone-800 hover:bg-stone-900 hover:text-white transition"
                              >
                                Usar Esta Rádio
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* TELA SOBREPOSTA 100% OPACA PARA CRIAÇÃO DE NOVA VINHETA */}
      {showNewSpotModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Criar Vinheta"
            className="fixed inset-0 z-[210] flex items-center justify-center bg-[#fafaf9] p-6"
          >
            <div className="flex flex-col w-full max-w-xl bg-white rounded-2xl shadow-sm border border-[#e4e4e7] overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#e4e4e7] bg-white text-[#0a0a0a]">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="size-4 text-[#71717a]" />
                  <h3 className="text-sm font-semibold">Criar Nova Vinheta</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewSpotModal(false)}
                  className="text-[#71717a] hover:text-[#0a0a0a]"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[#0a0a0a] block mb-1">
                    Título da Vinheta *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Boas-vindas ao Portal de Vagas"
                    value={newSpotTitle}
                    onChange={(e) => setNewSpotTitle(e.target.value)}
                    className="w-full rounded-xl border border-[#e4e4e7] p-2.5 text-xs text-[#0a0a0a] outline-none focus:border-[#0a0a0a]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#0a0a0a] block mb-1">
                    Texto da Locução *
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Digite o texto que o locutor falará na vinheta..."
                    value={newSpotScript}
                    onChange={(e) => setNewSpotScript(e.target.value)}
                    className="w-full rounded-xl border border-[#e4e4e7] p-2.5 text-xs text-[#0a0a0a] outline-none focus:border-[#0a0a0a]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-[#0a0a0a] block mb-1">
                      Voz do Locutor
                    </label>
                    <select
                      value={newSpotVoice}
                      onChange={(e) => setNewSpotVoice(e.target.value)}
                      className="w-full rounded-xl border border-[#e4e4e7] bg-white p-2.5 text-xs text-[#0a0a0a] outline-none focus:border-[#0a0a0a]"
                    >
                      <option value="pt-BR-FranciscaNeural">Francisca FM (Comercial & Ultra Animada)</option>
                      <option value="pt-BR-ThalitaMultilingualNeural">Thalita HD (Ultra Realista & Acolhedora)</option>
                      <option value="pt-BR-AntonioNeural">Antônio FM (Locutor Impacto & Energia)</option>
                      <option value="pt-BR-FabioNeural">Lucas FM (Jovem & Dinâmico)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#0a0a0a] block mb-1">
                      Estilo de Áudio
                    </label>
                    <select
                      value={newSpotSfx}
                      onChange={(e) => setNewSpotSfx(e.target.value)}
                      className="w-full rounded-xl border border-[#e4e4e7] bg-white p-2.5 text-xs text-[#0a0a0a] outline-none focus:border-[#0a0a0a]"
                    >
                      <option value="comercial-limpo">Locução Institucional Limpa</option>
                      <option value="acolhimento-suave">Acolhimento Suave</option>
                      <option value="laser-sweep">Transição de Rádio</option>
                      <option value="raio-trovao">Impacto</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-6 py-4 bg-[#fafaf9] border-t border-[#e4e4e7]">
                <button
                  type="button"
                  onClick={() => setShowNewSpotModal(false)}
                  className="rounded-xl border border-[#e4e4e7] bg-white px-4 py-2 text-xs font-medium text-[#52525b] hover:text-[#0a0a0a] transition"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleGenerateNewSpot}
                  disabled={generatingSpot || !newSpotScript.trim()}
                  className="flex items-center gap-1.5 rounded-xl bg-[#1c1917] px-5 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {generatingSpot && <Loader2 className="size-3.5 animate-spin" />}
                  <span>{generatingSpot ? "Gerando áudio..." : "Gerar e adicionar"}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
