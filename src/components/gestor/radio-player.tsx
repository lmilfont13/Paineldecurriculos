"use client";

import {
  Loader2,
  Pause,
  Play,
  Radio,
  Search,
  Settings2,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { saveRadioStationAction } from "@/server/controllers/settings.controller";
import {
  CURATED_STATIONS,
  TARGET_RADIO_SPOTS,
  type RadioSpot,
  type RadioStation,
} from "@/server/models/radio.model";

export type { RadioStation, RadioSpot };
export { CURATED_STATIONS, TARGET_RADIO_SPOTS };

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
}: {
  initialStation?: RadioStation | null;
  canManage?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const defaultStation = initialStation ?? CURATED_STATIONS[0];
  const [stations, setStations] = useState<RadioStation[]>(() =>
    initialStation && !CURATED_STATIONS.some((s) => s.url === initialStation.url)
      ? [initialStation, ...CURATED_STATIONS]
      : CURATED_STATIONS,
  );
  const [current, setCurrent] = useState<RadioStation>(defaultStation);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);

  const [previewingSpotId, setPreviewingSpotId] = useState<string | null>(null);
  const spotAudioRef = useRef<HTMLAudioElement | null>(null);

  const [configOpen, setConfigOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchResults, setSearchResults] = useState<RadioStation[]>([]);

  // Sincroniza quando o admin atualiza a estação no servidor
  useEffect(() => {
    if (initialStation && initialStation.url !== current.url) {
      setCurrent(initialStation);
      setStations((prev) =>
        prev.some((s) => s.url === initialStation.url)
          ? prev
          : [initialStation, ...prev],
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStation?.url]);

  // Restaura apenas o volume local de quem está ouvindo
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
      // Ignora erro de localStorage
    }
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume;
    }
    if (spotAudioRef.current) {
      spotAudioRef.current.volume = muted ? 0 : volume;
    }
  }, [volume, muted]);

  const toggleSpotPreview = (spot: RadioSpot) => {
    const audio = spotAudioRef.current;
    if (!audio) return;
    if (previewingSpotId === spot.id) {
      audio.pause();
      setPreviewingSpotId(null);
      return;
    }
    audio.src = spot.audioUrl;
    audio.volume = muted ? 0 : volume;
    audio
      .play()
      .then(() => setPreviewingSpotId(spot.id))
      .catch(() => setPreviewingSpotId(null));
  };

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
      if (audio.src !== current.url) {
        audio.src = current.url;
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

  const selectStationAsAdmin = async (station: RadioStation) => {
    if (!canManage) return;
    setCurrent(station);
    setError(null);
    setStations((prev) =>
      prev.some((s) => s.url === station.url) ? prev : [station, ...prev],
    );

    // Salva no servidor para que todos os usuários escutem esta estação
    setSaving(true);
    saveRadioStationAction(station)
      .catch(() => {})
      .finally(() => setSaving(false));

    const audio = audioRef.current;
    if (!audio) return;

    try {
      setLoading(true);
      audio.src = station.url;
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
      // Ignora erro de localStorage
    }
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

  return (
    <div className="mx-3 mb-2 rounded-xl border border-[#e7e5e4] bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
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
      <audio
        ref={spotAudioRef}
        preload="none"
        onEnded={() => setPreviewingSpotId(null)}
        onError={() => setPreviewingSpotId(null)}
      />

      {/* Player para todos: Play/Pause + Nome da Rádio + Volume */}
      <div className="flex items-center gap-2">
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

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Radio
              className="size-3 shrink-0 text-[#71717a]"
              style={playing ? { color: "var(--brand-primary, #1c1917)" } : undefined}
            />
            <span className="truncate text-[11px] font-semibold text-[#0a0a0a]">
              {current.name}
            </span>
          </div>
          <p className="truncate text-[10px] text-[#71717a]">
            {saving
              ? "Salvando rádio p/ equipe..."
              : playing
                ? `Tocando • ${current.genre}`
                : current.genre}
          </p>
        </div>

        {/* Controle de volume compacto */}
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
          className="h-1 w-11 cursor-pointer accent-[#1c1917]"
        />

        {/* Botão de configuração: exclusivo para o Admin */}
        {canManage && (
          <button
            type="button"
            onClick={() => setConfigOpen((prev) => !prev)}
            title="Definir estação da rádio (exclusivo Admin)"
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
          >
            {configOpen ? (
              <X className="size-3.5" />
            ) : (
              <Settings2 className="size-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Painel exclusivo do Admin para trocar a estação de todos */}
      {canManage && configOpen && (
        <div className="mt-2 space-y-2 border-t border-[#e7e5e4] pt-2">
          <div>
            <p className="mb-1 text-[10px] font-medium text-[#71717a]">
              Estação da equipe (Admin)
            </p>
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
                  {s.name}
                </option>
              ))}
            </select>
          </div>

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

          {/* Spots Institucionais da Target com IA */}
          <div className="border-t border-[#e7e5e4] pt-2">
            <div className="mb-1.5 flex items-center gap-1 text-[10px] font-bold text-violet-900">
              <Sparkles className="size-3 text-violet-600" />
              <span>Spots Target IA (Vinhetas)</span>
            </div>
            <div className="space-y-1">
              {TARGET_RADIO_SPOTS.map((spot) => {
                const isPreviewing = previewingSpotId === spot.id;
                return (
                  <button
                    key={spot.id}
                    type="button"
                    onClick={() => toggleSpotPreview(spot)}
                    className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-[10px] transition ${
                      isPreviewing
                        ? "bg-violet-100 text-violet-950 font-bold"
                        : "bg-[#fafaf9] text-[#27272a] hover:bg-violet-50 hover:text-violet-900"
                    }`}
                  >
                    <span className="truncate">
                      {spot.title} · <span className="text-[#71717a] font-normal">{spot.subtitle}</span>
                    </span>
                    <span className="ml-1.5 shrink-0 text-[9px] font-semibold text-violet-700">
                      {isPreviewing ? "Parar" : "Ouvir"}
                    </span>
                  </button>
                );
              })}
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
