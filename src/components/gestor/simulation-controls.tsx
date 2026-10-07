"use client";

import { useState, useTransition } from "react";
import { Loader2, Play, Trash2 } from "lucide-react";

import {
  clearDemoTriage,
  runDemoTriage,
  runRealTriage,
} from "@/server/controllers/demo.controller";
import {
  SIMULATION_REAL_LIMIT,
  type SimulationJobOption,
} from "@/server/models/simulation.model";

type Mode = "real" | "exemplos";

/**
 * Comandos da sala dos agentes: rodar com candidatos reais (de uma vaga ou
 * de todas) ou com os 4 exemplos fictícios.
 */
export function SimulationControls({
  jobs,
  total,
}: {
  jobs: SimulationJobOption[];
  total: number;
}) {
  const [mode, setMode] = useState<Mode>(total > 0 ? "real" : "exemplos");
  const [jobId, setJobId] = useState<string>(jobs[0]?.id ?? "");
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function start() {
    setResult(null);
    startTransition(async () => {
      try {
        if (mode === "real") {
          const r = await runRealTriage(jobId || null);
          if (r.candidates.length === 0) {
            setResult("Nenhum candidato real para analisar nesta escolha.");
            return;
          }
          setResult(
            `${r.candidates.length} ${r.candidates.length === 1 ? "candidato" : "candidatos"} de ${r.jobTitle} na fila` +
              (r.capped ? ` (os ${SIMULATION_REAL_LIMIT} mais recentes)` : "") +
              ". A nota de cada um é refeita; ninguém é avisado e nenhuma etapa muda."
          );
        } else {
          const r = await runDemoTriage();
          setResult(
            `${r.candidates.length} exemplos na fila da vaga “${r.jobTitle}”. Não envia e-mail para ninguém.`
          );
        }
      } catch (error) {
        setResult(error instanceof Error ? error.message : "Não foi possível iniciar a simulação.");
      }
    });
  }

  function clear() {
    if (!window.confirm("Excluir os candidatos de exemplo? Candidatos reais não são afetados.")) return;
    setResult(null);
    startTransition(async () => {
      try {
        const { deleted } = await clearDemoTriage();
        setResult(
          deleted === 0
            ? "Não havia exemplos para excluir."
            : `${deleted} ${deleted === 1 ? "exemplo excluído" : "exemplos excluídos"}.`
        );
      } catch (error) {
        setResult(error instanceof Error ? error.message : "Não foi possível limpar os exemplos.");
      }
    });
  }

  const tab = (value: Mode, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === value}
      onClick={() => {
        setMode(value);
        setResult(null);
      }}
      className={
        "rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors " +
        (mode === value ? "bg-white text-[#0a0a0a] shadow-sm" : "text-[#71717a] hover:text-[#0a0a0a]")
      }
    >
      {label}
    </button>
  );

  return (
    <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div role="tablist" aria-label="Quem entra na sala" className="flex rounded-xl bg-[#f4f4f5] p-1">
          {tab("real", "Candidatos reais")}
          {tab("exemplos", "Exemplos")}
        </div>

        {mode === "real" ? (
          <select
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            disabled={pending || total === 0}
            aria-label="Vaga"
            className="h-9 max-w-[240px] rounded-xl border border-[#e4e4e7] bg-white px-2.5 text-[12px] text-[#0a0a0a]"
          >
            {total === 0 && <option value="">Nenhum candidato real ainda</option>}
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title} ({job.count})
              </option>
            ))}
            {jobs.length > 1 && <option value="">Todas as vagas ({total})</option>}
          </select>
        ) : (
          <button
            type="button"
            onClick={clear}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-white px-3 text-[12px] font-medium text-[#52525b] hover:bg-[#fafafa] disabled:opacity-60"
          >
            <Trash2 className="size-3.5" />
            Limpar exemplos
          </button>
        )}

        <button
          type="button"
          onClick={start}
          disabled={pending || (mode === "real" && total === 0)}
          className="inline-flex h-9 items-center gap-2 rounded-xl px-4 text-[12px] font-semibold shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
          {pending ? "Aguarde..." : "Iniciar"}
        </button>
      </div>

      <p className="max-w-[460px] text-right text-[11px] leading-4 text-[#71717a]" role="status">
        {result ??
          (mode === "real"
            ? `Reanalisa até ${SIMULATION_REAL_LIMIT} candidatos reais, um por vez, e refaz a nota. Ninguém é avisado e nenhuma etapa muda.`
            : "4 candidatos fictícios (perfis forte, médio e fraco) com currículo em PDF.")}
      </p>
    </div>
  );
}
