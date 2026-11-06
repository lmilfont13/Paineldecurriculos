"use client";

import { useState, useTransition } from "react";
import {
  Bot,
  Brain,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Fingerprint,
  Play,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

interface CandidateAiSimulatorProps {
  companyName: string;
  candidateName: string;
  applicationsCount: number;
}

const AGENTS = [
  {
    id: "lexis",
    name: "Agente Lexis",
    tagline: "Estruturação & Estabilidade",
    description:
      "Extrai do currículo o histórico profissional, cargos exercidos e tempo de permanência em cada empresa.",
    badge: "Leitura Profunda",
    color: "from-blue-500/10 to-indigo-500/10 border-blue-200 text-blue-700",
    iconBg: "bg-blue-600 text-white",
    metrics: "Tempo de casa e trajetória mapeados",
    Icon: Brain,
  },
  {
    id: "synapse",
    name: "Agente Synapse",
    tagline: "Aderência Semântica",
    description:
      "Compara competências e habilidades técnicas com os desafios das vagas, sem vieses de gênero, idade ou foto.",
    badge: "Neutralidade LGPD",
    color: "from-emerald-500/10 to-teal-500/10 border-emerald-200 text-emerald-700",
    iconBg: "bg-emerald-600 text-white",
    metrics: "Scorecard neutro por competência",
    Icon: Sparkles,
  },
  {
    id: "router",
    name: "Agente Router",
    tagline: "Conexão com Recrutadores",
    description:
      "Gera o dossiê executivo para que os gestores humanos avaliem e convoquem para entrevistas.",
    badge: "Decisão 100% Humana",
    color: "from-amber-500/10 to-orange-500/10 border-amber-200 text-amber-700",
    iconBg: "bg-amber-600 text-white",
    metrics: "Zero descarte automático",
    Icon: Zap,
  },
];

export function CandidateAiSimulator({
  companyName,
  candidateName,
  applicationsCount,
}: CandidateAiSimulatorProps) {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStep, setSimStep] = useState<number>(0);
  const [completed, setCompleted] = useState(false);

  function startSimulation() {
    setIsSimulating(true);
    setSimStep(1);
    setCompleted(false);

    setTimeout(() => {
      setSimStep(2);
      setTimeout(() => {
        setSimStep(3);
        setTimeout(() => {
          setSimStep(4);
          setCompleted(true);
        }, 1200);
      }, 1200);
    }, 1200);
  }

  function resetSimulation() {
    setIsSimulating(false);
    setSimStep(0);
    setCompleted(false);
  }

  const firstName = candidateName.trim().split(" ")[0] || "Candidato";

  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-[#e4e4e7] bg-white shadow-xs">
      {/* Top Banner com Status Ativo */}
      <div className="border-b border-[#f4f4f5] bg-gradient-to-r from-[#fafaf9] via-white to-[#fafaf9] p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[#0a0a0a] text-white shadow-sm">
              <Bot className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-800">
                  Central de Inteligência Ativa
                </span>
              </div>
              <h3 className="mt-0.5 text-lg font-bold text-[#0a0a0a] md:text-xl">
                Como nossa Inteligência Artificial avalia seu perfil
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={isSimulating ? resetSimulation : startSimulation}
            className="inline-flex items-center gap-2 rounded-xl border border-[#0a0a0a] bg-[#0a0a0a] px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#262626] active:scale-98"
          >
            {isSimulating ? (
              <>
                <RotateCw className="size-3.5" />
                Reiniciar simulação
              </>
            ) : (
              <>
                <Play className="size-3.5 fill-current" />
                Simular triagem do meu currículo
              </>
            )}
          </button>
        </div>

        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#71717a]">
          Na <strong>{companyName}</strong>, utilizamos agentes de IA dedicados para analisar competências,
          destacar suas experiências e preparar seu dossiê para a equipe de recrutamento humano.
        </p>

        {/* Simulação em Tempo Real (quando acionada) */}
        {isSimulating && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-xs animate-in fade-in slide-in-from-top-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="size-4 text-emerald-700 animate-pulse" />
                <span className="text-xs font-bold text-emerald-950">
                  Simulação em execução para: {firstName}
                </span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-800">
                {completed ? "Análise Concluída (100%)" : `Etapa ${simStep} de 3`}
              </span>
            </div>

            {/* Stepper Visual */}
            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
              <div
                className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                  simStep >= 1
                    ? "border-emerald-300 bg-white shadow-xs"
                    : "border-emerald-200/50 bg-white/50 opacity-60"
                }`}
              >
                <div
                  className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    simStep > 1
                      ? "bg-emerald-600 text-white"
                      : simStep === 1
                      ? "bg-emerald-100 text-emerald-900 animate-pulse"
                      : "bg-[#e4e4e7] text-[#71717a]"
                  }`}
                >
                  {simStep > 1 ? <CheckCircle2 className="size-4" /> : "1"}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-[#0a0a0a]">Agente Lexis</p>
                  <p className="truncate text-[10px] text-[#71717a]">
                    {simStep > 1 ? "Trajetória e permanência lidas" : "Catalogando experiências..."}
                  </p>
                </div>
              </div>

              <div
                className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                  simStep >= 2
                    ? "border-emerald-300 bg-white shadow-xs"
                    : "border-emerald-200/50 bg-white/50 opacity-60"
                }`}
              >
                <div
                  className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    simStep > 2
                      ? "bg-emerald-600 text-white"
                      : simStep === 2
                      ? "bg-emerald-100 text-emerald-900 animate-pulse"
                      : "bg-[#e4e4e7] text-[#71717a]"
                  }`}
                >
                  {simStep > 2 ? <CheckCircle2 className="size-4" /> : "2"}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-[#0a0a0a]">Agente Synapse</p>
                  <p className="truncate text-[10px] text-[#71717a]">
                    {simStep > 2 ? "Competências avaliadas sem viés" : "Cruzando requisitos com vaga..."}
                  </p>
                </div>
              </div>

              <div
                className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                  simStep >= 3
                    ? "border-emerald-300 bg-white shadow-xs"
                    : "border-emerald-200/50 bg-white/50 opacity-60"
                }`}
              >
                <div
                  className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    completed
                      ? "bg-emerald-600 text-white"
                      : simStep === 3
                      ? "bg-emerald-100 text-emerald-900 animate-pulse"
                      : "bg-[#e4e4e7] text-[#71717a]"
                  }`}
                >
                  {completed ? <CheckCircle2 className="size-4" /> : "3"}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-[#0a0a0a]">Agente Router</p>
                  <p className="truncate text-[10px] text-[#71717a]">
                    {completed ? "Encaminhado para a banca humana" : "Gerando dossiê para recrutador..."}
                  </p>
                </div>
              </div>
            </div>

            {completed && (
              <div className="mt-3.5 flex items-center justify-between rounded-xl bg-white px-4 py-2.5 border border-emerald-300 shadow-xs">
                <span className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
                  <Sparkles className="size-4 text-emerald-600" />
                  Pronto! Seu perfil está posicionado com destaque e visível para os gestores.
                </span>
                <span className="text-[11px] font-bold text-emerald-700">Tudo em conformidade LGPD</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grid com os 3 Agentes de IA */}
      <div className="grid grid-cols-1 divide-y border-b border-[#f4f4f5] md:grid-cols-3 md:divide-x md:divide-y-0">
        {AGENTS.map((agent) => (
          <div key={agent.id} className="flex flex-col justify-between p-6 transition hover:bg-[#fafaf9]">
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className={`flex size-9 items-center justify-center rounded-xl ${agent.iconBg}`}>
                  <agent.Icon className="size-4" />
                </div>
                <span className="rounded-full bg-[#f4f4f5] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#52525b]">
                  {agent.badge}
                </span>
              </div>

              <h4 className="mt-3.5 text-sm font-bold text-[#0a0a0a]">{agent.name}</h4>
              <p className="text-[11px] font-semibold text-[#a1a1aa]">{agent.tagline}</p>

              <p className="mt-2.5 text-xs leading-relaxed text-[#71717a]">
                {agent.description}
              </p>
            </div>

            <div className="mt-5 rounded-xl border border-[#e4e4e7] bg-white px-3 py-2 text-[11px] font-medium text-[#52525b] shadow-2xs">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-[#a1a1aa]">
                Garantia do Agente
              </span>
              <span className="text-[#0a0a0a]">{agent.metrics}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Rodapé Ético e de Transparência */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#fafaf9] px-6 py-4 text-xs text-[#71717a] md:px-8">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
          <span>
            <strong>Conformidade e Ética:</strong> A inteligência artificial nunca rejeita nem reprova candidatos.
            Todas as decisões finais de contratação pertencem aos gestores humanos da <strong>{companyName}</strong>.
          </span>
        </div>

        <div className="flex items-center gap-1.5 font-semibold text-[#0a0a0a]">
          <Fingerprint className="size-3.5 text-[#a1a1aa]" />
          <span>Segurança LGPD</span>
        </div>
      </div>
    </section>
  );
}

