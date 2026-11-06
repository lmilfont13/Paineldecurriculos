"use client";

import { Check, Clock, Calendar, Sparkles, Award, FolderHeart } from "lucide-react";
import type { AppStatusKey } from "@/server/models/application.model";
import { formatInterviewAt } from "@/server/models/interview.model";

interface CandidateApplicationTimelineProps {
  status: AppStatusKey;
  interviewAt?: Date | null;
  enabled?: boolean;
}

export function CandidateApplicationTimeline({
  status,
  interviewAt,
  enabled = true,
}: CandidateApplicationTimelineProps) {
  if (!enabled) return null;

  // Determina o estágio ativo (0 a 3)
  // 0: Inscrição enviada
  // 1: Em análise
  // 2: Entrevista
  // 3: Concluído (Aprovado ou Banco de Talentos)
  let activeStep = 1;
  let isApproved = false;
  let isRejected = false;

  switch (status) {
    case "PENDING":
      activeStep = 1;
      break;
    case "SHORTLISTED":
      activeStep = 1;
      break;
    case "INTERVIEW":
      activeStep = 2;
      break;
    case "APPROVED":
      activeStep = 3;
      isApproved = true;
      break;
    case "REJECTED":
      activeStep = 3;
      isRejected = true;
      break;
    case "STANDBY":
      activeStep = 2;
      break;
    default:
      activeStep = 1;
  }

  const steps = [
    {
      title: "Inscrição",
      subtitle: "Currículo recebido",
      icon: Check,
    },
    {
      title: "Em análise",
      subtitle: status === "SHORTLISTED" ? "Perfil selecionado" : "Avaliação do RH",
      icon: Sparkles,
    },
    {
      title: "Entrevista",
      subtitle: interviewAt ? formatInterviewAt(interviewAt) : "Conversa agendada",
      icon: Calendar,
    },
    {
      title: isApproved ? "Aprovado!" : isRejected ? "Banco de Talentos" : "Resultado",
      subtitle: isApproved ? "Parabéns!" : isRejected ? "Guardado para vagas" : "Etapa final",
      icon: isApproved ? Award : isRejected ? FolderHeart : Clock,
    },
  ];

  return (
    <div className="mt-4 rounded-2xl border border-[#e8e3de] bg-[#fdfcfa] p-4 sm:p-5">
      <div className="flex items-center justify-between pb-3 border-b border-[#f0ece7]">
        <div className="flex items-center gap-2">
          <span className="flex size-2 rounded-full bg-[#15803d] animate-pulse" />
          <p className="text-xs font-bold text-[#1c1917]">Rastreamento do Processo</p>
        </div>
        <span className="text-[11px] font-medium text-[#78716c]">
          {status === "PENDING" && "Currículo em triagem"}
          {status === "SHORTLISTED" && "Você avançou para análise detalhada!"}
          {status === "INTERVIEW" && "Fase de entrevistas"}
          {status === "APPROVED" && "Contratação aprovada 🎉"}
          {status === "REJECTED" && "Currículo mantido no Banco de Dados"}
          {status === "STANDBY" && "Perfil em lista de espera prioritária"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 relative">
        {steps.map((step, idx) => {
          const isDone = activeStep > idx || (activeStep === 3 && idx === 3 && isApproved);
          const isCurrent = activeStep === idx && !(activeStep === 3 && isRejected);
          const isFuture = activeStep < idx;
          const Icon = step.icon;

          return (
            <div key={step.title} className="flex flex-col items-center text-center relative z-10">
              {/* Círculo do passo */}
              <div
                className={`flex size-8 sm:size-9 items-center justify-center rounded-full transition-all duration-300 ${
                  isDone
                    ? "bg-[#1f7a4d] text-white shadow-xs"
                    : isCurrent
                      ? "border-2 text-white shadow-xs"
                      : isRejected && idx === 3
                        ? "bg-[#f4f4f5] border border-[#d4d4d8] text-[#71717a]"
                        : "border border-[#d4d4d8] bg-white text-[#a1a1aa]"
                }`}
                style={
                  isCurrent
                    ? {
                        backgroundColor: "var(--brand-primary, #0a0a0a)",
                        borderColor: "var(--brand-primary, #0a0a0a)",
                      }
                    : undefined
                }
              >
                {isDone ? (
                  <Check className="size-4" strokeWidth={2.5} />
                ) : (
                  <Icon className="size-3.5 sm:size-4" />
                )}
              </div>

              {/* Título e Subtítulo */}
              <p
                className={`mt-2 text-[11px] sm:text-xs font-semibold leading-tight ${
                  isDone || isCurrent ? "text-[#1c1917]" : "text-[#a8a29e]"
                }`}
              >
                {step.title}
              </p>
              <p className="mt-0.5 text-[9px] sm:text-[10px] text-[#78716c] truncate max-w-full">
                {step.subtitle}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

