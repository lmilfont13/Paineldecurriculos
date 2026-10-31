"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { analyzeShortlistAction } from "@/server/controllers/job.controller";
import { appStatusLabels, type AppStatusKey } from "@/server/models/application.model";
import type { ShortlistResult } from "@/server/services/shortlist.service";

const COUNTS = [3, 5, 10] as const;

/** Compara os candidatos da vaga e mostra os melhores. A IA só sugere; a decisão é do gestor. */
export function ShortlistPanel({
  jobId,
  candidateCount,
}: {
  jobId: string;
  candidateCount: number;
}) {
  const [topN, setTopN] = useState<number>(5);
  const [result, setResult] = useState<ShortlistResult | null>(null);
  const [pending, start] = useTransition();
  const canAnalyze = candidateCount >= 2;

  function analyze() {
    setResult(null);
    start(async () => setResult(await analyzeShortlistAction(jobId, topN)));
  }

  return (
    <section className="mt-10 rounded-xl border border-[#e4e4e7] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[560px]">
          <h2 className="text-[15px] font-semibold text-[#0a0a0a]">
            Melhores candidatos (IA)
          </h2>
          <p className="mt-1 text-[12px] leading-5 text-[#71717a]">
            A IA compara os candidatos desta vaga entre si e indica os mais fortes, com o
            motivo. Ela só sugere: nota e etapa não mudam e a decisão é sua.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-[12px] text-[#71717a]">
            Mostrar
            <select
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
              disabled={pending}
              className="h-9 rounded-lg border border-[#e4e4e7] bg-white px-2 text-[13px] text-[#0a0a0a] focus:border-[#0a0a0a] focus:outline-none"
            >
              {COUNTS.map((n) => (
                <option key={n} value={n}>
                  os {n} melhores
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={analyze}
            disabled={pending || !canAnalyze}
            className="flex h-9 items-center gap-2 rounded-xl px-4 text-[12px] font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
          >
            {pending ? (
              <>
                <span className="size-3 animate-spin rounded-full border border-current border-t-transparent" />
                Analisando…
              </>
            ) : (
              <>✦ Analisar candidatos</>
            )}
          </button>
        </div>
      </div>

      {!canAnalyze && (
        <p className="mt-4 text-[12px] text-[#a1a1aa]">
          Precisa de pelo menos 2 candidatos nesta vaga para comparar.
        </p>
      )}

      {pending && (
        <p className="mt-4 text-[12px] text-[#71717a]">
          Lendo os currículos e comparando. Leva alguns segundos.
        </p>
      )}

      {result && !result.ok && (
        <p role="alert" className="mt-4 text-[13px] text-[#c23b3b]">
          {result.error}
        </p>
      )}

      {result?.ok && (
        <div className="mt-5">
          <ol className="space-y-3">
            {result.picks.map((pick) => (
              <li
                key={pick.applicationId}
                className="rounded-xl border border-[#ebe7e3] bg-[#fdfcfb] p-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                    style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
                  >
                    {pick.rank}
                  </span>
                  <Link
                    href={`/candidaturas/${pick.applicationId}`}
                    className="text-[14px] font-semibold text-[#0a0a0a] underline-offset-2 hover:underline"
                  >
                    {pick.name}
                  </Link>
                  {pick.aiScore !== null && (
                    <span className="rounded-full bg-[#f1f0ed] px-2 py-0.5 text-[11px] font-medium text-[#57534e]">
                      nota {pick.aiScore}
                    </span>
                  )}
                  <span className="text-[11px] text-[#a1a1aa]">
                    {appStatusLabels[pick.status as AppStatusKey] ?? pick.status}
                  </span>
                </div>
                {pick.reason && (
                  <p className="mt-2 text-[13px] leading-6 text-[#3f3f46]">{pick.reason}</p>
                )}
                {(pick.strengths.length > 0 || pick.concerns.length > 0) && (
                  <div className="mt-2 grid gap-3 text-[12px] leading-5 sm:grid-cols-2">
                    {pick.strengths.length > 0 && (
                      <ul className="space-y-1 text-[#1f7a4d]">
                        {pick.strengths.map((s) => (
                          <li key={s}>✓ {s}</li>
                        ))}
                      </ul>
                    )}
                    {pick.concerns.length > 0 && (
                      <ul className="space-y-1 text-[#a16207]">
                        {pick.concerns.map((c) => (
                          <li key={c}>! {c}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[11px] text-[#a1a1aa]">
            A IA leu {result.analyzed} de {result.total} candidatos (os de maior nota
            primeiro; reprovados ficam de fora). Cada análise pode dar um resultado um pouco diferente.
          </p>
        </div>
      )}
    </section>
  );
}
