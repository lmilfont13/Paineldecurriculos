"use client";

import { useTransition } from "react";

import { reanalyzeAction } from "@/server/controllers/application.controller";

/** Recuperação de erro (H9): reenfileira a análise de IA que falhou. */
export function ReanalyzeButton({
  applicationId,
  hasImpediment = false,
}: {
  applicationId: string;
  hasImpediment?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  if (hasImpediment) {
    return (
      <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-black px-3.5 py-1.5 text-xs text-white shadow-sm font-semibold">
        <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
        <span>Tarja Preta: Análise de IA desativada por impedimento</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => reanalyzeAction(applicationId))}
      className="mt-3 h-9 rounded-2xl border border-[#0a0a0a]/85 bg-white px-4 text-xs font-medium text-[#0a0a0a] hover:bg-[#fafaf9] disabled:opacity-60"
    >
      {pending ? "Reenviando…" : "Analisar de novo"}
    </button>
  );
}
