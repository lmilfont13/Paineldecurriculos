"use client";

import { useTransition } from "react";
import { BrainCircuit, Loader2, Sparkles } from "lucide-react";

import { requestCompanyIntelligence } from "@/server/controllers/intelligence.controller";

export function IntelligenceAgentCard({
  latestSummary,
  latestStatus,
}: {
  latestSummary: string | null;
  latestStatus: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | null;
}) {
  const [pending, startTransition] = useTransition();

  function runAgent() {
    startTransition(async () => {
      await requestCompanyIntelligence();
    });
  }

  const working = pending || latestStatus === "QUEUED" || latestStatus === "RUNNING";

  return (
    <section className="flex flex-col rounded-2xl border border-[#e4e4e7] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#18181b]">Leitura da Inteligência</h2>
          <p className="mt-1 text-[12px] leading-5 text-[#71717a]">
            Cruza volume, notas e etapas do funil para apontar gargalos e
            sugerir a próxima ação.
          </p>
        </div>
        <BrainCircuit aria-hidden className="mt-0.5 size-5 shrink-0 text-[#a1a1aa]" />
      </div>

      <div className="mt-4 flex-1 rounded-xl bg-[#fafaf9] p-4">
        {latestStatus === "FAILED" ? (
          <p className="text-[12px] leading-5 text-[#b91c1c]">
            A última leitura falhou. Gere de novo; se repetir, veja o erro no histórico ao lado.
          </p>
        ) : latestSummary ? (
          <p className="whitespace-pre-line text-[12px] leading-5 text-[#3f3f46]">{latestSummary}</p>
        ) : (
          <p className="text-[12px] leading-5 text-[#a1a1aa]">
            Nenhuma leitura ainda. Gere a primeira para ver o diagnóstico do processo.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={runAgent}
        disabled={working}
        className="mt-4 inline-flex items-center justify-center gap-2 self-start rounded-xl border border-[#18181b] px-4 py-2.5 text-[12px] font-semibold text-[#18181b] hover:bg-[#fafaf9] disabled:cursor-wait disabled:opacity-60"
      >
        {working ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
        {working ? "Gerando leitura..." : "Gerar leitura agora"}
      </button>
    </section>
  );
}
