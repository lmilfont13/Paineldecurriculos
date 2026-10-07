"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, BrainCircuit, CheckCircle2, Clock3, Loader2, Mail, RefreshCw, XCircle, Zap } from "lucide-react";
import { useRouter } from "next/navigation";

type Agent = "TRIAGE" | "COMMUNICATION" | "INTELLIGENCE";
type RunStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";

export type LiveAgentRun = {
  id: string;
  agent: Agent;
  status: RunStatus;
  eventName: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  summary: string | null;
  error: string | null;
  application: { name: string; job: { title: string } } | null;
};

function agentLabel(agent: Agent) {
  if (agent === "TRIAGE") return "Agente de Triagem";
  if (agent === "COMMUNICATION") return "Agente de Comunicação";
  return "Agente de Inteligência";
}

function taskLabel(run: LiveAgentRun) {
  if (run.agent === "TRIAGE") {
    return run.status === "QUEUED"
      ? "Na fila para análise"
      : "Analisando currículo e critérios da vaga";
  }

  if (run.agent === "COMMUNICATION") {
    return run.status === "QUEUED"
      ? "Na fila para comunicação"
      : "Preparando a atualização do candidato";
  }

  return run.status === "QUEUED"
    ? "Na fila para leitura do processo"
    : "Analisando gargalos e indicadores do recrutamento";
}

function elapsedLabel(startedAt: string | null, createdAt: string) {
  const base = startedAt ?? createdAt;
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(base).getTime()) / 1000));
  if (seconds < 60) return seconds + "s";
  return Math.floor(seconds / 60) + "min " + (seconds % 60) + "s";
}

function StatusIcon({ status }: { status: RunStatus }) {
  if (status === "SUCCEEDED") return <CheckCircle2 className="size-4 text-[#15803d]" />;
  if (status === "FAILED") return <XCircle className="size-4 text-[#b91c1c]" />;
  return <Loader2 className="size-4 animate-spin text-[var(--brand-primary)]" />;
}

export function AgentLiveMonitor({ runs }: { runs: LiveAgentRun[] }) {
  const router = useRouter();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const activeRuns = useMemo(
    () => runs.filter((run) => run.status === "QUEUED" || run.status === "RUNNING"),
    [runs]
  );

  const lastCompleted = runs.find(
    (run) => run.status === "SUCCEEDED" || run.status === "FAILED"
  );
  const recentDone = runs
    .filter((run) => run.status === "SUCCEEDED" || run.status === "FAILED")
    .slice(0, 4);

  return (
    <section className="mt-8 rounded-2xl border border-[#e4e4e7] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[#171413] text-white">
            <Activity className="size-5" strokeWidth={1.8} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-[#18181b]">Agentes trabalhando agora</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f0fdf4] px-2 py-1 text-[9px] font-semibold text-[#15803d]">
                <span className="size-1.5 animate-pulse rounded-full bg-[#22c55e]" />
                AO VIVO
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-[#a1a1aa]">
              Atualiza sozinho a cada etapa enquanto houver agentes trabalhando
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-[10px] text-[#a1a1aa]">
            <Clock3 className="size-3.5" />
            {new Date(now).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#e4e4e7] bg-white px-2.5 py-1.5 text-[10px] font-semibold text-[#57534e] transition hover:bg-[#fafaf9]"
          >
            <RefreshCw className="size-3" />
            Atualizar
          </button>
        </div>
      </div>

      {activeRuns.length > 0 ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {activeRuns.map((run) => (
            <div key={run.id} className="relative overflow-hidden rounded-2xl border border-[#dedbd7] bg-[#fafaf9] p-4">
              <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-[#eceae8]">
                <div className="h-full w-1/3 animate-[agent-progress_1.4s_ease-in-out_infinite] rounded-full bg-[var(--brand-primary)]" />
              </div>

              <div className="flex items-start justify-between gap-3 pt-1">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-[#e7e5e4]">
                    {run.agent === "TRIAGE" ? (
                      <BrainCircuit className="size-4 text-[#44403c]" />
                     ) : run.agent === "COMMUNICATION" ? (
                      <Mail className="size-4 text-[#44403c]" />
                    ) : (
                      <BrainCircuit className="size-4 text-[#44403c]" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-[#292524]">{agentLabel(run.agent)}</p>
                    <p className="truncate text-[10px] text-[#a1a1aa]">
                      {run.status === "RUNNING" && run.summary ? run.summary : taskLabel(run)}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-[#fff7e6] px-2 py-1 text-[9px] font-semibold text-[#a16207]">
                  {run.status === "QUEUED" ? "NA FILA" : "EXECUTANDO"}
                </span>
              </div>

              <div className="mt-4 rounded-xl bg-white px-3.5 py-3 ring-1 ring-[#eceae8]">
                <p className="truncate text-[12px] font-semibold text-[#18181b]">{run.application?.name ?? "Candidatura"}</p>
                <p className="mt-1 truncate text-[10px] text-[#71717a]">{run.application?.job.title ?? "Processo de recrutamento"}</p>
              </div>

              <div className="mt-3 flex items-center justify-between text-[10px]">
                <span className="text-[#a1a1aa]">Tempo de execução</span>
                <span className="font-semibold text-[#57534e]">{elapsedLabel(run.startedAt, run.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 flex items-center gap-4 rounded-2xl border border-dashed border-[#d8d5d1] bg-[#fafaf9] px-4 py-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-[#e7e5e4]">
            <Zap className="size-4 text-[#a1a1aa]" />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-[#44403c]">Nenhum agente executando neste momento</p>
            <p className="mt-1 text-[10px] leading-5 text-[#a1a1aa]">
              Quando uma candidatura chegar ou o status de um candidato mudar, a execução aparecerá aqui automaticamente.
            </p>
          </div>
        </div>
      )}

      {activeRuns.length > 0 && recentDone.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-[#f0efed] pt-4">
          {recentDone.map((run) => (
            <li key={run.id} className="flex items-center gap-2 text-[10px] text-[#71717a]">
              <StatusIcon status={run.status} />
              <span className="min-w-0 truncate">
                {run.status === "SUCCEEDED"
                  ? (run.summary ?? "Concluída")
                  : `Falhou: ${run.error ?? "erro desconhecido"}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {activeRuns.length === 0 && lastCompleted && (
        <div className="mt-4 flex items-center gap-2 border-t border-[#f0efed] pt-4">
          <StatusIcon status={lastCompleted.status} />
          <p className="min-w-0 truncate text-[10px] text-[#71717a]">
            Última execução: <span className="font-medium text-[#44403c]">{agentLabel(lastCompleted.agent)}</span>
            {" · "}
            {lastCompleted.status === "SUCCEEDED" ? "concluída" : "falhou"}
            {lastCompleted.durationMs !== null ? " em " + lastCompleted.durationMs + " ms" : ""}
          </p>
        </div>
      )}
    </section>
  );
}
