"use client";

import { useState } from "react";

/** Caixa "link público + Copiar" da E2. */
export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className={
        "flex h-10 items-center overflow-hidden rounded-[10px] border bg-white transition-colors " +
        (copied ? "border-[#1f7a4d]" : "border-[#e4e4e7]")
      }
    >
      <span className="truncate px-3 text-xs text-[#71717a]">
        {url.replace(/^https?:\/\//, "")}
      </span>
      <button
        type="button"
        onClick={copy}
        className={
          "flex h-full shrink-0 items-center gap-1.5 border-l px-4 text-xs font-medium transition-colors " +
          (copied
            ? "border-[#1f7a4d] bg-[#e4f6ec] text-[#1f7a4d]"
            : "border-[#e4e4e7] text-[#0a0a0a] hover:bg-[#fafaf9] active:bg-[#f4f4f5]")
        }
      >
        {copied ? "✓ Copiado" : "Copiar"}
      </button>
    </div>
  );
}
