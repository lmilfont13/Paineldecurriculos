import type { Metadata } from "next";
import { Bot, BrainCircuit, Mail, ShieldCheck, Sparkles, Zap } from "lucide-react";

import { requireManager } from "@/server/controllers/guards";

export const metadata: Metadata = { title: "Agentes · Triagem" };

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

function Status({ tone }: { tone: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f0fdf4] px-2.5 py-1 text-[10px] font-semibold tracking-wide text-[#15803d]">
      <span className="size-1.5 rounded-full bg-[#22c55e]" />
      ATIVO
    </span>
  );
}

export default async function AgentesPage() {
  await requireManager();

  return (
    <div className="mx-auto w-full max-w-[1080px]">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">
            <Sparkles className="size-3.5" />
            Inteligência
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.025em] text-[#0a0a0a]">
            Agentes
          </h1>
          <p className="mt-2 max-w-[660px] text-[13px] leading-6 text-[#71717a]">
            Os agentes trabalham em segundo plano para preparar o processo.
            Eles executam tarefas, registram evidências e nunca substituem a
            decisão do recrutador.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-[#e4e4e7] bg-white px-3.5 py-2.5">
          <Zap className="size-4 text-[#b07818]" />
          <span className="text-[12px] font-medium text-[#57534e]">
            Processamento em background
          </span>
        </div>
      </div>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        {agents.map((agent) => {
          const Icon = agent.icon;
          return (
            <article
              key={agent.name}
              className="rounded-2xl border border-[#e4e4e7] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="flex size-11 items-center justify-center rounded-xl bg-[#fafaf9] text-[#1c1917] ring-1 ring-[#e7e5e4]">
                  <Icon className="size-5" strokeWidth={1.8} />
                </span>
                <Status tone={agent.tone} />
              </div>

              <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.12em] text-[#a1a1aa]">
                {agent.label}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[#0a0a0a]">
                {agent.name}
              </h2>
              <p className="mt-3 text-[13px] leading-6 text-[#71717a]">
                {agent.description}
              </p>

              <div className="mt-6 rounded-xl bg-[#fafaf9] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a1a1aa]">
                  Evento
                </p>
                <code className="mt-2 block text-[12px] font-medium text-[#44403c]">
                  {agent.event}
                </code>
              </div>

              <div className="mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a1a1aa]">
                  Entregas
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {agent.outputs.map((output) => (
                    <span
                      key={output}
                      className="rounded-lg border border-[#e7e5e4] px-2.5 py-1.5 text-[11px] text-[#57534e]"
                    >
                      {output}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex items-start gap-2 border-t border-[#f0efed] pt-4">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#1f7a4d]" />
                <p className="text-[11px] leading-5 text-[#71717a]">
                  {agent.rule}
                </p>
              </div>
            </article>
          );
        })}
      </section>

      <section className="mt-8 rounded-2xl border border-[#e4e4e7] bg-[#171413] p-6 text-white">
        <div className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <Bot className="size-5" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
              Princípio do Triagem
            </p>
            <h2 className="mt-1 text-lg font-semibold">
              Evento → Agente → evidência → gestor → ação
            </h2>
            <p className="mt-2 max-w-[760px] text-[12px] leading-5 text-white/60">
              A automação prepara o trabalho e reduz tarefas repetitivas. A
              decisão humana permanece explícita, auditável e sob controle da
              empresa.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-8 mb-4 rounded-2xl border border-dashed border-[#d4d4d8] bg-[#fafaf9] p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">
          Próximos agentes
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ["Inteligência", "Resumo diário do processo e gargalos."],
            ["Entrevista", "Preparação e acompanhamento de entrevistas."],
            ["Talent Pool", "Reaproveitamento de bons candidatos."],
          ].map(([name, description]) => (
            <div key={name} className="rounded-xl border border-[#e4e4e7] bg-white p-4">
              <p className="text-[13px] font-semibold text-[#0a0a0a]">{name}</p>
              <p className="mt-1 text-[11px] leading-5 text-[#71717a]">{description}</p>
              <span className="mt-3 inline-flex rounded-full bg-[#f4f4f5] px-2 py-1 text-[9px] font-medium text-[#a1a1aa]">
                ROADMAP
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
