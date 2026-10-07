import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { BrainCircuit, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { AgentRoom } from "@/components/gestor/agent-room";
import { LiveRefresh } from "@/components/gestor/live-refresh";
import { activeRunsSignature } from "@/server/models/simulation.model";
import { IntelligenceAgentCard } from "@/components/gestor/intelligence-agent-card";
import { SimulationControls } from "@/components/gestor/simulation-controls";

import { loadAgentCenter } from "@/server/controllers/ai-status.controller";
import { loadSimulationOptions } from "@/server/controllers/demo.controller";

export const metadata: Metadata = { title: "Agentes · Triagem" };

// A sala roda até 8 análises em sequência depois da resposta (after());
// o tempo da função precisa cobrir todas.
export const maxDuration = 300;

const agents = [
  {
    name: "Agente de Triagem",
    label: "Análise de candidaturas",
    icon: BrainCircuit,
    status: "ATIVO",
    tone: "green",
    event: "application/submitted",
    description:
      "Analisa a candidatura em segundo plano e transforma currículo e respostas em score, raciocínio e estado de processamento.",
    outputs: ["aiScore", "aiReasoning", "aiState"],
    rule: "A IA nunca altera a etapa do candidato.",
  },
  {
    name: "Agente de Inteligência",
    label: "Leitura executiva do processo",
    icon: Sparkles,
    status: "ATIVO",
    tone: "purple",
    event: "company/intelligence-requested",
    description:
      "Cruza indicadores agregados do funil para encontrar gargalos, padrões de aderência e uma próxima ação para o gestor.",
    outputs: ["Resumo executivo", "Gargalos", "Próxima ação"],
    rule: "A IA analisa o processo; a decisão continua sendo do gestor.",
  },
  {
    name: "Agente de Comunicação",
    label: "Mudanças de etapa",
    icon: Mail,
    status: "ATIVO",
    tone: "blue",
    event: "application/status-changed",
    description:
      "Recebe a decisão do gestor e comunica o candidato pelo portal e por e-mail, com retentativas automáticas.",
    outputs: ["Notificação no portal", "E-mail de atualização"],
    rule: "A decisão continua sendo exclusivamente do gestor.",
  },
];


export default async function AgentesPage() {
  const emptyData = {
    windowLabel: "Últimos 7 dias",
    submitted: 0,
    aiDone: 0,
    aiProcessing: 0,
    aiFailed: 0,
    communications: 0,
    recentApplications: [],
    runs: [],
    runMetrics: { total: 0, succeeded: 0, failed: 0, queued: 0, running: 0 },
  };

  const data = await loadAgentCenter()
    .then((r) => r.data)
    .catch((error) => {
      unstable_rethrow(error); // redirect() do guard precisa propagar
      console.error("[agentes] Falha ao carregar telemetria:", error);
      return emptyData;
    });
  const simulation = await loadSimulationOptions().catch((error) => {
    unstable_rethrow(error);
    console.error("[agentes] Falha ao carregar vagas da sala:", error);
    return { total: 0, jobs: [] };
  });
  const runs = data.runs;
  const runMetrics = data.runMetrics;

  const latestIntelligence = runs.find((run) => run.agent === "INTELLIGENCE");

  const liveRuns = runs.map((run) => ({
    id: run.id,
    agent: run.agent,
    status: run.status,
    eventName: run.eventName,
    createdAt: run.createdAt.toISOString(),
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    durationMs: run.durationMs,
    summary: run.summary,
    error: run.error,
    application: run.application,
  }));

  const metrics: [string, number, string][] = [
    ["Candidaturas", data.submitted, "recebidas"],
    ["Analisadas", data.aiDone, "pela triagem"],
    ["Em análise", data.aiProcessing, "agora"],
    ["Falhas", data.aiFailed, "pedem atenção"],
    ["Comunicações", data.communications, "mudanças de etapa"],
  ];

  return (
    <div className="mx-auto w-full max-w-[1080px] pb-8">
      {/* 1. Título + comandos: o que se faz nesta tela fica no topo */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-[-0.025em] text-[#0a0a0a]">
            Agentes
          </h1>
          <p className="mt-1.5 max-w-[560px] text-[13px] leading-6 text-[#71717a]">
            Eles preparam o processo em segundo plano. A decisão sobre cada
            candidato é sempre sua.
          </p>
        </div>
        <SimulationControls jobs={simulation.jobs} total={simulation.total} />
      </div>

      <LiveRefresh
        active={runMetrics.queued + runMetrics.running > 0}
        watchActiveRuns
        initialSignature={activeRunsSignature(runs)}
        intervalMs={2000}
      />

      {/* 2. A sala, visível sem rolar */}
      <AgentRoom runs={liveRuns} />

      {/* 3. Números da semana */}
      <section aria-label={data.windowLabel} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {metrics.map(([label, value, detail]) => (
          <div key={label} className="rounded-2xl border border-[#e4e4e7] bg-white px-4 py-3">
            <p className="text-[11px] font-medium text-[#71717a]">{label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#18181b]">{value}</p>
            <p className="text-[10px] text-[#a1a1aa]">{detail}</p>
          </div>
        ))}
      </section>
      <p className="mt-1.5 text-right text-[10px] text-[#a1a1aa]">{data.windowLabel}</p>

      {/* 4. Histórico + Inteligência lado a lado */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <section className="rounded-2xl border border-[#e4e4e7] bg-white p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-[#18181b]">Histórico de execuções</h2>
            <p className="text-[11px] text-[#71717a]">
              {runMetrics.succeeded} concluídas, {runMetrics.failed} com falha
            </p>
          </div>
          <ul className="mt-4 max-h-[420px] divide-y divide-[#f0efed] overflow-y-auto pr-1">
            {runs.map((run) => {
              const agentName =
                run.agent === "TRIAGE" ? "Triagem" : run.agent === "COMMUNICATION" ? "Comunicação" : "Inteligência";
              const Icon = run.agent === "TRIAGE" ? BrainCircuit : run.agent === "COMMUNICATION" ? Mail : Sparkles;
              return (
                <li key={run.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#fafaf9] ring-1 ring-[#e7e5e4]">
                      <Icon className="size-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium text-[#292524]">
                        {agentName}: {run.application?.name ?? "processo da empresa"}
                      </p>
                      <p className="truncate text-[11px] text-[#a1a1aa]">
                        {run.status === "FAILED" ? (run.error ?? "Falhou") : (run.summary ?? run.eventName)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${
                      run.status === "SUCCEEDED"
                        ? "bg-[#f0fdf4] text-[#15803d]"
                        : run.status === "FAILED"
                          ? "bg-[#fef2f2] text-[#b91c1c]"
                          : "bg-[#fff7e6] text-[#a16207]"
                    }`}
                  >
                    {run.status === "SUCCEEDED"
                      ? "Concluída"
                      : run.status === "FAILED"
                        ? "Falhou"
                        : run.status === "RUNNING"
                          ? "Trabalhando"
                          : "Na fila"}
                  </span>
                </li>
              );
            })}
            {runs.length === 0 && (
              <li className="py-6 text-center text-[12px] text-[#a1a1aa]">
                Nada por aqui ainda. Inicie a simulação para ver a primeira execução.
              </li>
            )}
          </ul>
        </section>

        <IntelligenceAgentCard
          latestSummary={latestIntelligence?.summary ?? null}
          latestStatus={latestIntelligence?.status ?? null}
        />
      </div>

      {/* 5. Referência, recolhida por padrão */}
      <details className="group mt-6 rounded-2xl border border-[#e4e4e7] bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-[14px] font-semibold text-[#18181b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]">
          Como os agentes funcionam
          <span aria-hidden className="text-[#a1a1aa] transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="border-t border-[#f0efed] p-5">
          <div className="grid gap-4 lg:grid-cols-3">
            {agents.map((agent) => {
              const Icon = agent.icon;
              return (
                <article key={agent.name} className="rounded-xl bg-[#fafaf9] p-4">
                  <div className="flex items-center gap-2.5">
                    <Icon className="size-4 text-[#44403c]" strokeWidth={1.8} />
                    <h3 className="text-[13px] font-semibold text-[#0a0a0a]">{agent.name}</h3>
                  </div>
                  <p className="mt-2 text-[12px] leading-5 text-[#71717a]">{agent.description}</p>
                  <p className="mt-3 text-[11px] text-[#a1a1aa]">
                    Entrega: {agent.outputs.join(", ")}
                  </p>
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-5 text-[#57534e]">
                    <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[#1f7a4d]" />
                    {agent.rule}
                  </p>
                </article>
              );
            })}
          </div>
          <p className="mt-5 text-[12px] leading-5 text-[#71717a]">
            O caminho é sempre o mesmo: um evento acontece, o agente prepara a
            evidência, e o gestor decide. Próximos agentes previstos: preparação
            de entrevistas e reaproveitamento de bons candidatos.
          </p>
        </div>
      </details>
    </div>
  );
}
