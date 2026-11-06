"use client";

import { useState, useTransition } from "react";
import { Bot, Check, Loader2, Sparkles } from "lucide-react";
import { toggleCandidateAiRadarAction } from "@/server/controllers/settings.controller";

interface CandidateAiToggleProps {
  initialEnabled: boolean;
}

export function CandidateAiToggle({ initialEnabled }: CandidateAiToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();
  const [savedMessage, setSavedMessage] = useState(false);

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      const res = await toggleCandidateAiRadarAction(next);
      if (res.ok) {
        setSavedMessage(true);
        setTimeout(() => setSavedMessage(false), 3000);
      } else {
        setEnabled(!next); // reverte em caso de erro
      }
    });
  }

  return (
    <div className="mt-6 rounded-2xl border border-[#e4e4e7] bg-white p-6 shadow-xs">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-900 border border-purple-200">
            <Bot className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#0a0a0a]">
                Central de IA & Simulador de Bots na Área do Candidato
              </h3>
              {savedMessage && (
                <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                  <Check className="size-3" /> Salvo
                </span>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[#71717a]">
              Permite que os candidatos visualizem em seus painéis a Central de Inteligência Artificial com os
              agentes (Lexis, Synapse e Router), demonstrando de forma transparente como suas competências e
              estabilidade são valorizadas.
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={isPending}
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            enabled ? "bg-[#0a0a0a]" : "bg-[#e4e4e7]"
          } ${isPending ? "opacity-60 cursor-wait" : ""}`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[#f4f4f5] pt-3 text-[11px] text-[#71717a]">
        <span className="flex items-center gap-1.5 font-medium text-[#52525b]">
          <Sparkles className="size-3 text-purple-600" />
          Status atual para seus candidatos:
        </span>
        <span
          className={`font-bold ${
            enabled ? "text-emerald-700" : "text-[#71717a]"
          }`}
        >
          {enabled ? "● Exibindo na Área do Candidato" : "○ Oculto na Área do Candidato"}
        </span>
      </div>
    </div>
  );
}
