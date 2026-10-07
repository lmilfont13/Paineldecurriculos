"use client";

import { useState, useTransition } from "react";
import { BrainCircuit, Loader2, Play, Trash2 } from "lucide-react";

import {
  clearDemoTriage,
  runDemoTriage,
} from "@/server/controllers/demo.controller";

export function DemoTriageButton({ compact = false }: { compact?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function run() {
    setResult(null);
    startTransition(async () => {
      try {
        const response = await runDemoTriage();
        setResult(
          `${response.candidates.length} candidatos na fila da vaga “${response.jobTitle}”. Acompanhe na sala; no fim, as notas ficam em Candidatos.`,
        );
      } catch (error) {
        setResult(
          error instanceof Error
            ? error.message
            : "Não foi possível executar a demonstração.",
        );
      }
    });
  }

  function clear() {
    if (
      !window.confirm(
        "Excluir os candidatos fictícios da simulação? Candidatos reais não são afetados.",
      )
    )
      return;
    setResult(null);
    startTransition(async () => {
      try {
        const { deleted } = await clearDemoTriage();
        setResult(
          deleted === 0
            ? "Não havia candidatos da simulação para excluir."
            : `${deleted} candidato${deleted === 1 ? "" : "s"} da simulação excluído${deleted === 1 ? "" : "s"}.`,
        );
      } catch (error) {
        setResult(
          error instanceof Error
            ? error.message
            : "Não foi possível limpar a simulação.",
        );
      }
    });
  }

  const clearButton = (
    <button
      type="button"
      onClick={clear}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-white px-3 py-2.5 text-[12px] font-medium text-[#52525b] hover:bg-[#fafafa] disabled:cursor-wait disabled:opacity-60"
    >
      <Trash2 className="size-3.5" />
      Limpar simulação
    </button>
  );

  if (compact) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex flex-wrap justify-end gap-2">
          {clearButton}
          <button
            type="button"
            onClick={run}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-semibold shadow-sm hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
            style={{
              backgroundColor: "var(--brand-primary)",
              color: "var(--brand-foreground)",
            }}
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}
            {pending ? "Aguarde..." : "Iniciar simulação"}
          </button>
        </div>
        {result && (
          <p
            className="max-w-[360px] text-right text-[11px] leading-4 text-[#71717a]"
            role="status"
          >
            {result}
          </p>
        )}
      </div>
    );
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
              Sala de simulação · Agente de Triagem
            </h2>
            <p className="mt-1 max-w-[650px] text-[11px] leading-5 text-[#71717a]">
              Coloca 4 candidatos fictícios na fila (perfis forte, médio e
              fraco), cada um com currículo em PDF, e mostra o agente baixando,
              lendo e avaliando um por vez. Leva cerca de 1 minuto. Não envia
              e-mail para ninguém.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          {clearButton}
          <button
            type="button"
            onClick={run}
            disabled={pending}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#171413] px-4 py-2.5 text-[11px] font-semibold text-white shadow-sm hover:bg-[#292321] disabled:cursor-wait disabled:opacity-70"
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}
            {pending ? "Aguarde..." : "Iniciar simulação"}
          </button>
        </div>
      </div>

      {result && (
        <div className="mt-4 rounded-xl bg-[#fafaf9] px-3.5 py-3 text-[11px] text-[#57534e] ring-1 ring-[#eceae8]">
          {result}
        </div>
      )}
    </div>
  );
}
