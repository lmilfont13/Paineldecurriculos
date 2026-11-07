"use client";

import { useEffect, useState } from "react";
import { Newspaper, Pause, Play, Radio, Sparkles } from "lucide-react";
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

export function NewsTicker({
  variant = "bar",
  initialNews,
}: {
  variant?: "bar" | "compact" | "card";
  initialNews?: NewsTickerItem[];
}) {
  const [news, setNews] = useState<NewsTickerItem[]>(initialNews || DEFAULT_RETAIL_NEWS);
  const [isPaused, setIsPaused] = useState(false);

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
        // Fallback silencioso mantendo notícias padrão
      }
    }
    loadNews();
    const interval = setInterval(loadNews, 10 * 60 * 1000); // atualiza a cada 10 min
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!news || news.length === 0) return null;

  // Duplicamos os itens para looping contínuo sem salto visual
  const tickerItems = [...news, ...news];

  if (variant === "compact") {
    return (
      <div
        className="group relative flex items-center overflow-hidden rounded-xl border border-[#e4e4e7] bg-[#fafaf9] px-2.5 py-1.5 text-xs shadow-2xs"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="flex shrink-0 items-center gap-1.5 pr-2.5 border-r border-[#e4e4e7] mr-2">
          <span className="flex size-2 rounded-full bg-red-600 animate-pulse" />
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0a0a0a] flex items-center gap-1">
            <Radio className="size-3 text-red-600" />
            Varejo & Notícias
          </span>
        </div>

        <div className="relative flex-1 overflow-hidden whitespace-nowrap">
          <div
            className={`inline-flex items-center gap-6 animate-ticker ${
              isPaused ? "[animation-play-state:paused]" : ""
            }`}
            style={{
              animationDuration: `${Math.max(35, news.length * 8)}s`,
            }}
          >
            {tickerItems.map((item, idx) => {
              const theme = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.VAREJO;
              return (
                <div key={`${item.id}-${idx}`} className="inline-flex items-center gap-2 text-[11px]">
                  <span
                    className={`rounded-md px-1.5 py-0.2 text-[9px] font-extrabold border ${theme.bg} ${theme.text} ${theme.border}`}
                  >
                    {item.category}
                  </span>
                  <span className="font-medium text-[#27272a] hover:text-[#0a0a0a]">
                    {item.title}
                  </span>
                  <span className="text-[10px] text-[#a1a1aa] font-normal">
                    ({item.source} · {item.timeAgo})
                  </span>
                  <span className="text-[#d4d4d8] ml-2">•</span>
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsPaused((p) => !p)}
          title={isPaused ? "Retomar letreiro" : "Pausar letreiro"}
          className="ml-2 shrink-0 p-1 text-[#a1a1aa] hover:text-[#0a0a0a] rounded transition"
        >
          {isPaused ? <Play className="size-3 fill-current" /> : <Pause className="size-3 fill-current" />}
        </button>
      </div>
    );
  }

  return (
    <div
      className="group relative flex items-center overflow-hidden border-y border-[#e4e4e7] bg-[#fafaf9] px-3 py-1.5 text-xs text-[#27272a]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="flex shrink-0 items-center gap-1.5 pr-3 border-r border-[#e4e4e7] mr-3">
        <span className="flex size-2 rounded-full bg-red-600 animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-wider text-[#0a0a0a] flex items-center gap-1.5">
          <Newspaper className="size-3 text-red-600" />
          MERCADO & VAREJO
        </span>
      </div>

      <div className="relative flex-1 overflow-hidden whitespace-nowrap">
        <div
          className={`inline-flex items-center gap-8 animate-ticker ${
            isPaused ? "[animation-play-state:paused]" : ""
          }`}
          style={{
            animationDuration: `${Math.max(45, news.length * 10)}s`,
          }}
        >
          {tickerItems.map((item, idx) => {
            const theme = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.VAREJO;
            return (
              <div key={`${item.id}-${idx}`} className="inline-flex items-center gap-2 text-[12px]">
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase border ${theme.bg} ${theme.text} ${theme.border}`}
                >
                  {item.category}
                </span>
                <span className="font-semibold text-[#0a0a0a] hover:underline cursor-default">
                  {item.title}
                </span>
                <span className="text-[10px] text-[#71717a] font-normal">
                  — {item.source} <span className="text-[#a1a1aa]">({item.timeAgo})</span>
                </span>
                <span className="text-[#d4d4d8] ml-3 text-xs font-bold">•</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="ml-3 flex shrink-0 items-center gap-1 border-l border-[#e4e4e7] pl-2 text-[10px] text-[#71717a]">
        <button
          type="button"
          onClick={() => setIsPaused((p) => !p)}
          title={isPaused ? "Retomar animação" : "Pausar leitura"}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium hover:bg-white hover:text-[#0a0a0a] transition"
        >
          {isPaused ? <Play className="size-2.5 fill-current" /> : <Pause className="size-2.5 fill-current" />}
          <span className="hidden sm:inline">{isPaused ? "Play" : "Pausar"}</span>
        </button>
      </div>
    </div>
  );
}
