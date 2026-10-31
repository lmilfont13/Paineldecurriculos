"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { suggestComparisonAction } from "@/server/controllers/application.controller";
import type { ComparisonOutcome } from "@/server/services/compare.service";

const CONFIDENCE: Record<string, { label: string; cls: string }> = {
  alta: { label: "Confiança alta", cls: "bg-[#e4f6ec] text-[#1f7a4d]" },
  media: { label: "Confiança média", cls: "bg-[#fff7e6] text-[#a16207]" },
  baixa: { label: "Confiança baixa", cls: "bg-[#fbeae8] text-[#c23b3b]" },
};

/** "Qual escolher?": a IA compara os candidatos da tela e sugere um, com os motivos. A decisão é do gestor. */
export function CompareSuggestion({ ids }: { ids: string[] }) {
  const [outcome, setOutcome] = useState<ComparisonOutcome | null>(null);
  const [pending, start] = useTransition();
  const started = useRef(false);

  function run() {
    setOutcome(null);
    start(async () => setOutcome(await suggestComparisonAction(ids)));
  }

  // Roda sozinha ao abrir a comparação (uma vez).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recommended =
    outcome?.ok && outcome.recommendedId
      ? outcome.candidates.find((c) => c.id === outcome.recommendedId)
      : null;

  return (
    <section className="mt-6 rounded-2xl border border-[#e4e4e7] bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#0a0a0a]">Qual escolher? Sugestão da IA</h2>
          <p className="mt-1 text-[12px] text-[#71717a]">
            A IA compara os candidatos entre si e com a vaga. Ela só sugere: nota e etapa não mudam e a decisão é sua.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="h-9 rounded-xl border border-[#e4e4e7] bg-white px-4 text-[12px] font-medium text-[#0a0a0a] hover:border-[#0a0a0a] disabled:opacity-50"
        >
          {pending ? "Analisando…" : "Gerar de novo"}
        </button>
      </div>

      {pending && !outcome && (
        <div className="mt-5 space-y-2" aria-live="polite">
          <p className="text-[13px] text-[#71717a]">Comparando os candidatos. Leva alguns segundos…</p>
          <div className="h-3 w-2/3 animate-pulse rounded bg-[#f1f0ed]" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-[#f1f0ed]" />
        </div>
      )}

      {outcome && !outcome.ok && (
        <p role="alert" className="mt-5 text-[13px] text-[#c23b3b]">
          {outcome.error}
        </p>
      )}

      {outcome?.ok && (
        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-2">
            {recommended ? (
              <p className="text-[18px] font-semibold text-[#0a0a0a]">
                Recomendado: <span style={{ color: "var(--brand-primary)" }}>{recommended.name}</span>
              </p>
            ) : (
              <p className="text-[18px] font-semibold text-[#0a0a0a]">Empate técnico: a IA não indica um só</p>
            )}
            <span className={"rounded-full px-2.5 py-0.5 text-[11px] font-medium " + CONFIDENCE[outcome.confidence].cls}>
              {CONFIDENCE[outcome.confidence].label}
            </span>
            {outcome.source === "numeros" && (
              <span className="rounded-full bg-[#f1f0ed] px-2.5 py-0.5 text-[11px] font-medium text-[#71717a]">
                calculado pelos números
              </span>
            )}
          </div>

          <p className="mt-2 text-[14px] leading-6 text-[#3f3f46]">{outcome.summary}</p>

          {outcome.reasons.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#a1a1aa]">Motivos</p>
              <ul className="mt-2 space-y-1.5 text-[13px] leading-5 text-[#0a0a0a]">
                {outcome.reasons.map((r) => (
                  <li key={r} className="flex gap-2">
                    <span className="mt-[7px] size-1.5 shrink-0 rounded-full" style={{ backgroundColor: "var(--brand-primary)" }} />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {outcome.candidates.some((c) => c.strengths.length > 0 || c.concerns.length > 0 || c.whyNot) && (
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {outcome.candidates.map((c) => (
                <div
                  key={c.id}
                  className={
                    "rounded-xl border p-4 text-[12px] leading-5 " +
                    (c.id === outcome.recommendedId ? "border-[#0a0a0a]" : "border-[#ebe7e3]")
                  }
                >
                  <p className="text-[13px] font-semibold text-[#0a0a0a]">{c.name}</p>
                  {c.strengths.length > 0 && (
                    <ul className="mt-2 space-y-1 text-[#1f7a4d]">
                      {c.strengths.map((s) => (
                        <li key={s}>✓ {s}</li>
                      ))}
                    </ul>
                  )}
                  {c.concerns.length > 0 && (
                    <ul className="mt-2 space-y-1 text-[#a16207]">
                      {c.concerns.map((s) => (
                        <li key={s}>! {s}</li>
                      ))}
                    </ul>
                  )}
                  {c.whyNot && c.id !== outcome.recommendedId && (
                    <p className="mt-2 text-[#71717a]">Por que não: {c.whyNot}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {outcome.checkNext && (
            <p className="mt-4 rounded-lg bg-[#fdfaf3] px-4 py-3 text-[12px] leading-5 text-[#7a5a14]">
              <strong>Confirme na entrevista:</strong> {outcome.checkNext}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
