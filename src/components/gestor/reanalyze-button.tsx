"use client";

import { useTransition } from "react";

import { reanalyzeAction } from "@/server/controllers/application.controller";

/** Recuperação de erro (H9): reenfileira a análise de IA que falhou. */
export function ReanalyzeButton({ applicationId }: { applicationId: string }) {
  const [pending, startTransition] = useTransition();

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
