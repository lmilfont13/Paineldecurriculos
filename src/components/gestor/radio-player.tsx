"use client";

import {
  Loader2,
  Pause,
  Play,
  Radio,
  Search,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface RadioStation {
  id: string;
  name: string;
  genre: string;
  url: string;
}

const CURATED_STATIONS: RadioStation[] = [
  {
    id: "hunter-lofi",
    name: "Hunter.FM — Lo-Fi",
    genre: "Foco & Lo-Fi",
    url: "https://live.hunter.fm/lofi_high",
  },
  {
    id: "somafm-groovesalad",
    name: "SomaFM — Groove Salad",
    genre: "Ambient / Chill",
    url: "https://ice2.somafm.com/groovesalad-128-mp3",
  },
  {
    id: "somafm-bossa",
    name: "SomaFM — Bossa Beyond",
    genre: "Bossa Nova & Jazz",
    url: "https://ice2.somafm.com/bossa-128-mp3",
  },
  {
    id: "somafm-deepspace",
    name: "SomaFM — Deep Space One",
    genre: "Foco Profundo",
    url: "https://ice2.somafm.com/deepspaceone-128-mp3",
  },
  {
    id: "hunter-pop",
    name: "Hunter.FM — Pop2K",
    genre: "Pop Hits",
    url: "https://live.hunter.fm/pop2k_high",
  },
];

interface RadioBrowserResult {
  stationuuid: string;
  name: string;
  tags: string;
  countrycode: string;
  url_resolved: string;
}

const STORAGE_KEY_STATION = "triagem:radio:station";
const STORAGE_KEY_VOLUME = "triagem:radio:volume";

export function GestorRadioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [stations, setStations] = useState<RadioStation[]>(CURATED_STATIONS);
  const [current, setCurrent] = useState<RadioStation>(CURATED_STATIONS[0]);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<RadioStation[]>([]);

  // Restaura última estação e volume salvos
  useEffect(() => {
    try {
      const savedVol = localStorage.getItem(STORAGE_KEY_VOLUME);
      if (savedVol !== null) {
        const parsed = parseFloat(savedVol);
        if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          setVolume(parsed);
        }
      }
      const savedStation = localStorage.getItem(STORAGE_KEY_STATION);
      if (savedStation) {
        const parsed = JSON.parse(savedStation) as RadioStation;
        if (parsed?.url && parsed?.name) {
          setCurrent(parsed);
          setStations((prev) =>
            prev.some((s) => s.url === parsed.url) ? prev : [parsed, ...prev],
          );
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

  const selectStation = async (station: RadioStation) => {
    setCurrent(station);
    setError(null);
    setStations((prev) =>
      prev.some((s) => s.url === station.url) ? prev : [station, ...prev],
    );
    try {
      localStorage.setItem(STORAGE_KEY_STATION, JSON.stringify(station));
    } catch {
      // Ignora erro de localStorage
    }

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
            setError("Stream offline. Tente outra rádio.");
          }
        }}
      />

      {/* Cabeçalho + Play/Pause */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Pausar rádio" : "Tocar rádio"}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg transition-opacity hover:opacity-90"
          style={{
            backgroundColor: playing ? "var(--brand-primary)" : "#1c1917",
            color: playing ? "var(--brand-foreground)" : "#ffffff",
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
              style={playing ? { color: "var(--brand-primary)" } : undefined}
            />
            <span className="truncate text-[11px] font-semibold text-[#0a0a0a]">
              {current.name}
            </span>
          </div>
          <p className="truncate text-[10px] text-[#71717a]">
            {playing ? `Tocando • ${current.genre}` : current.genre}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setSearchOpen((prev) => !prev)}
          title="Buscar mais rádios (Radio Browser API)"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
        >
          {searchOpen ? <X className="size-3.5" /> : <Search className="size-3.5" />}
        </button>
      </div>

      {/* Seletor rápido de estação + Volume */}
      <div className="mt-2 flex items-center gap-2">
        <select
          aria-label="Selecionar estação de rádio"
          value={current.url}
          onChange={(e) => {
            const found = stations.find((s) => s.url === e.target.value);
            if (found) selectStation(found);
          }}
          className="h-7 min-w-0 flex-1 truncate rounded-md border border-[#e4e4e7] bg-[#fafaf9] px-1.5 text-[11px] text-[#0a0a0a] outline-none focus:border-[#a1a1aa]"
        >
          {stations.map((s) => (
            <option key={s.url} value={s.url}>
              {s.name}
            </option>
          ))}
        </select>

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
          className="h-1 w-14 cursor-pointer accent-[#1c1917]"
        />
      </div>

      {/* Busca via Radio Browser API */}
      {searchOpen && (
        <div className="mt-2 border-t border-[#e7e5e4] pt-2">
          <form onSubmit={searchRadioBrowser} className="flex gap-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ex: Jovem Pan, Jazz, MPB..."
              className="h-7 min-w-0 flex-1 rounded-md border border-[#e4e4e7] px-2 text-[11px] text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#71717a] focus:outline-none"
            />
            <button
              type="submit"
              disabled={searching}
              className="rounded-md bg-[#1c1917] px-2 text-[11px] font-medium text-white hover:bg-[#292524] disabled:opacity-50"
            >
              {searching ? "..." : "Ir"}
            </button>
          </form>

          {searchResults.length > 0 && (
            <ul className="mt-1.5 max-h-28 space-y-0.5 overflow-y-auto">
              {searchResults.map((station) => (
                <li key={station.id}>
                  <button
                    type="button"
                    onClick={() => {
                      selectStation(station);
                      setSearchOpen(false);
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

      {error && (
        <p className="mt-1.5 text-[10px] font-medium text-red-600">{error}</p>
      )}
    </div>
  );
}

