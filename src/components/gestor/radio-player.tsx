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

import { createClient } from "@/lib/supabase/client";
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

  // Spots / Vinhetas gerenciadas
  const [spotsList, setSpotsList] = useState<RadioSpot[]>(TARGET_RADIO_SPOTS);
  const [previewingSpotId, setPreviewingSpotId] = useState<string | null>(null);
  const [liveBroadcastSpot, setLiveBroadcastSpot] = useState<RadioSpot | null>(null);
  const [savingSpots, setSavingSpots] = useState(false);
  const [savedSpots, setSavedSpots] = useState(false);

  // Modal de Criação de Vinheta com IA Michelin
  const [showNewSpotModal, setShowNewSpotModal] = useState(false);
  const [newSpotTitle, setNewSpotTitle] = useState("");
  const [newSpotScript, setNewSpotScript] = useState("");
  const [newSpotVoice, setNewSpotVoice] = useState("pt-BR-AntonioNeural");
  const [newSpotSfx, setNewSpotSfx] = useState("raio-trovao");
  const [generatingSpot, setGeneratingSpot] = useState(false);

  // Painéis e abas de controle
  const [configOpen, setConfigOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"fila" | "spots" | "alo" | "estacao">("fila");

  // Candidatos Online via Supabase Presence
  const [onlineCandidates, setOnlineCandidates] = useState<
    Array<{ key: string; name?: string; path?: string; isRegistered?: boolean }>
  >([]);

  // Estúdio de Alô no Ar & Recados aos Candidatos Online
  const [selectedCandidate, setSelectedCandidate] = useState<string>("all");
  const [shoutoutMessage, setShoutoutMessage] = useState<string>(
    "Olá! A equipe da Tarhget viu que você está por aqui. Seja muito bem-vindo ao nosso portal e tenha um excelente dia!"
  );
  const [shoutoutVoice, setShoutoutVoice] = useState<string>("pt-BR-AntonioNeural");
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

  // 3. Rastreamento dos Candidatos Online em tempo real via Presence
  useEffect(() => {
    try {
      const supabase = createClient();
      const presenceKey = `dj-${Date.now()}`;
      const ch = supabase.channel(`online:${resolvedSlug}`, {
        config: { presence: { key: presenceKey } },
      });

      ch.on("presence", { event: "sync" }, () => {
        const state = ch.presenceState<{
          role: "candidato" | "equipe";
          name?: string;
          path?: string;
          isRegistered?: boolean;
        }>();

        const list: Array<{ key: string; name?: string; path?: string; isRegistered?: boolean }> =
          [];
        for (const [key, presences] of Object.entries(state)) {
          for (const p of presences) {
            if (p.role === "candidato") {
              list.push({
                key,
                name: p.name,
                path: p.path,
                isRegistered: p.isRegistered,
              });
            }
          }
        }
        setOnlineCandidates(list);
      });

      ch.subscribe();

      return () => {
        void ch.unsubscribe();
      };
    } catch {
      // Supabase opcional
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
        if (savedSpots && savedSpots.length > 0) {
          setSpotsList(savedSpots);
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
    audio
      .play()
      .then(() => {
        setPreviewingSpotId(spot.id);
      })
      .catch(() => setPreviewingSpotId(null));
  };

  // Disparar Vinheta no Ar AO VIVO para os Candidatos
  const broadcastSpotLive = (spot: RadioSpot) => {
    const audio = spotAudioRef.current;
    if (audio) {
      audio.src = spot.audioUrl;
      audio
        .play()
        .then(() => {
          setLiveBroadcastSpot(spot);
        })
        .catch(() => {});
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

    setBroadcastNotification(`⚡ Efeito sonoro "${sfxLabel}" disparado no ar!`);
    setTimeout(() => setBroadcastNotification(null), 3000);
  };

  // Ativar / desativar vinheta na rotação automática
  const toggleSpotEnabled = (spotId: string) => {
    setSpotsList((prev) =>
      prev.map((s) =>
        s.id === spotId ? { ...s, enabled: s.enabled === false ? true : false } : s
      )
    );
  };

  // Apagar vinheta da lista
  const deleteSpot = (spotId: string) => {
    setSpotsList((prev) => prev.filter((s) => s.id !== spotId));
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
    setSpotsList(TARGET_RADIO_SPOTS);
    await saveRadioSpotsAction(TARGET_RADIO_SPOTS);
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

  // Transmitir Alô no Ar Personalizado para Candidato Online
  const sendPersonalizedShoutout = async () => {
    if (!shoutoutMessage.trim()) return;
    setSendingShoutout(true);
    try {
      const isAll = selectedCandidate === "all";
      const targetName = isAll ? "" : selectedCandidate;

      // 1. Gera áudio com masterização Michelin
      const res = await generateRadioSpotAction({
        title: isAll ? "Recado Especial no Ar" : `Alô Especial para ${selectedCandidate}`,
        script: shoutoutMessage,
        voice: shoutoutVoice,
        sfxPreset: "acolhimento-suave",
      });

      const audioUrl = res.ok && res.spot?.audioUrl ? res.spot.audioUrl : undefined;

      // 2. Transmite instantaneamente via BroadcastChannel
      localChannelRef.current?.postMessage({
        type: "live_shoutout",
        targetCandidateName: targetName,
        message: shoutoutMessage,
        audioUrl,
        broadcastMode: isAll ? "all" : "private",
        timestamp: Date.now(),
      });

      // 3. Transmite via Supabase Realtime
      for (const ch of realtimeChannelsRef.current) {
        ch.send({
          type: "broadcast",
          event: "live_shoutout",
          payload: {
            targetCandidateName: targetName,
            message: shoutoutMessage,
            audioUrl,
            broadcastMode: isAll ? "all" : "private",
            timestamp: Date.now(),
          },
        });
      }

      // 4. Toca no retorno do estúdio do DJ
      if (audioUrl && spotAudioRef.current) {
        spotAudioRef.current.src = audioUrl;
        spotAudioRef.current.volume = muted ? 0 : volume;
        spotAudioRef.current.play().catch(() => {});
      }

      setSentShoutout(true);
      setBroadcastNotification(
        `🎙️ Alô no ar transmitido com sucesso para ${isAll ? "todos os candidatos" : selectedCandidate}!`
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
      <audio ref={sfxAudioRef} preload="none" />

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

        <button
          type="button"
          onClick={() => {
            setActiveTab("alo");
            setConfigOpen(true);
          }}
          className="flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-500/15 px-2 py-1 text-[10px] font-bold text-amber-900 transition hover:bg-amber-500/25 active:scale-98"
        >
          <Mic className="size-3 text-amber-700" />
          <span>Alô no Ar</span>
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
          <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header do Estúdio DJ */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-900 text-white">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500 text-stone-950 font-bold shadow-xs">
                  <Headphones className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-bold tracking-tight text-white">
                      Estúdio DJ — Rádio Tarhget (Nível Michelin)
                    </h2>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                      <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                      {playing ? "TRANSMITINDO NO AR" : "ESTÚDIO PRONTO"}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400">
                    Controle de músicas em tempo real, vinhetas masterizadas com IA e alô personalizado aos candidatos online
                  </p>
                </div>
              </div>

              {/* Botões do Topo: Crossfade + Fechar */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCrossfadeEnabled((c) => !c)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    crossfadeEnabled
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "bg-stone-800 text-stone-400 hover:text-white"
                  }`}
                  title="Transição suave de volume entre faixas (Fade-in e Fade-out)"
                >
                  <SlidersHorizontal className="size-3.5" />
                  <span>Crossfade {crossfadeEnabled ? "ON" : "OFF"}</span>
                </button>

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

            {/* Soundboard Rápidos de Efeitos de Rádio */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-stone-950 px-6 py-2 text-xs">
              <div className="flex items-center gap-1.5 text-stone-400 font-semibold text-[11px]">
                <Zap className="size-3.5 text-amber-400" />
                <span>PADS DE EFEITOS SONOROS (SFX):</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => triggerSfx("sfx-laser", "⚡ Raio Sônico")}
                  className="rounded-md bg-stone-800 px-2.5 py-1 font-bold text-amber-300 hover:bg-amber-500 hover:text-stone-950 transition active:scale-95"
                >
                  ⚡ Raio Sônico
                </button>
                <button
                  type="button"
                  onClick={() => triggerSfx("sfx-ding", "🔔 Ding Alerta")}
                  className="rounded-md bg-stone-800 px-2.5 py-1 font-bold text-sky-300 hover:bg-sky-400 hover:text-stone-950 transition active:scale-95"
                >
                  🔔 Ding Alerta
                </button>
                <button
                  type="button"
                  onClick={() => triggerSfx("sfx-whoosh", "💨 Sweep Rádio")}
                  className="rounded-md bg-stone-800 px-2.5 py-1 font-bold text-purple-300 hover:bg-purple-400 hover:text-stone-950 transition active:scale-95"
                >
                  💨 Sweep Rádio
                </button>
                <button
                  type="button"
                  onClick={() => triggerSfx("sfx-subdrop", "🎯 Sub Drop 808")}
                  className="rounded-md bg-stone-800 px-2.5 py-1 font-bold text-emerald-300 hover:bg-emerald-400 hover:text-stone-950 transition active:scale-95"
                >
                  🎯 Sub Drop 808
                </button>
              </div>
            </div>

            {/* Menu de Abas Superior */}
            <div className="flex items-center border-b border-stone-200 bg-stone-100 px-6 gap-2 pt-2 text-xs font-semibold overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab("fila")}
                className={`flex items-center gap-2 px-4 sm:px-5 py-3 border-b-2 font-bold transition whitespace-nowrap ${
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
                className={`flex items-center gap-2 px-4 sm:px-5 py-3 border-b-2 font-bold transition whitespace-nowrap ${
                  activeTab === "spots"
                    ? "border-violet-600 text-stone-950 bg-white rounded-t-xl shadow-xs"
                    : "border-transparent text-stone-600 hover:text-stone-900"
                }`}
              >
                <Sparkles className="size-4 text-violet-600" />
                <span>Spots & Vinhetas IA</span>
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] text-violet-900 font-bold">
                  {spotsList.filter((s) => s.enabled !== false).length}/{spotsList.length} ativos
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("alo")}
                className={`flex items-center gap-2 px-4 sm:px-5 py-3 border-b-2 font-bold transition whitespace-nowrap ${
                  activeTab === "alo"
                    ? "border-amber-600 text-stone-950 bg-white rounded-t-xl shadow-xs"
                    : "border-transparent text-stone-600 hover:text-stone-900"
                }`}
              >
                <Mic className="size-4 text-amber-600" />
                <span>Alô no Ar & Candidatos Online</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-900 font-bold">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {onlineCandidates.length} online
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("estacao")}
                className={`flex items-center gap-2 px-4 sm:px-5 py-3 border-b-2 font-bold transition whitespace-nowrap ${
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

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={saveAndSyncQueue}
                          disabled={savingPlaylist}
                          className="flex items-center gap-1.5 rounded-lg bg-stone-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-stone-800 disabled:opacity-50"
                        >
                          {savingPlaylist ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : savedPlaylist ? (
                            <Check className="size-3.5 text-emerald-400" />
                          ) : (
                            <RadioTower className="size-3.5 text-amber-400" />
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
                    <div className="rounded-xl border border-stone-200 bg-white divide-y divide-stone-100 shadow-xs max-h-[460px] overflow-y-auto">
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
                                ? "bg-amber-500/10 font-medium"
                                : "hover:bg-stone-50"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-xs font-bold text-stone-700">
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
                                    ? "bg-amber-600 text-white"
                                    : "bg-stone-100 text-stone-700 hover:bg-amber-100 hover:text-amber-900"
                                }`}
                              >
                                {isCurrentPlaying ? (
                                  <Pause className="size-3.5 fill-current" />
                                ) : (
                                  <Play className="size-3.5 translate-x-[0.5px] fill-current" />
                                )}
                              </button>

                              <div className="min-w-0">
                                <p className="truncate text-xs font-bold text-stone-900">
                                  {track.title}
                                </p>
                                <p className="truncate text-[11px] text-stone-500">
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
                                className="flex size-7 items-center justify-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-800 disabled:opacity-30"
                              >
                                <ArrowUp className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveTrackInQueue(idx, "down")}
                                disabled={idx === playlistTracks.length - 1}
                                title="Mover para baixo"
                                className="flex size-7 items-center justify-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-800 disabled:opacity-30"
                              >
                                <ArrowDown className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeTrackFromQueue(idx)}
                                title="Remover da fila"
                                className="flex size-7 items-center justify-center rounded-md text-rose-500 hover:bg-rose-50 disabled:opacity-30"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Coluna Direita: Catálogo Completo & Adicionar Personalizada */}
                  <div className="lg:col-span-5 flex flex-col gap-4">
                    {/* Formulário: Adicionar Faixa por Link */}
                    <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs">
                      <h4 className="text-xs font-bold text-stone-900 mb-2 flex items-center gap-1.5">
                        <Plus className="size-3.5 text-amber-600" />
                        <span>Adicionar Faixa por Link de Áudio</span>
                      </h4>
                      <form onSubmit={addCustomTrack} className="space-y-2.5">
                        <input
                          type="text"
                          placeholder="Título da Música *"
                          value={customTitle}
                          onChange={(e) => setCustomTitle(e.target.value)}
                          className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-xs outline-none focus:border-stone-900"
                        />
                        <input
                          type="text"
                          placeholder="Artista / Produtor"
                          value={customArtist}
                          onChange={(e) => setCustomArtist(e.target.value)}
                          className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-xs outline-none focus:border-stone-900"
                        />
                        <input
                          type="url"
                          placeholder="URL do arquivo MP3 / Stream *"
                          value={customUrl}
                          onChange={(e) => setCustomUrl(e.target.value)}
                          className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-xs outline-none focus:border-stone-900"
                        />
                        <button
                          type="submit"
                          disabled={!customTitle.trim() || !customUrl.trim()}
                          className="w-full rounded-lg bg-stone-900 py-1.5 text-xs font-bold text-white transition hover:bg-stone-800 disabled:opacity-50"
                        >
                          Adicionar à Fila do Ar
                        </button>
                      </form>
                    </div>

                    {/* Catálogo Curado de Músicas Tarhget */}
                    <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs flex-1 flex flex-col">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                          <Music className="size-3.5 text-amber-600" />
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
                          className="w-full rounded-lg border border-stone-200 bg-stone-50/50 pl-8 pr-3 py-1.5 text-xs outline-none focus:border-stone-900"
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

              {/* ABA 2: SPOTS & VINHETAS NO AR (COM ESCOLHA, EXCLUSÃO E GERADOR IA) */}
              {activeTab === "spots" && (
                <div className="space-y-5">
                  {/* Card de Frequência, Ações Gerais e Gerador */}
                  <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-4 shadow-xs">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Clock className="size-4 text-violet-700" />
                          <h3 className="text-sm font-bold text-violet-950">
                            Frequência dos Spots Institucionais & Rotação
                          </h3>
                          {savingInterval && (
                            <span className="text-xs font-semibold text-amber-700 animate-pulse">
                              Salvando…
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-violet-800/80">
                          Defina o intervalo automático dos spots ou acione manualmente. Marque quais vinhetas deseja manter no ar.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
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

                        <button
                          type="button"
                          onClick={() => setShowNewSpotModal(true)}
                          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-amber-700 active:scale-95 shrink-0"
                        >
                          <Sparkles className="size-3.5" />
                          <span>✨ Criar Vinheta com IA</span>
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-white/90 border border-violet-200/80 px-3 py-2 text-xs">
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
                            Disparo automático desativado. Vinhetas serão tocadas apenas quando acionadas.
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={restoreDefaultSpots}
                          className="text-[11px] font-semibold text-stone-500 hover:text-stone-900 underline"
                        >
                          Restaurar Vinhetas Oficiais
                        </button>
                        <button
                          type="button"
                          onClick={saveAndSyncSpots}
                          disabled={savingSpots}
                          className="flex items-center gap-1 rounded-md bg-stone-900 px-3 py-1 text-xs font-bold text-white transition hover:bg-stone-800 disabled:opacity-50"
                        >
                          {savingSpots ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : savedSpots ? (
                            <Check className="size-3 text-emerald-400" />
                          ) : null}
                          <span>{savedSpots ? "Salvo no Ar!" : "Salvar Configuração"}</span>
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
                          className={`flex flex-col justify-between rounded-xl border p-4 transition shadow-xs ${
                            isLive
                              ? "border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/30"
                              : isEnabled
                                ? "border-stone-200 bg-white hover:border-stone-300"
                                : "border-stone-200 bg-stone-50 opacity-60"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => toggleSpotEnabled(spot.id)}
                                  title={isEnabled ? "Clique para desativar da rotação" : "Clique para ativar na rotação"}
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition ${
                                    isEnabled
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                      : "bg-stone-200 text-stone-600"
                                  }`}
                                >
                                  <span className={`size-1.5 rounded-full ${isEnabled ? "bg-emerald-500" : "bg-stone-400"}`} />
                                  {isEnabled ? "Ativo no Ar" : "Pausado"}
                                </button>
                                <span className="font-bold text-stone-900 text-sm truncate">
                                  {spot.title}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {spot.durationSeconds && (
                                  <span className="rounded-md bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-900">
                                    ⏱️ {spot.durationSeconds}s
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => deleteSpot(spot.id)}
                                  title="Apagar vinheta"
                                  className="flex size-7 items-center justify-center rounded-md text-stone-400 hover:bg-rose-50 hover:text-rose-600 transition"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </div>
                            <p className="mt-1 text-xs text-stone-600">
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

              {/* ABA 3: ALÔ NO AR & CANDIDATOS ONLINE (NÍVEL MICHELIN) */}
              {activeTab === "alo" && (
                <div className="space-y-6">
                  {/* Banner de Estrategista de Rádio Tarhget */}
                  <div className="rounded-xl border border-amber-300 bg-amber-500/10 p-5 shadow-xs">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white font-bold">
                        <Mic className="size-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-stone-900">
                          Alô no Ar — Conquista & Retenção de Candidatos em Tempo Real
                        </h3>
                        <p className="text-xs text-stone-700 mt-0.5 leading-relaxed">
                          Fale o nome do candidato online e envie uma mensagem falada de estúdio profissional com voz humanizada, equalização FM e música ducking. Crie uma experiência inesquecível que faz os melhores talentos retornarem sempre ao portal da sua empresa.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Coluna Esquerda: Candidatos Conectados Agora */}
                    <div className="lg:col-span-5 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                          <Users className="size-4 text-amber-600" />
                          <span>Candidatos Conectados Agora ({onlineCandidates.length})</span>
                        </h4>
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Ao Vivo
                        </span>
                      </div>

                      <div className="rounded-xl border border-stone-200 bg-white divide-y divide-stone-100 shadow-xs max-h-[380px] overflow-y-auto">
                        {/* Opção para Todos os Candidatos */}
                        <div
                          onClick={() => {
                            setSelectedCandidate("all");
                            setShoutoutMessage(
                              "Atenção a todos os candidatos conectados na rádio Tarhget! Nossa equipe de RH deseja um dia excelente e muito sucesso na sua trajetória profissional. Voltem sempre ao nosso portal!"
                            );
                          }}
                          className={`flex items-center justify-between p-3 cursor-pointer transition ${
                            selectedCandidate === "all"
                              ? "bg-amber-500/15 border-l-4 border-amber-600 font-medium"
                              : "hover:bg-stone-50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-stone-900 text-white text-xs font-bold">
                              📢
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-stone-900">
                                Todos os Candidatos Conectados
                              </p>
                              <p className="text-[10px] text-stone-500">
                                Transmissão coletiva no ar
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                            Geral
                          </span>
                        </div>

                        {/* Lista individual */}
                        {onlineCandidates.length === 0 ? (
                          <div className="p-4 text-center text-xs text-stone-500">
                            Nenhum candidato identificado navegando no momento. Você ainda pode transmitir para &quot;Todos os Candidatos&quot; ou testar o locutor!
                          </div>
                        ) : (
                          onlineCandidates.map((cand, idx) => {
                            const name = cand.name || `Candidato Sintonizado #${idx + 1}`;
                            const isSelected = selectedCandidate === name;

                            return (
                              <div
                                key={cand.key}
                                onClick={() => {
                                  setSelectedCandidate(name);
                                  setShoutoutMessage(
                                    `Olá ${name}! A equipe da Tarhget viu que você está por aqui. Seja muito bem-vindo ao nosso portal e conte conosco para o seu crescimento profissional!`
                                  );
                                }}
                                className={`flex items-center justify-between p-3 cursor-pointer transition ${
                                  isSelected
                                    ? "bg-amber-500/15 border-l-4 border-amber-600 font-medium"
                                    : "hover:bg-stone-50"
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-900 text-xs font-bold">
                                    <User className="size-4" />
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-stone-900 truncate">
                                      {name}
                                    </p>
                                    <p className="text-[10px] text-stone-500 truncate">
                                      {cand.path || "Navegando no portal"}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[10px] font-semibold text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md">
                                  Online
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Coluna Direita: Estúdio de Criação do Alô & Envio */}
                    <div className="lg:col-span-7 flex flex-col gap-4 bg-white rounded-xl border border-stone-200 p-5 shadow-xs">
                      <div>
                        <h4 className="text-xs font-bold text-stone-900 flex items-center justify-between">
                          <span>Texto do Alô no Ar</span>
                          <span className="text-[10px] text-stone-500 font-normal">
                            Destinatário:{" "}
                            <strong className="text-amber-700">
                              {selectedCandidate === "all" ? "Todos os Ouvintes" : selectedCandidate}
                            </strong>
                          </span>
                        </h4>
                      </div>

                      {/* Roteiros Estratégicos Prontos (1-Click) */}
                      <div>
                        <span className="text-[11px] font-semibold text-stone-600 block mb-1.5">
                          💡 Sugestões Estratégicas de Acolhimento & Retenção:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const cand = selectedCandidate === "all" ? "todos" : selectedCandidate;
                              setShoutoutMessage(
                                `Atenção ${cand}! A equipe de atração de talentos viu sua chegada. Seja muito bem-vindo ao nosso portal e sinta-se em casa. Acreditamos no seu potencial!`
                              );
                            }}
                            className="rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-semibold text-stone-700 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-950 transition"
                          >
                            🌟 Boas-Vindas & Acolhimento
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const cand = selectedCandidate === "all" ? "amigos" : selectedCandidate;
                              setShoutoutMessage(
                                `Passando no ar da rádio Tarhget para desejar um dia espetacular e muito produtivo para ${cand}! Curta a seleção musical e foque no seu futuro!`
                              );
                            }}
                            className="rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-semibold text-stone-700 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-950 transition"
                          >
                            ☀️ Energia & Ótimo Dia
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const cand = selectedCandidate === "all" ? "candidatos" : selectedCandidate;
                              setShoutoutMessage(
                                `Dica de ouro da nossa equipe para ${cand}: conte suas experiências reais e mantenha seu currículo atualizado. Estamos sempre em busca de talentos como você!`
                              );
                            }}
                            className="rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-semibold text-stone-700 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-950 transition"
                          >
                            💡 Dica dos Recrutadores
                          </button>
                        </div>
                      </div>

                      {/* Textarea do Alô */}
                      <textarea
                        rows={3}
                        value={shoutoutMessage}
                        onChange={(e) => setShoutoutMessage(e.target.value)}
                        placeholder="Digite o recado ao vivo..."
                        className="w-full rounded-xl border border-stone-300 p-3 text-xs text-stone-900 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20"
                      />

                      {/* Opções de Voz de Estúdio */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-stone-100">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-stone-700">Voz do Locutor:</span>
                          <select
                            value={shoutoutVoice}
                            onChange={(e) => setNewSpotVoice(e.target.value)}
                            className="h-8 rounded-lg border border-stone-300 bg-white px-2.5 text-xs font-semibold text-stone-900 outline-none focus:border-amber-600"
                          >
                            <option value="pt-BR-AntonioNeural">🎙️ Antônio FM (Voz Grave & Marcante)</option>
                            <option value="pt-BR-ThalitaNeural">🎙️ Thalita Executiva (Voz Acolhedora)</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={sendPersonalizedShoutout}
                          disabled={sendingShoutout || !shoutoutMessage.trim()}
                          className="flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-amber-700 active:scale-95 disabled:opacity-50"
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
                              ? "Alô Transmitido com Sucesso!"
                              : sendingShoutout
                                ? "Masterizando & Transmitindo..."
                                : "🔴 Transmitir Alô no Ar com Áudio & Nome"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 4: SELEÇÃO DE ESTAÇÃO */}
              {activeTab === "estacao" && (
                <div className="max-w-2xl mx-auto space-y-4">
                  <div className="flex items-center justify-between bg-white rounded-xl border border-stone-200 p-4 shadow-xs">
                    <div>
                      <h3 className="font-bold text-stone-900 text-sm">
                        Estação da Empresa (Configuração do Painel)
                      </h3>
                      <p className="text-xs text-stone-500">
                        A rádio escolhida abaixo tocará tanto para o gestor quanto para todos os candidatos
                      </p>
                    </div>
                    {savedStation && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 animate-in fade-in">
                        <Check className="size-3.5" /> Salva no servidor!
                      </span>
                    )}
                  </div>

                  {/* Lista de Estações Curadas */}
                  <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white shadow-xs">
                    {stations.map((st) => {
                      const isCurrent = current.url === st.url;
                      return (
                        <div
                          key={st.id}
                          className={`flex items-center justify-between p-3.5 transition ${
                            isCurrent ? "bg-amber-500/10" : "hover:bg-stone-50"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                                isCurrent
                                  ? "bg-amber-500 text-stone-950 font-bold"
                                  : "bg-stone-100 text-stone-600"
                              }`}
                            >
                              <Radio className="size-4" />
                            </span>
                            <div>
                              <p className="font-bold text-stone-900 text-xs">
                                {st.name}
                              </p>
                              <p className="text-[11px] text-stone-500">
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
                                ? "bg-stone-900 text-white"
                                : "bg-stone-100 text-stone-700 hover:bg-stone-200"
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
        </div>
      )}

      {/* MODAL PARA CRIAÇÃO DE NOVA VINHETA COM IA MICHELIN */}
      {showNewSpotModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Criar Vinheta com IA"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNewSpotModal(false);
          }}
        >
          <div className="flex flex-col w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 bg-stone-900 text-white">
              <div className="flex items-center gap-2.5">
                <Sparkles className="size-5 text-amber-400" />
                <h3 className="text-sm font-bold">Criar Nova Vinheta com IA (Nível Michelin)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewSpotModal(false)}
                className="text-stone-400 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-800 block mb-1">
                  Título da Vinheta *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Tarhget - Conectando os Melhores Talentos"
                  value={newSpotTitle}
                  onChange={(e) => setNewSpotTitle(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 p-2 text-xs text-stone-900 outline-none focus:border-amber-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-800 block mb-1">
                  Texto da Locução *
                </label>
                <p className="text-[11px] text-stone-500 mb-2">
                  Dica: A pronúncia correta de &quot;Tarhget&quot; é ajustada foneticamente de forma automática para som de rádio FM.
                </p>
                <textarea
                  rows={4}
                  placeholder="Digite a fala do locutor. Ex: Você está sintonizado na rádio Tarhget! O futuro da sua carreira profissional começa agora."
                  value={newSpotScript}
                  onChange={(e) => setNewSpotScript(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 p-2.5 text-xs text-stone-900 outline-none focus:border-amber-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-stone-800 block mb-1">
                    Voz do Locutor
                  </label>
                  <select
                    value={newSpotVoice}
                    onChange={(e) => setNewSpotVoice(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 bg-white p-2 text-xs text-stone-900 outline-none focus:border-amber-600"
                  >
                    <option value="pt-BR-AntonioNeural">🎙️ Antônio FM (Marcante & Rádio)</option>
                    <option value="pt-BR-ThalitaNeural">🎙️ Thalita Executiva (Calorosa)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-800 block mb-1">
                    Efeito & Masterização
                  </label>
                  <select
                    value={newSpotSfx}
                    onChange={(e) => setNewSpotSfx(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 bg-white p-2 text-xs text-stone-900 outline-none focus:border-amber-600"
                  >
                    <option value="raio-trovao">⚡ Raio, Trovão Sônico & Drop 808</option>
                    <option value="laser-sweep">🚀 Laser Sweep Futurista</option>
                    <option value="acolhimento-suave">✨ Acolhimento Suave Studio</option>
                    <option value="comercial-limpo">📻 Locução Comercial FM Limpa</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 bg-stone-50 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setShowNewSpotModal(false)}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-200 transition"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleGenerateNewSpot}
                disabled={generatingSpot || !newSpotScript.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-amber-700 disabled:opacity-50"
              >
                {generatingSpot ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                <span>{generatingSpot ? "Masterizando Áudio IA..." : "Gerar e Adicionar à Rádio"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
