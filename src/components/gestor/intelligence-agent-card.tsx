"use client";

import { useState, useTransition } from "react";
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
    <section className="mt-8 overflow-hidden rounded-2xl border border-[#dedbd7] bg-[#171413] text-white">
      <div className="grid lg:grid-cols-[1fr_0.8fr]">
        <div className="p-6 lg:p-7">
          <div className="flex items-start justify-between gap-4">
            <span className="flex size-11 items-center justify-center rounded-xl bg-white/10">
              <BrainCircuit className="size-5" />
            </span>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-semibold tracking-[0.12em] text-white/70">
              AGENTE DE INTELIGÊNCIA
            </span>
          </div>

          <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
            Leitura executiva
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em]">
            Entenda onde o seu processo está ganhando ou perdendo força.
          </h2>
          <p className="mt-3 max-w-[600px] text-[12px] leading-5 text-white/55">
            O agente cruza volume, score de aderência e etapas do funil para encontrar gargalos e sugerir uma próxima ação. Ele não decide por você.
          </p>

          <button
            type="button"
            onClick={runAgent}
            disabled={working}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[11px] font-semibold text-[#171413] shadow-sm transition hover:bg-white/90 disabled:cursor-wait disabled:opacity-70"
          >
            {working ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            {working ? "Analisando processo..." : "Gerar leitura agora"}
          </button>
        </div>

        <div className="border-t border-white/10 bg-white/[0.035] p-6 lg:border-l lg:border-t-0 lg:p-7">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
            Última leitura
          </p>

          {latestSummary ? (
            <div className="mt-4 whitespace-pre-line text-[11px] leading-5 text-white/75">
              {latestSummary}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-5 text-[11px] leading-5 text-white/40">
              Nenhuma leitura gerada ainda. Execute o agente para obter o primeiro diagnóstico do processo.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
