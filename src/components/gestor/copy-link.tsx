"use client";

import { useState } from "react";

const CHANNELS = [
  { key: "instagram", label: "Instagram" },
  { key: "telegram", label: "Telegram" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "facebook", label: "Facebook" },
] as const;

/** Caixa "link público + Copiar" da E2, com atalhos de link rastreável por canal. */
export function CopyLink({ url }: { url: string }) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function copy(targetUrl: string, key: string) {
    await navigator.clipboard.writeText(targetUrl);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000);
  }

  function withOrigin(channel: string) {
    return `${url}${url.includes("?") ? "&" : "?"}origem=${channel}`;
  }

  const mainCopied = copiedKey === "main";

  return (
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
        <span className="text-[11px] text-[#a1a1aa]">Link por canal:</span>
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
}
