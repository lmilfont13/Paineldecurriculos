"use client";

import { useEffect, useRef, useState } from "react";
import { Share2 } from "lucide-react";

const CHANNELS = [
  { key: "instagram", label: "Instagram" },
  { key: "telegram", label: "Telegram" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "facebook", label: "Facebook" },
] as const;

/** Caixa "link público + Copiar" da E2, com atalhos de link rastreável por canal. */
export function CopyLink({ url, compact = false }: { url: string; compact?: boolean }) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Balão do modo compacto: fecha ao clicar fora ou no Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function copy(targetUrl: string, key: string) {
    await navigator.clipboard.writeText(targetUrl);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000);
  }

  function withOrigin(channel: string) {
    return `${url}${url.includes("?") ? "&" : "?"}origem=${channel}`;
  }

  const mainCopied = copiedKey === "main";

  const content = (
    <div className="flex flex-col gap-2">
      <div
        className={
          "flex h-10 items-center overflow-hidden rounded-[10px] border bg-white transition-colors " +
          (mainCopied ? "border-[#1f7a4d]" : "border-[#e4e4e7]")
        }
      >
        <span className="truncate px-3 text-xs text-[#71717a]">
          {url.replace(/^https?:\/\//, "")}
        </span>
        <button
          type="button"
          onClick={() => copy(url, "main")}
          className={
            "flex h-full shrink-0 items-center gap-1.5 border-l px-4 text-xs font-medium transition-colors " +
            (mainCopied
              ? "border-[#1f7a4d] bg-[#e4f6ec] text-[#1f7a4d]"
              : "border-[#e4e4e7] text-[#0a0a0a] hover:bg-[#fafaf9] active:bg-[#f4f4f5]")
          }
        >
          {mainCopied ? "✓ Copiado" : "Copiar"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-[#71717a]">Link por canal:</span>
        {CHANNELS.map((ch) => {
          const isCopied = copiedKey === ch.key;
          return (
            <button
              key={ch.key}
              type="button"
              onClick={() => copy(withOrigin(ch.key), ch.key)}
              title={`Copiar link com ?origem=${ch.key} para rastrear cliques vindos do ${ch.label}`}
              className={
                "rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors " +
                (isCopied
                  ? "border-[#1f7a4d] bg-[#e4f6ec] text-[#1f7a4d]"
                  : "border-[#e4e4e7] bg-[#fafaf9] text-[#52525b] hover:bg-white hover:text-[#0a0a0a]")
              }
            >
              {isCopied ? `✓ ${ch.label}` : ch.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (!compact) return content;

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-10 items-center gap-2 rounded-2xl border border-[#e4e4e7] bg-white px-4 text-[13px] font-medium text-[#0a0a0a] hover:bg-[#fafaf9]"
      >
        <Share2 className="size-4" aria-hidden />
        Compartilhar vagas
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-30 w-[min(92vw,420px)] rounded-xl border border-[#e4e4e7] bg-white p-3 shadow-lg">
          <p className="mb-2 text-[12px] font-semibold text-[#0a0a0a]">Link da página de vagas</p>
          {content}
        </div>
      )}
    </div>
  );
}
