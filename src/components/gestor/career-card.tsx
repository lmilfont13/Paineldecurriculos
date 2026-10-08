"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Compass, Loader2, RefreshCw } from "lucide-react";

import { MatchScore, type StandbyMatch } from "@/components/gestor/talent-pool-card";
import { analyzeCareerAction } from "@/server/controllers/talent.controller";
import type { CareerProfile } from "@/server/models/career.model";

/**
 * Agente de perfil no detalhe do candidato: para qual área a pessoa seria um
 * bom candidato, com nota estimada, e em que vaga seria bem aproveitada.
 * Sob demanda (botão), para qualquer candidato.
 */
export function CareerCard({
  applicationId,
  career,
  matches,
}: {
  applicationId: string;
  career: CareerProfile | null;
  matches: StandbyMatch[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function analyze() {
    setError(null);
    startTransition(async () => {
      const result = await analyzeCareerAction(applicationId);
      if (!result.ok) setError(result.error);
    });
  }

  const analyzedAt = career?.analyzedAt
    ? new Date(career.analyzedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    : null;

  return (
    <section className="rounded-2xl border border-[#e4e4e7] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#0a0a0a]">
            <Compass className="size-4 text-[#a1a1aa]" aria-hidden /> Perfil profissional
          </h2>
          <p className="mt-0.5 text-[12px] text-[#71717a]">
            Onde esta pessoa seria um bom candidato, além desta vaga. Leitura geral do currículo; não muda a nota nem a etapa.
          </p>
        </div>
        {career && (
          <button
            type="button"
            onClick={analyze}
            disabled={pending}
            title="Analisar de novo"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[#71717a] ring-1 ring-[#e4e4e7] hover:bg-[#fafafa] hover:text-[#0a0a0a] disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            {pending ? "Analisando…" : analyzedAt ? `Analisado em ${analyzedAt}` : "Analisar de novo"}
          </button>
        )}
      </div>

      {!career ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={analyze}
            disabled={pending}
            className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-semibold hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Compass className="size-4" />}
            {pending ? "O agente está lendo o currículo…" : "Analisar perfil com o agente"}
          </button>
          <p className="mt-2 text-[11px] text-[#a1a1aa]">
            Leva uns 15 segundos. Diz as áreas em que a pessoa se sairia bem, com nota estimada, e compara com até 3
            vagas abertas parecidas.
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-4 space-y-3">
            {career.areas.map((a, i) => (
              <li key={a.area}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-semibold text-[#0a0a0a]">
                    {i === 0 && <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-[0.5px] text-[#1f7a4d]">melhor área</span>}
                    {a.area}
                  </span>
                  <span className="text-[13px] font-bold tabular-nums text-[#0a0a0a]">{a.score}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#f4f4f5]" aria-hidden>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${a.score}%`,
                      backgroundColor: i === 0 ? "var(--brand-primary)" : "#a1a1aa",
                    }}
                  />
                </div>
                {a.why && <p className="mt-1 text-[12px] leading-5 text-[#71717a]">{a.why}</p>}
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-xl bg-[#fafaf9] px-4 py-3 ring-1 ring-[#f4f4f5]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[#a1a1aa]">
              Seria bem aproveitado em
            </p>
            <p className="mt-1 text-[13px] leading-6 text-[#0a0a0a]">{career.summary}</p>
            {career.roles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {career.roles.map((r) => (
                  <span key={r} className="rounded-full bg-white px-2.5 py-1 text-[11px] text-[#0a0a0a] ring-1 ring-[#e4e4e7]">
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5">
            <p className="text-[11px] font-semibold text-[#0a0a0a]">Vagas abertas comparadas</p>
            {matches.length === 0 ? (
              <p className="mt-1 text-[12px] text-[#71717a]">Nenhuma outra vaga aberta parecida agora.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {matches.map((m) => (
                  <li key={m.jobId} className="flex items-center justify-between gap-2 text-[12px]">
                    <Link href={`/vagas/${m.jobId}`} className="min-w-0 truncate text-[#0a0a0a] hover:underline">
                      {m.jobTitle}
                    </Link>
                    <MatchScore match={m} />
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11px] text-[#a1a1aa]">
              A nota por área é uma estimativa geral. A nota de cada vaga usa os critérios dela, como na triagem.
            </p>
          </div>
        </>
      )}

      {error && (
        <p className="mt-3 text-[12px] text-[#c23b3b]" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
