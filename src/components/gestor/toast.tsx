"use client";

import { useEffect } from "react";

/** Q1 · Confirmação flutuante (padrão do frame E12 do Figma) com suporte a ação de desfazer. */
export function Toast({
  message,
  onDone,
  tone = "success",
  action,
  durationMs,
}: {
  message: string;
  onDone: () => void;
  tone?: "success" | "error";
  action?: { label: string; onClick: () => void };
  durationMs?: number;
}) {
  useEffect(() => {
    const time = durationMs ?? (action ? 6500 : 4000);
    const timer = setTimeout(onDone, time);
    return () => clearTimeout(timer);
  }, [onDone, action, durationMs]);

  return (
    <div
      role="status"
      className="fixed right-6 bottom-6 z-50 flex max-w-[420px] items-center gap-3 rounded-2xl border border-[#e4e4e7] bg-white px-4 py-3 shadow-[0px_8px_32px_rgba(0,0,0,0.16)] animate-in fade-in slide-in-from-bottom-3 duration-200"
    >
      <span
        className={
          "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white " +
          (tone === "success" ? "bg-[#1f7a4d]" : "bg-[#c23b3b]")
        }
        aria-hidden
      >
        {tone === "success" ? "✓" : "!"}
      </span>
      <p className="min-w-0 flex-1 text-[13px] leading-5 text-[#0a0a0a]">{message}</p>
      {action && (
        <button
          type="button"
          onClick={() => {
            action.onClick();
            onDone();
          }}
          className="rounded-lg bg-[#0a0a0a] px-2.5 py-1 text-xs font-bold text-white shadow-xs hover:bg-[#27272a] transition-colors"
        >
          {action.label}
        </button>
      )}
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
