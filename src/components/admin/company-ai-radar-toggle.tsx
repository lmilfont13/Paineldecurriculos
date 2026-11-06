"use client";

import { useState, useTransition } from "react";
import { Bot, Check, Sparkles } from "lucide-react";
import { toggleCompanyCandidateAiRadarAction } from "@/server/controllers/settings.controller";

interface CompanyAiRadarToggleProps {
  companyId: string;
  initialEnabled: boolean;
}

export function CompanyAiRadarToggle({
  companyId,
  initialEnabled,
}: CompanyAiRadarToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      const res = await toggleCompanyCandidateAiRadarAction(companyId, next);
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setEnabled(!next);
      }
    });
  }

  return (
    <div className="mt-6 rounded-xl border border-[#e4e4e7] bg-white p-5 shadow-2xs">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-purple-700" />
            <span className="text-xs font-bold text-[#0a0a0a]">
              Central de Bots na Área do Candidato
            </span>
            {saved && (
              <span className="flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                <Check className="size-2.5" /> Salvo
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[#71717a]">
            Exibe ou oculta a seção visual interativa de agentes de IA e simulação de triagem no portal do candidato deste tenant.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={isPending}
          onClick={handleToggle}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            enabled ? "bg-[#0a0a0a]" : "bg-[#e4e4e7]"
          } ${isPending ? "opacity-60 cursor-wait" : ""}`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              enabled ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
