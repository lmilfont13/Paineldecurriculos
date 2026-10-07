"use client";

import { useState, useTransition } from "react";
import { BrainCircuit, Loader2, Play } from "lucide-react";

import { runDemoTriage } from "@/server/controllers/demo.controller";

export function DemoTriageButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function run() {
    setResult(null);
    startTransition(async () => {
      try {
        const response = await runDemoTriage();
        setResult(`Demonstração iniciada para ${response.candidateName}. Use “Atualizar” no monitor para acompanhar e abra a candidatura quando concluir.`);
      } catch (error) {
        setResult(error instanceof Error ? error.message : "Não foi possível executar a demonstração.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-[#e4e4e7] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#f5f3ff] text-[#6d28d9] ring-1 ring-[#e9d5ff]">
            <BrainCircuit className="size-4.5" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">
              Laboratório
            </p>
            <h2 className="mt-1 text-sm font-semibold text-[#18181b]">
              Ver o Agente de Triagem trabalhando
            </h2>
            <p className="mt-1 max-w-[650px] text-[11px] leading-5 text-[#71717a]">
              Cria uma candidatura fictícia com currículo PDF real, executa a mesma análise de IA e registra a execução no monitor. Não envia e-mail para ninguém.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#171413] px-4 py-2.5 text-[11px] font-semibold text-white shadow-sm hover:bg-[#292321] disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
          {pending ? "Agente trabalhando..." : "Executar demonstração"}
        </button>
      </div>

      {result && (
        <div className="mt-4 rounded-xl bg-[#fafaf9] px-3.5 py-3 text-[11px] text-[#57534e] ring-1 ring-[#eceae8]">
          {result}
        </div>
      )}
    </div>
  );
}
