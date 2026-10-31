"use client";

import { useMemo, useState } from "react";
import {
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
} from "lucide-react";

import { parseJobDescription, type ParsedSection } from "@/server/models/job-description.model";

export function StructuredJobDescription({
  text,
  collapsible = false,
  compact = false,
}: {
  text: string;
  collapsible?: boolean;
  compact?: boolean;
}) {
  const sections = useMemo(() => parseJobDescription(text), [text]);
  const [expanded, setExpanded] = useState(false);

  // Se o texto não tem seções estruturadas identificadas, exibe formatado
  const isLong = text.length > 420;
  const shouldTruncate = collapsible && isLong && !expanded;

  return (
    <div className="space-y-4">
      {sections.map((sec, idx) => {
        // Se estiver colapsado, exibe apenas os 2 primeiros blocos
        if (shouldTruncate && idx > 1) return null;

        if (sec.type === "intro") {
          return (
            <div
              key={idx}
              className="rounded-xl border border-stone-200/80 bg-stone-50/60 p-4 text-[13.5px] leading-relaxed text-[#44403c]"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1c1917] mb-1.5">
                <Briefcase className="size-3.5 text-stone-600" />
                <span>Sobre a oportunidade</span>
              </div>
              <p className="whitespace-pre-line text-[#57534e]">{sec.content}</p>
            </div>
          );
        }

        if (sec.type === "jornada") {
          return (
            <div
              key={idx}
              className="flex items-start gap-3 rounded-xl border border-amber-200/70 bg-gradient-to-r from-amber-50/80 to-amber-50/30 p-3.5 text-[13px] text-amber-950 shadow-sm"
            >
              <Clock className="size-4 shrink-0 text-amber-700 mt-0.5" />
              <div className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-amber-900">
                  {sec.title || "Jornada de Trabalho"}
                </span>
                <p className="mt-0.5 leading-snug text-amber-900/90 font-medium whitespace-pre-line">
                  {sec.content}
                </p>
              </div>
            </div>
          );
        }

        if (sec.type === "atividades") {
          return (
            <div
              key={idx}
              className="rounded-xl border border-[#ebe7e3] bg-white p-4 shadow-[0_2px_8px_rgba(28,25,23,0.03)]"
            >
              <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-[#1c1917]">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                <span>{sec.title || "Principais Atividades"}</span>
              </div>
              {sec.items ? (
                <ul className="mt-2.5 space-y-2">
                  {sec.items.map((item, itemIdx) => (
                    <li
                      key={itemIdx}
                      className="flex items-start gap-2.5 text-[13px] leading-relaxed text-[#44403c]"
                    >
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[13px] leading-relaxed text-[#57534e] whitespace-pre-line">
                  {sec.content}
                </p>
              )}
            </div>
          );
        }

        if (sec.type === "beneficios") {
          return (
            <div
              key={idx}
              className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 text-[13px] text-indigo-950"
            >
              <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-indigo-900">
                <Sparkles className="size-3.5 text-indigo-600 shrink-0" />
                <span>{sec.title || "Benefícios & Vantagens"}</span>
              </div>
              {sec.items ? (
                <ul className="mt-2.5 space-y-2">
                  {sec.items.map((item, itemIdx) => (
                    <li
                      key={itemIdx}
                      className="flex items-start gap-2.5 text-[13px] leading-relaxed text-indigo-950/90"
                    >
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-indigo-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[13px] leading-relaxed text-indigo-950/90 whitespace-pre-line">
                  {sec.content}
                </p>
              )}
            </div>
          );
        }

        return (
          <p
            key={idx}
            className="text-[13.5px] leading-relaxed text-[#57534e] whitespace-pre-line"
          >
            {sec.content}
          </p>
        );
      })}

      {collapsible && isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1c1917] hover:text-[#57534e] transition-colors pt-1"
        >
          {expanded ? (
            <>
              Mostrar menos <ChevronUp className="size-3.5" />
            </>
          ) : (
            <>
              Ver descrição completa ({sections.length} seções) <ChevronDown className="size-3.5" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
