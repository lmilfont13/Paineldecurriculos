"use client";

import { useState } from "react";
import {
  HelpCircle,
  X,
  Info,
  CheckCircle2,
  AlertTriangle,
  MinusCircle,
  AlertCircle,
  Sparkles,
} from "lucide-react";

export type ScoreTier = {
  min: number;
  max: number;
  label: string;
  badge: string;
  color: string;
  bgLight: string;
  borderColor: string;
  textColor: string;
  barColor: string;
  description: string;
};

export const SCORE_RULER_TIERS: ScoreTier[] = [
  {
    min: 90,
    max: 100,
    label: "Excelente Aderência",
    badge: "90 a 100",
    color: "emerald",
    bgLight: "bg-emerald-50",
    borderColor: "border-emerald-200",
    textColor: "text-emerald-800",
    barColor: "bg-emerald-500",
    description: "Atende todos os critérios essenciais, com experiência comprovada na função.",
  },
  {
    min: 70,
    max: 89,
    label: "Forte Alinhamento",
    badge: "70 a 89",
    color: "blue",
    bgLight: "bg-blue-50",
    borderColor: "border-blue-200",
    textColor: "text-blue-800",
    barColor: "bg-blue-500",
    description: "Atende a maioria dos critérios, falta pouco para o ideal.",
  },
  {
    min: 50,
    max: 69,
    label: "Aderência Parcial",
    badge: "50 a 69",
    color: "amber",
    bgLight: "bg-amber-50",
    borderColor: "border-amber-200",
    textColor: "text-amber-800",
    barColor: "bg-amber-500",
    description: "Atende parcialmente, precisaria de treinamento relevante.",
  },
  {
    min: 30,
    max: 49,
    label: "Perfil Distante",
    badge: "30 a 49",
    color: "orange",
    bgLight: "bg-orange-50",
    borderColor: "border-orange-200",
    textColor: "text-orange-800",
    barColor: "bg-orange-500",
    description: "Atende poucos critérios, perfil distante dos requisitos da vaga.",
  },
  {
    min: 0,
    max: 29,
    label: "Insuficiente",
    badge: "0 a 29",
    color: "slate",
    bgLight: "bg-slate-100",
    borderColor: "border-slate-200",
    textColor: "text-slate-700",
    barColor: "bg-slate-400",
    description: "Não atende aos critérios essenciais ou material sem informação suficiente para avaliar.",
  },
];

export function getScoreTier(score: number | null | undefined): ScoreTier | null {
  if (typeof score !== "number" || isNaN(score)) return null;
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return SCORE_RULER_TIERS.find((t) => clamped >= t.min && clamped <= t.max) ?? SCORE_RULER_TIERS[4];
}

/**
 * Card completo com a régua visual e a tabela de faixas
 */
export function ScoreRulerCard({
  highlightScore,
  compact = false,
}: {
  highlightScore?: number | null;
  compact?: boolean;
}) {
  const currentTier = getScoreTier(highlightScore);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs shadow-2xs">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-slate-800 text-white">
            <Sparkles className="size-3.5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900">Régua de Notas da IA</h4>
            <p className="text-[11px] text-slate-500">Critérios padronizados de calibração</p>
          </div>
        </div>
        {typeof highlightScore === "number" && currentTier && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${currentTier.bgLight} ${currentTier.textColor} border ${currentTier.borderColor}`}
          >
            Nota {highlightScore}: {currentTier.label}
          </span>
        )}
      </div>

      {/* Barra visual gradiente com as 5 faixas */}
      <div className="mt-3">
        <div className="flex h-2.5 w-full overflow-hidden rounded-full ring-1 ring-slate-900/5">
          <div className="w-[30%] bg-slate-400" title="0 a 29: Insuficiente" />
          <div className="w-[20%] bg-orange-400" title="30 a 49: Perfil Distante" />
          <div className="w-[20%] bg-amber-400" title="50 a 69: Aderência Parcial" />
          <div className="w-[20%] bg-blue-500" title="70 a 89: Forte Alinhamento" />
          <div className="w-[10%] bg-emerald-500" title="90 a 100: Excelente Aderência" />
        </div>
        <div className="mt-1 flex justify-between text-[10px] font-semibold text-slate-600">
          <span>0</span>
          <span>30</span>
          <span>50</span>
          <span>70</span>
          <span>90</span>
          <span>100</span>
        </div>
      </div>

      {/* Lista detalhada das faixas */}
      <div className={`mt-3 divide-y divide-slate-100 ${compact ? "space-y-1" : "space-y-2"}`}>
        {SCORE_RULER_TIERS.map((tier) => {
          const isSelected = currentTier?.badge === tier.badge;
          return (
            <div
              key={tier.badge}
              className={`flex items-start gap-2.5 pt-2 transition-colors ${
                isSelected ? "rounded-lg bg-slate-50 p-2 font-medium" : ""
              }`}
            >
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums ${tier.bgLight} ${tier.textColor} border ${tier.borderColor}`}
              >
                {tier.badge}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-800 text-[11.5px]">{tier.label}</span>
                  {isSelected && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1 rounded">
                      atual
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
                  {tier.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600 border border-slate-200/80">
        💡 <strong>Critério Ético:</strong> A IA avalia puramente habilidades e experiências contra os requisitos da vaga. Nome, gênero, idade, foto e dados pessoais são sempre desconsiderados.
      </div>
    </div>
  );
}

/**
 * Modal flutuante com a régua de notas
 */
export function ScoreRulerModal({
  open,
  onClose,
  highlightScore,
}: {
  open: boolean;
  onClose: () => void;
  highlightScore?: number | null;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-slate-800 text-white shadow-xs">
              <Sparkles className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Régua de Avaliação de Notas
              </h3>
              <p className="text-[11px] text-slate-500">
                Critérios de calibração utilizados pela IA
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 max-h-[80vh] overflow-y-auto">
          <ScoreRulerCard highlightScore={highlightScore} />
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Botão acionador discreto com ícone de ajuda/escala que abre o modal da régua
 */
export function ScoreRulerTrigger({
  highlightScore,
  className = "",
  label = "Régua da IA",
  variant = "subtle",
}: {
  highlightScore?: number | null;
  className?: string;
  label?: string;
  variant?: "subtle" | "pill" | "icon";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Ver Régua de Notas da IA"
          className={`flex size-6 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-700 transition ${className}`}
        >
          <HelpCircle className="size-3.5" />
        </button>
      ) : variant === "pill" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs ${className}`}
        >
          <Sparkles className="size-3 text-amber-500" />
          <span>{label}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-800 underline underline-offset-2 transition ${className}`}
        >
          <HelpCircle className="size-3 text-slate-400" />
          <span>{label}</span>
        </button>
      )}

      <ScoreRulerModal
        open={open}
        onClose={() => setOpen(false)}
        highlightScore={highlightScore}
      />
    </>
  );
}
