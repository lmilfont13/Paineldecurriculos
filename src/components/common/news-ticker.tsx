"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Newspaper,
  Pause,
  Play,
  Radio,
  Repeat,
  Sparkles,
} from "lucide-react";
import type { NewsTickerItem, NewsTickerCategory } from "@/server/models/news-ticker.model";
import { DEFAULT_RETAIL_NEWS } from "@/server/models/news-ticker.model";

const CATEGORY_COLORS: Record<NewsTickerCategory, { bg: string; text: string; border: string }> = {
  VAREJO: {
    bg: "bg-amber-500/15",
    text: "text-amber-800",
    border: "border-amber-400/40",
  },
  ECONOMIA: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-800",
    border: "border-emerald-400/40",
  },
  MERCADO: {
    bg: "bg-blue-500/15",
    text: "text-blue-800",
    border: "border-blue-400/40",
  },
  EMPREGOS: {
    bg: "bg-purple-500/15",
    text: "text-purple-800",
    border: "border-purple-400/40",
  },
};

const ROTATION_INTERVAL_MS = 6000; // 6 segundos por notícia alternada

export function NewsTicker({
  variant = "bar",
  initialNews,
  defaultDisplay = "alternating",
}: {
  variant?: "bar" | "compact" | "card";
  initialNews?: NewsTickerItem[];
  defaultDisplay?: "alternating" | "ticker";
}) {
  const [news, setNews] = useState<NewsTickerItem[]>(initialNews || DEFAULT_RETAIL_NEWS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [displayMode, setDisplayMode] = useState<"alternating" | "ticker">(defaultDisplay);
  const [isTransitioning, setIsTransitioning] = useState(false);

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

  // Rotação e alternância contínua automática
  useEffect(() => {
    if (isPaused || displayMode !== "alternating" || total <= 1) return;
    const timer = setInterval(() => {
      nextNews();
    }, ROTATION_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isPaused, displayMode, total, nextNews]);

  if (!news || news.length === 0) return null;

  const currentItem = news[currentIndex] || news[0];
  const theme = CATEGORY_COLORS[currentItem.category] || CATEGORY_COLORS.VAREJO;
  const tickerItems = [...news, ...news];

  // 1. Variante compacta (usada no player do candidato e DJ)
  if (variant === "compact") {
    return (
      <div
        className="group relative flex flex-col justify-center overflow-hidden rounded-xl border border-[#e4e4e7] bg-[#fafaf9] p-2 text-xs shadow-2xs transition-all"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[#e4e4e7]/70 pb-1 mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="flex size-2 rounded-full bg-red-600 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-wider text-[#0a0a0a] flex items-center gap-1">
              <Radio className="size-3 text-red-600" />
              Giro do Varejo
            </span>
          </div>

          <div className="flex items-center gap-1 text-[10px] text-[#71717a]">
            <span className="font-semibold text-[#0a0a0a]">
              {currentIndex + 1}
            </span>
            <span className="text-[#a1a1aa]">/ {total}</span>

            <button
              type="button"
              onClick={prevNews}
              title="Notícia anterior"
              className="p-0.5 rounded hover:bg-white text-[#71717a] hover:text-[#0a0a0a]"
            >
              <ChevronLeft className="size-3" />
            </button>
            <button
              type="button"
              onClick={nextNews}
              title="Próxima notícia"
              className="p-0.5 rounded hover:bg-white text-[#71717a] hover:text-[#0a0a0a]"
            >
              <ChevronRight className="size-3" />
            </button>
            <button
              type="button"
              onClick={() => setIsPaused((p) => !p)}
              title={isPaused ? "Retomar alternância" : "Pausar leitura"}
              className="p-0.5 rounded hover:bg-white text-[#71717a] hover:text-[#0a0a0a]"
            >
              {isPaused ? <Play className="size-2.5 fill-current" /> : <Pause className="size-2.5 fill-current" />}
            </button>
          </div>
        </div>

        {displayMode === "alternating" ? (
          <div
            className={`min-h-[42px] transition-all duration-200 ${
              isTransitioning ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
            }`}
          >
            <div className="flex items-start gap-2">
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase border ${theme.bg} ${theme.text} ${theme.border}`}
              >
                {currentItem.category}
              </span>
              <p className="line-clamp-2 text-[11px] font-semibold text-[#18181b] leading-tight">
                {currentItem.title}
              </p>
            </div>
            <div className="mt-1 flex items-center justify-between text-[9px] text-[#a1a1aa]">
              <span>Fonte: {currentItem.source}</span>
              <span>{currentItem.timeAgo}</span>
            </div>
          </div>
        ) : (
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
                  <div key={`${item.id}-${idx}`} className="inline-flex items-center gap-2 text-[11px]">
                    <span
                      className={`rounded px-1.5 py-0.2 text-[9px] font-extrabold border ${itemTheme.bg} ${itemTheme.text} ${itemTheme.border}`}
                    >
                      {item.category}
                    </span>
                    <span className="font-medium text-[#27272a]">{item.title}</span>
                    <span className="text-[9px] text-[#a1a1aa]">({item.source})</span>
                    <span className="text-[#d4d4d8] ml-2">•</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Linha de progresso visual de alternância */}
        {displayMode === "alternating" && !isPaused && (
          <div className="absolute bottom-0 left-0 h-[2px] w-full bg-[#e4e4e7] overflow-hidden">
            <div
              key={currentIndex}
              className="h-full bg-red-500 animate-[progress_6s_linear_infinite]"
              style={{ width: "100%" }}
            />
          </div>
        )}
      </div>
    );
  }

  // 2. Variante Barra Superior (topo do layout do candidato)
  return (
    <div
      className="group relative flex items-center justify-between border-y border-[#e4e4e7] bg-[#fafaf9] px-3.5 py-1.5 text-xs text-[#27272a] shadow-xs"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Selo ao vivo */}
      <div className="flex shrink-0 items-center gap-1.5 pr-3 border-r border-[#e4e4e7] mr-3">
        <span className="flex size-2 rounded-full bg-red-600 animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-wider text-[#0a0a0a] flex items-center gap-1.5">
          <Newspaper className="size-3.5 text-red-600" />
          NOTÍCIAS & MERCADO
        </span>
      </div>

      {/* Área da Notícia */}
      <div className="relative min-w-0 flex-1 overflow-hidden">
        {displayMode === "alternating" ? (
          <div
            className={`flex items-center gap-2.5 transition-all duration-200 ${
              isTransitioning ? "opacity-0 -translate-y-1" : "opacity-100 translate-y-0"
            }`}
          >
            <span
              className={`shrink-0 rounded-md px-2 py-0.5 text-[9px] font-black uppercase border ${theme.bg} ${theme.text} ${theme.border}`}
            >
              {currentItem.category}
            </span>
            <span className="truncate text-[12px] font-bold text-[#0a0a0a] cursor-default">
              {currentItem.title}
            </span>
            <span className="shrink-0 text-[11px] text-[#71717a] hidden md:inline">
              — {currentItem.source} <span className="text-[#a1a1aa]">({currentItem.timeAgo})</span>
            </span>
          </div>
        ) : (
          <div className="relative overflow-hidden whitespace-nowrap">
            <div
              className={`inline-flex items-center gap-8 animate-ticker ${
                isPaused ? "[animation-play-state:paused]" : ""
              }`}
              style={{ animationDuration: `${Math.max(45, news.length * 10)}s` }}
            >
              {tickerItems.map((item, idx) => {
                const itemTheme = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.VAREJO;
                return (
                  <div key={`${item.id}-${idx}`} className="inline-flex items-center gap-2 text-[12px]">
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase border ${itemTheme.bg} ${itemTheme.text} ${itemTheme.border}`}
                    >
                      {item.category}
                    </span>
                    <span className="font-semibold text-[#0a0a0a]">{item.title}</span>
                    <span className="text-[10px] text-[#71717a]">
                      — {item.source} ({item.timeAgo})
                    </span>
                    <span className="text-[#d4d4d8] ml-3 font-bold">•</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Controles de rotação e navegação */}
      <div className="ml-3 flex shrink-0 items-center gap-1.5 border-l border-[#e4e4e7] pl-3 text-[11px] text-[#71717a]">
        {/* Contador */}
        <span className="text-[10px] font-semibold text-[#71717a] tabular-nums hidden sm:inline">
          <strong className="text-[#0a0a0a]">{currentIndex + 1}</strong> de {total}
        </span>

        {/* Botões anterior / próximo */}
        <div className="flex items-center rounded-lg border border-[#e4e4e7] bg-white p-0.5 shadow-2xs">
          <button
            type="button"
            onClick={prevNews}
            title="Notícia anterior"
            className="rounded p-1 hover:bg-[#f4f4f5] text-[#71717a] hover:text-[#0a0a0a] transition"
          >
            <ChevronLeft className="size-3" />
          </button>
          <button
            type="button"
            onClick={nextNews}
            title="Próxima notícia"
            className="rounded p-1 hover:bg-[#f4f4f5] text-[#71717a] hover:text-[#0a0a0a] transition"
          >
            <ChevronRight className="size-3" />
          </button>
        </div>

        {/* Play / Pausar */}
        <button
          type="button"
          onClick={() => setIsPaused((p) => !p)}
          title={isPaused ? "Retomar alternância automática" : "Pausar para ler com calma"}
          className="flex items-center gap-1 rounded-lg border border-[#e4e4e7] bg-white px-2 py-1 text-[11px] font-semibold text-[#0a0a0a] hover:bg-[#f4f4f5] transition shadow-2xs"
        >
          {isPaused ? <Play className="size-2.5 fill-current" /> : <Pause className="size-2.5 fill-current" />}
          <span className="hidden md:inline">{isPaused ? "Play" : "Pausar"}</span>
        </button>

        {/* Alternador de Modo: Alternando vs Letreiro Contínuo */}
        <button
          type="button"
          onClick={() => setDisplayMode((m) => (m === "alternating" ? "ticker" : "alternating"))}
          title={
            displayMode === "alternating"
              ? "Mudar para letreiro contínuo em fita"
              : "Mudar para notícias alternadas em destaque"
          }
          className="flex items-center gap-1 rounded-lg border border-[#e4e4e7] bg-white px-2 py-1 text-[10px] font-medium text-[#71717a] hover:text-[#0a0a0a] hover:bg-[#f4f4f5] transition shadow-2xs hidden lg:flex"
        >
          <Repeat className="size-3 text-[#0a0a0a]" />
          <span>{displayMode === "alternating" ? "Alternando" : "Contínuo"}</span>
        </button>
      </div>

      {/* Barra sutil de contagem regressiva para a próxima troca */}
      {displayMode === "alternating" && !isPaused && (
        <div className="absolute bottom-0 left-0 h-[2px] w-full bg-[#e4e4e7] overflow-hidden">
          <div
            key={currentIndex}
            className="h-full bg-red-600 animate-[progress_6s_linear_infinite]"
            style={{ width: "100%" }}
          />
        </div>
      )}
    </div>
  );
}
