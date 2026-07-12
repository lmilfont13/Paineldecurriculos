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
    <div className="flex h-10 items-center overflow-hidden rounded-[10px] border border-[#e4e4e7] bg-white">
      <span className="truncate px-3 text-xs text-[#71717a]">
        {url.replace(/^https?:\/\//, "")}
      </span>
      <button
        type="button"
        onClick={copy}
        className="h-full shrink-0 border-l border-[#e4e4e7] px-4 text-xs font-medium text-[#0a0a0a] hover:bg-[#fafaf9]"
      >
        {copied ? "Copiado!" : "Copiar"}
      </button>
    </div>
  );
}
