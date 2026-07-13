"use client";

import { useEffect } from "react";

/** Q1 · Confirmação flutuante (padrão do frame E12 do Figma). */
export function Toast({
  message,
  onDone,
  tone = "success",
}: {
  message: string;
  onDone: () => void;
  tone?: "success" | "error";
}) {
  useEffect(() => {
    const timer = setTimeout(onDone, 4000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      role="status"
      className="fixed right-8 top-8 z-50 flex max-w-[380px] items-start gap-3 rounded-xl border border-[#e4e4e7] bg-white px-4 py-3 shadow-[0px_8px_24px_rgba(0,0,0,0.12)]"
    >
      <span
        className={
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white " +
          (tone === "success" ? "bg-[#1f7a4d]" : "bg-[#c23b3b]")
        }
        aria-hidden
      >
        {tone === "success" ? "✓" : "!"}
      </span>
      <p className="text-[13px] leading-5 text-[#0a0a0a]">{message}</p>
      <button
        type="button"
        onClick={onDone}
        aria-label="Fechar"
        className="ml-1 text-[13px] text-[#a1a1aa] hover:text-[#0a0a0a]"
      >
        ✕
      </button>
    </div>
  );
}
