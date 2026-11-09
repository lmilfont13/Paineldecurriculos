"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Minus,
  Newspaper,
  Pause,
  Play,
  Radio,
  Repeat,
  Sparkles,
  X,
} from "lucide-react";
import type { NewsTickerItem, NewsTickerCategory } from "@/server/models/news-ticker.model";
import { DEFAULT_RETAIL_NEWS } from "@/server/models/news-ticker.model";

const CATEGORY_COLORS: Record<NewsTickerCategory, { bg: string; text: string; border: string }> = {
  BRASIL: {
    bg: "bg-emerald-500/20",
    text: "text-emerald-300",
    border: "border-emerald-400/40",
  },
  MUNDO: {
    bg: "bg-sky-500/20",
    text: "text-sky-300",
    border: "border-sky-400/40",
  },
  ECONOMIA: {
    bg: "bg-teal-500/20",
    text: "text-teal-300",
    border: "border-teal-400/40",
  },
  MERCADO: {
    bg: "bg-indigo-500/20",
    text: "text-indigo-300",
    border: "border-indigo-400/40",
  },
  VAREJO: {
    bg: "bg-amber-500/20",
    text: "text-amber-300",
    border: "border-amber-400/40",
  },
  EMPREGOS: {
    bg: "bg-purple-500/20",
    text: "text-purple-300",
    border: "border-purple-400/40",
  },
  TECNOLOGIA: {
    bg: "bg-cyan-500/20",
    text: "text-cyan-300",
    border: "border-cyan-400/40",
  },
};

const ROTATION_INTERVAL_MS = 6000; // 6 segundos por notícia alternada

export function NewsTicker({
  variant = "bloomberg",
  initialNews,
  defaultDisplay = "ticker",
  position = "top",
  allowMinimize = true,
}: {
  variant?: "bloomberg" | "bar" | "compact" | "card";
  initialNews?: NewsTickerItem[];
  defaultDisplay?: "alternating" | "ticker";
  position?: "top" | "bottom" | "relative";
  allowMinimize?: boolean;
}) {
  const [news, setNews] = useState<NewsTickerItem[]>(initialNews || DEFAULT_RETAIL_NEWS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [displayMode, setDisplayMode] = useState<"alternating" | "ticker">(defaultDisplay);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isMinimized, setIsMinimized] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("triagem:news-ticker:minimized") === "true";
    } catch {
      return false;
    }
  });
  const [currentPosition, setCurrentPosition] = useState<"top" | "bottom" | "relative">(position);

  // Carrega notícias dinâmicas ao vivo da API
  useEffect(() => {
    let mounted = true;
    async function loadNews() {
      try {
        const res = await fetch("/api/news-ticker");
        if (res.ok) {
          const data = await res.json();
          if (mounted && Array.isArray(data.items) && data.items.length > 0) {
            setNews(data.items);
          }
        }
      } catch {
        // Fallback gracioso mantendo catálogo local
      }
    }
    loadNews();
    const interval = setInterval(loadNews, 5 * 60 * 1000); // 5 minutos
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const total = news.length;

  const nextNews = useCallback(() => {
    if (total === 0) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % total);
      setIsTransitioning(false);
    }, 220);
  }, [total]);

  const prevNews = useCallback(() => {
    if (total === 0) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + total) % total);
      setIsTransitioning(false);
    }, 220);
  }, [total]);

  // Rotação e alternância contínua automática (quando em modo alternating)
  useEffect(() => {
    if (isPaused || displayMode !== "alternating" || total <= 1) return;
    const timer = setInterval(() => {
      nextNews();
    }, ROTATION_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isPaused, displayMode, total, nextNews]);

  if (!news || news.length === 0) return null;

  // Estado Minimizada: botão pílula ultra discreto
  if (isMinimized) {
    return (
      <div
        className={`fixed ${
          currentPosition === "bottom" ? "bottom-3 left-3 sm:left-6" : "top-2.5 right-3 sm:right-6"
        } z-30 animate-in fade-in duration-200`}
      >
        <button
          type="button"
          onClick={() => {
            setIsMinimized(false);
            try {
              localStorage.setItem("triagem:news-ticker:minimized", "false");
            } catch {}
          }}
          className="group inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/90 px-2.5 py-1 text-[11px] font-bold text-slate-200 shadow-md backdrop-blur-md hover:bg-slate-800 hover:text-white transition active:scale-95"
          title="Expandir letreiro de notícias estilo Bloomberg"
        >
          <span className="flex size-1.5 rounded-full bg-red-500 animate-pulse" />
          <Radio className="size-3 text-red-500" />
          <span>Brasil & Mundo</span>
          <span className="rounded bg-slate-800 px-1 py-0.2 text-[9px] text-slate-400">
            {news.length}
          </span>
          <ChevronDown className="size-3 text-slate-400 group-hover:text-white transition" />
        </button>
      </div>
    );
  }

  const currentItem = news[currentIndex] || news[0];
  const theme = CATEGORY_COLORS[currentItem.category] || CATEGORY_COLORS.VAREJO;
  const tickerItems = [...news, ...news];

  // 1. Variante Compacta (usada dentro de modais de configuração/DJ)
  if (variant === "compact") {
    return (
      <div
        className="group relative flex flex-col justify-center overflow-hidden rounded-xl border border-slate-800 bg-[#09090b] p-2 text-xs text-slate-200 shadow-2xs transition-all"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1 mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="flex size-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="rounded bg-amber-400 px-1 py-0.2 text-[8px] font-black uppercase tracking-wider text-slate-950">
              BLOOMBERG
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-200 flex items-center gap-1">
              Giro do Varejo
            </span>
          </div>

          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <button
              type="button"
              onClick={() => setIsPaused((p) => !p)}
              title={isPaused ? "Retomar" : "Pausar"}
              className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              {isPaused ? <Play className="size-2.5 fill-current" /> : <Pause className="size-2.5 fill-current" />}
            </button>
            {allowMinimize && (
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                title="Reduzir notícias"
                className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <Minus className="size-2.5" />
              </button>
            )}
          </div>
        </div>

        <div className="relative overflow-hidden whitespace-nowrap">
          <div
            className={`inline-flex items-center gap-6 animate-ticker ${
              isPaused ? "[animation-play-state:paused]" : ""
            }`}
            style={{ animationDuration: `${Math.max(35, news.length * 8)}s` }}
          >
            {tickerItems.map((item, idx) => {
              const itemTheme = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.VAREJO;
              return (
                <div key={`${item.id}-${idx}`} className="inline-flex items-center gap-1.5 text-[11px]">
                  <span
                    className={`rounded px-1.5 py-0.2 text-[8px] font-black uppercase border ${itemTheme.bg} ${itemTheme.text} ${itemTheme.border}`}
                  >
                    {item.category}
                  </span>
                  <span className="font-semibold text-slate-100">{item.title}</span>
                  <span className="text-[9px] text-slate-400">({item.source})</span>
                  <span className="text-amber-400 ml-2 font-bold text-[9px]">▲</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 2. Variante Bloomberg TV (Letreiro Contínuo Fino e Elegante na Parte Superior ou Inferior)
  return (
    <aside
      aria-label="Letreiro de Notícias Estilo Bloomberg"
      className={`${
        currentPosition === "top"
          ? "sticky top-0 z-30"
          : currentPosition === "bottom"
          ? "fixed bottom-0 inset-x-0 z-30"
          : "relative"
      } flex h-7 sm:h-8 w-full items-center justify-between border-y border-slate-800 bg-[#09090b] px-2 sm:px-3 text-xs text-slate-200 shadow-sm backdrop-blur-md select-none`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* 1. Selo Bloomberg / Canal de Notícias */}
      <div className="flex shrink-0 items-center gap-1.5 pr-2 sm:pr-3 border-r border-slate-800 mr-2 sm:mr-3">
        <span className="flex size-2 rounded-full bg-red-500 animate-pulse shrink-0" />
        <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-950 shrink-0">
          BLOOMBERG
        </span>
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-200 hidden md:inline-flex items-center gap-1">
          Brasil & Mundo
        </span>
      </div>

      {/* 2. Área do Letreiro Contínuo (Ticker Horizontal Marquee) */}
      <div className="relative min-w-0 flex-1 overflow-hidden">
        {displayMode === "ticker" ? (
          <div className="relative overflow-hidden whitespace-nowrap">
            <div
              className={`inline-flex items-center gap-8 animate-ticker ${
                isPaused ? "[animation-play-state:paused]" : ""
              }`}
              style={{ animationDuration: `${Math.max(40, news.length * 8)}s` }}
            >
              {tickerItems.map((item, idx) => {
                const itemTheme = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.BRASIL;
                return (
                  <div key={`${item.id}-${idx}`} className="inline-flex items-center gap-2 text-[11px] whitespace-nowrap">
                    <span
                      className={`rounded px-1.5 py-0.2 text-[9px] font-black uppercase border ${itemTheme.bg} ${itemTheme.text} ${itemTheme.border}`}
                    >
                      {item.category}
                    </span>
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-slate-100 hover:text-amber-300 hover:underline transition"
                        title={`Ler notícia completa na fonte (${item.source})`}
                      >
                        {item.title}
                      </a>
                    ) : (
                      <span className="font-semibold text-slate-100">{item.title}</span>
                    )}
                    <span className="text-[10px] text-slate-400">({item.source})</span>
                    <span className="text-amber-400 ml-2 font-bold text-[10px]">▲</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div
            className={`flex items-center gap-2.5 transition-all duration-200 ${
              isTransitioning ? "opacity-0 -translate-y-1" : "opacity-100 translate-y-0"
            }`}
          >
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black uppercase border ${theme.bg} ${theme.text} ${theme.border}`}
            >
              {currentItem.category}
            </span>
            {currentItem.url ? (
              <a
                href={currentItem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-[11px] font-semibold text-slate-100 hover:text-amber-300 hover:underline transition"
                title={`Ler notícia completa na fonte (${currentItem.source})`}
              >
                {currentItem.title}
              </a>
            ) : (
              <span className="truncate text-[11px] font-semibold text-slate-100">
                {currentItem.title}
              </span>
            )}
            <span className="shrink-0 text-[10px] text-slate-400 hidden lg:inline">
              — {currentItem.source} ({currentItem.timeAgo})
            </span>
          </div>
        )}
      </div>

      {/* 3. Controles: Pausar, Alternar Topo/Rodapé, Alternar Modo e Minimizar */}
      <div className="ml-2 sm:ml-3 flex shrink-0 items-center gap-1 sm:gap-1.5 border-l border-slate-800 pl-2 sm:pl-2.5 text-[10px] text-slate-400">
        {/* Play / Pausar */}
        <button
          type="button"
          onClick={() => setIsPaused((p) => !p)}
          title={isPaused ? "Retomar movimento" : "Pausar leitura"}
          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
        >
          {isPaused ? <Play className="size-2.5 fill-current" /> : <Pause className="size-2.5 fill-current" />}
        </button>

        {/* Mudar Posição: Topo / Rodapé */}
        <button
          type="button"
          onClick={() => setCurrentPosition((p) => (p === "top" ? "bottom" : "top"))}
          title={currentPosition === "top" ? "Mover para o rodapé da página" : "Mover para o topo da página"}
          className="hidden sm:inline-flex items-center gap-1 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
        >
          {currentPosition === "top" ? <ArrowDown className="size-2.5" /> : <ArrowUp className="size-2.5" />}
          <span className="text-[9px] uppercase font-bold">{currentPosition === "top" ? "Rodapé" : "Topo"}</span>
        </button>

        {/* Alternador de Modo: Contínuo vs Alternando */}
        <button
          type="button"
          onClick={() => setDisplayMode((m) => (m === "ticker" ? "alternating" : "ticker"))}
          title={displayMode === "ticker" ? "Mudar para modo estático alternando" : "Mudar para letreiro contínuo Bloomberg"}
          className="hidden lg:inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold text-slate-400 hover:bg-slate-800 hover:text-white transition"
        >
          <Repeat className="size-2.5" />
          <span>{displayMode === "ticker" ? "Fita" : "Card"}</span>
        </button>

        {/* Botão Reduzir / Minimizar */}
        {allowMinimize && (
          <button
            type="button"
            onClick={() => {
              setIsMinimized(true);
              try {
                localStorage.setItem("triagem:news-ticker:minimized", "true");
              } catch {}
            }}
            title="Reduzir notícias para botão discreto"
            className="flex items-center gap-1 rounded bg-slate-800/90 px-2 py-0.5 text-[10px] font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition ml-1"
          >
            <Minus className="size-2.5" />
            <span className="hidden sm:inline">Reduzir</span>
          </button>
        )}
      </div>
    </aside>
  );
}
