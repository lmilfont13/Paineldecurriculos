"use client";

import {
  FileText,
  Sparkles,
  CalendarCheck,
  Award,
  FolderHeart,
  CheckCircle2,
  Clock,
  ArrowRight,
} from "lucide-react";
import { formatAppliedAt, type AppStatusKey } from "@/server/models/application.model";
import { formatInterviewLong } from "@/server/models/interview.model";

export interface StatusEventItem {
  id: string;
  from: string | null;
  to: string;
  createdAt: Date | string;
}

interface CandidateProcessTrackerProps {
  currentStatus: AppStatusKey;
  companyName: string;
  events: StatusEventItem[];
  interviewAt?: Date | null;
}

interface StepInfo {
  label: string;
  description: string;
  icon: typeof FileText;
  badgeBg: string;
  badgeText: string;
  iconBg: string;
  iconColor: string;
}

export function getStepDetails(from: string | null, to: string): StepInfo {
  if (from === null) {
    return {
      label: "Candidatura enviada",
      description: "Recebemos seu currículo com sucesso no sistema.",
      icon: FileText,
      badgeBg: "bg-emerald-50 border-emerald-200",
      badgeText: "text-emerald-800",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-700",
    };
  }

  switch (to) {
    case "SHORTLISTED":
      return {
        label: "Em análise",
        description: "Seu currículo foi selecionado na triagem inicial e está em análise detalhada pela equipe.",
        icon: Sparkles,
        badgeBg: "bg-blue-50 border-blue-200",
        badgeText: "text-blue-800",
        iconBg: "bg-blue-100",
        iconColor: "text-blue-700",
      };
    case "INTERVIEW":
      return {
        label: "Avançou para entrevista",
        description: "Parabéns! A equipe gostou do seu perfil e te chamou para a etapa de conversa.",
        icon: CalendarCheck,
        badgeBg: "bg-amber-50 border-amber-200",
        badgeText: "text-amber-800",
        iconBg: "bg-amber-100",
        iconColor: "text-amber-700",
      };
    case "APPROVED":
      return {
        label: "Você foi aprovado(a)!",
        description: "Excelente notícia! Seu perfil foi selecionado para a contratação.",
        icon: Award,
        badgeBg: "bg-emerald-50 border-emerald-200",
        badgeText: "text-emerald-800",
        iconBg: "bg-emerald-100",
        iconColor: "text-emerald-700",
      };
    case "STANDBY":
      return {
        label: "Banco de talentos prioritário",
        description: "Seu perfil foi muito elogiado e está guardado para contato em novas oportunidades compatíveis.",
        icon: FolderHeart,
        badgeBg: "bg-teal-50 border-teal-200",
        badgeText: "text-teal-800",
        iconBg: "bg-teal-100",
        iconColor: "text-teal-700",
      };
    case "REJECTED":
      return {
        label: "Banco de dados da empresa",
        description: "Agradecemos sua participação. Seu currículo continuará em nosso banco para futuras vagas.",
        icon: FolderHeart,
        badgeBg: "bg-zinc-100 border-zinc-200",
        badgeText: "text-zinc-700",
        iconBg: "bg-zinc-100",
        iconColor: "text-zinc-600",
      };
    case "PENDING":
    default:
      return {
        label: "Em análise",
        description: "Seu perfil está sendo avaliado pela equipe de recrutamento.",
        icon: Sparkles,
        badgeBg: "bg-blue-50 border-blue-200",
        badgeText: "text-blue-800",
        iconBg: "bg-blue-100",
        iconColor: "text-blue-700",
      };
  }
}

export function CandidateProcessTracker({
  currentStatus,
  companyName,
  events,
  interviewAt,
}: CandidateProcessTrackerProps) {
  // Ordena os eventos cronologicamente
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Status atual amigável para o topo do quadro
  const currentStep = getStepDetails(
    sortedEvents.length > 1 ? sortedEvents[sortedEvents.length - 2]?.to : null,
    currentStatus
  );

  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-[#e4e4e7] bg-white shadow-sm">
      {/* Header com destaque do status atual */}
      <div
        className="relative overflow-hidden p-6 sm:p-7"
        style={{
          background: "linear-gradient(135deg, #18181b 0%, #27272a 100%)",
        }}
      >
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`flex size-11 items-center justify-center rounded-2xl ${currentStep.iconBg} ${currentStep.iconColor} shadow-md`}>
              <currentStep.icon className="size-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Status da candidatura
              </p>
              <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                {currentStep.label}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 backdrop-blur-xs">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-white">
              Processo ativo na {companyName}
            </span>
          </div>
        </div>

        <p className="relative z-10 mt-3 text-xs leading-relaxed text-zinc-300 max-w-xl">
          {currentStep.description}
        </p>

        {interviewAt && currentStatus === "INTERVIEW" && (
          <div className="relative z-10 mt-4 flex items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-500/20 px-3.5 py-2 text-xs font-medium text-amber-200">
            <CalendarCheck className="size-4 shrink-0 text-amber-300" />
            <span>Entrevista marcada para: <strong className="text-white">{formatInterviewLong(interviewAt)}</strong></span>
          </div>
        )}
      </div>

      {/* Linha do tempo vertical: a mais adequada e profissional para celular e desktop */}
      <div className="p-6 sm:p-7 bg-[#fafaf9]">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#71717a] mb-5">
          Linha do tempo das etapas
        </h3>

        <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:bottom-3 before:top-3 before:left-[13px] sm:before:left-[17px] before:w-0.5 before:bg-[#e4e4e7]">
          {sortedEvents.map((event, idx) => {
            const step = getStepDetails(event.from, event.to);
            const isLast = idx === sortedEvents.length - 1;
            const Icon = step.icon;
            const date = new Date(event.createdAt);

            return (
              <div key={event.id} className="relative group">
                {/* Ícone no conector */}
                <div
                  className={`absolute -left-6 sm:-left-8 top-1 flex size-7 sm:size-8 items-center justify-center rounded-full border-2 transition-all ${
                    isLast
                      ? "border-white bg-[#0a0a0a] text-white shadow-md ring-4 ring-black/5"
                      : "border-white bg-[#e4e4e7] text-[#71717a]"
                  }`}
                  style={
                    isLast
                      ? {
                          backgroundColor: "var(--brand-primary, #0a0a0a)",
                        }
                      : undefined
                  }
                >
                  {isLast ? (
                    <Icon className="size-3.5 sm:size-4" />
                  ) : (
                    <CheckCircle2 className="size-3.5 sm:size-4 text-[#15803d]" />
                  )}
                </div>

                {/* Card da etapa */}
                <div
                  className={`rounded-2xl border p-4 sm:p-5 transition-all ${
                    isLast
                      ? "border-[#d4d4d8] bg-white shadow-sm"
                      : "border-[#e4e4e7] bg-white/70"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm sm:text-base font-bold text-[#0a0a0a]">
                        {step.label}
                      </span>
                      {isLast && (
                        <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          Etapa atual
                        </span>
                      )}
                    </div>
                    <time className="text-xs font-medium text-[#71717a]">
                      {formatAppliedAt(date, true)}
                    </time>
                  </div>

                  <p className="mt-1.5 text-xs sm:text-[13px] leading-relaxed text-[#52525b]">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
