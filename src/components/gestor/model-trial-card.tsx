"use client";

import { useState, useTransition } from "react";
import { FlaskConical, Loader2 } from "lucide-react";

import { runModelTrialAction } from "@/server/controllers/settings.controller";
import { explainAiError, verdictCopy, type TrialScore, type TrialVerdict } from "@/server/models/model-trial.model";
import type { ModelTrialResult } from "@/server/services/model-trial.service";

type Option = { id: string; label: string; available: boolean };

const VERDICT_STYLE: Record<TrialVerdict, string> = {
  SUFFICIENT: "border-[#b7e0c8] bg-[#e8f5ee] text-[#1f6b45]",
  REVIEW: "border-[#f0dcae] bg-[#fdf6e7] text-[#8a5d10]",
  INSUFFICIENT: "border-[#f0c4c0] bg-[#fbeae8] text-[#a83232]",
  INCONCLUSIVE: "border-[#e4e4e7] bg-[#fafaf9] text-[#57534e]",
};

const scoreText = (s: TrialScore) => ("score" in s ? String(s.score) : "erro");

/**
 * Testar um modelo antes de trocar: compara, nos últimos candidatos, a nota do
 * modelo atual com a do modelo escolhido. Não grava nada.
 */
export function ModelTrialCard({ options, labelFor }: { options: Option[]; labelFor: Record<string, string> }) {
  const choices = options.filter((o) => o.available);
  const [model, setModel] = useState(choices.find((o) => o.id === "claude-haiku-5-5")?.id ?? choices[0]?.id ?? "");
  const [result, setResult] = useState<ModelTrialResult | null>(null);
  const [pending, start] = useTransition();

  function run() {
    setResult(null);
    start(async () => {
      try {
        setResult(await runModelTrialAction(model));
      } catch {
        setResult({ ok: false, error: "O teste demorou demais ou a conexão caiu. Tente de novo." });
      }
    });
  }

  const ok = result?.ok ? result : null;
  const flagged = new Set(ok?.summary.flagged ?? []);
  // Erros do modelo em teste, agrupados pelo motivo (o mais comum primeiro).
  const errorGroups = (() => {
    if (!ok) return [];
    const counts = new Map<string, { reason: string; action: string; detail: string; count: number }>();
    for (const r of ok.rows) {
      if ("error" in r.candidate) {
        const e = explainAiError(r.candidate.error);
        const cur = counts.get(e.reason);
        if (cur) cur.count += 1;
        else counts.set(e.reason, { ...e, detail: r.candidate.error, count: 1 });
      }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
  })();

  return (
    <section className="mt-6 rounded-2xl border border-[#e4e4e7] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#f4f4f5]">
          <FlaskConical className="size-4 text-[#57534e]" />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold text-[#0a0a0a]">Testar outro modelo antes de trocar</h2>
          <p className="mt-1 text-[13px] leading-5 text-[#71717a]">
            Os últimos 10 candidatos com currículo são avaliados agora pelo modelo atual e pelo escolhido, com o mesmo
            critério. Nada é salvo: nenhuma nota ou etapa muda. Leva cerca de 1 minuto e custa centavos.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={pending}
          className="h-10 rounded-xl border border-[#e4e4e7] bg-white px-3 text-[13px] focus:border-[#0a0a0a] focus:outline-none"
        >
          {choices.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={run}
          disabled={pending || !model}
          className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-semibold disabled:opacity-60"
          style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          {pending ? "Testando… (até 1 minuto)" : "Rodar teste"}
        </button>
      </div>

      {result && !result.ok && (
        <p role="alert" className="mt-4 text-[13px] text-[#c23b3b]">
          {result.error}
        </p>
      )}

      {ok && (
        <div className="mt-5">
          <div className={`rounded-xl border p-4 ${VERDICT_STYLE[ok.summary.verdict]}`}>
            <p className="text-[15px] font-semibold">
              {labelFor[ok.candidateModel] ?? ok.candidateModel}: {verdictCopy[ok.summary.verdict].title}
            </p>
            <p className="mt-1 text-[13px] leading-5">{verdictCopy[ok.summary.verdict].body}</p>
            <p className="mt-2 text-[12px] opacity-90">
              Mesma decisão (atende ou não a nota mínima) em{" "}
              <strong>
                {ok.summary.sameDecision} de {ok.summary.compared}
              </strong>{" "}
              candidatos
              {ok.summary.borderline > 0 && (
                <>
                  {" "}· {ok.summary.borderline} na linha de corte (notas perto do mínimo, variação normal)
                </>
              )}
              {ok.summary.meanAbsDiff !== null && (
                <>
                  {" "}· diferença média de <strong>{String(ok.summary.meanAbsDiff).replace(".", ",")} pontos</strong>
                </>
              )}
              {ok.summary.candidateErrors > 0 && <> · {ok.summary.candidateErrors} resposta(s) inválida(s) do modelo testado</>}
              .
            </p>
          </div>

          {errorGroups.length > 0 && (
            <div className="mt-4 rounded-xl border border-[#f0c4c0] bg-[#fbeae8] p-4 text-[#7a2424]">
              <p className="text-[13px] font-semibold">
                O {labelFor[ok.candidateModel] ?? "modelo testado"} não respondeu em{" "}
                {errorGroups.reduce((n, g) => n + g.count, 0)} de {ok.rows.length} candidatos
              </p>
              {errorGroups.map((g) => (
                <div key={g.reason} className="mt-2 text-[13px] leading-5">
                  <p>
                    <strong>Motivo:</strong> {g.reason} ({g.count}×)
                  </p>
                  <p>
                    <strong>O que fazer:</strong> {g.action}
                  </p>
                  <p className="mt-1 break-all font-mono text-[11px] opacity-80">Detalhe técnico: {g.detail}</p>
                </div>
              ))}
            </div>
          )}

          {/* Um cartão por candidato, as duas leituras lado a lado; discordâncias primeiro. */}
          <ul className="mt-4 space-y-2">
            {[...ok.rows]
              .sort((a, b) => Number(flagged.has(b.applicationId)) - Number(flagged.has(a.applicationId)))
              .map((r) => (
                <li
                  key={r.applicationId}
                  className={`rounded-xl border p-3 ${
                    flagged.has(r.applicationId) ? "border-[#f0dcae] bg-[#fffbf2]" : "border-[#e4e4e7]"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <a
                        href={`/candidaturas/${r.applicationId}`}
                        className="text-[13px] font-semibold text-[#0a0a0a] hover:underline"
                      >
                        {r.name}
                      </a>
                      {flagged.has(r.applicationId) && (
                        <span className="rounded-full bg-[#fdf0d2] px-2 py-0.5 text-[10px] font-semibold text-[#8a5d10]">
                          discordam: quem acertou?
                        </span>
                      )}
                    </div>
                    <span
                      className="text-[11px] tabular-nums text-[#a1a1aa]"
                      title={r.minIsDefault ? "Vaga sem nota mínima (banco de talentos): comparado com 60" : undefined}
                    >
                      {r.jobTitle} · mínimo {r.minScore}
                      {r.minIsDefault ? "*" : ""}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        [labelFor[ok.referenceModel] ?? "Atual", "atual", r.reference],
                        [labelFor[ok.candidateModel] ?? "Testado", "testado", r.candidate],
                      ] as const
                    ).map(([label, role, sc]) => {
                      const passes = "score" in sc && sc.score >= r.minScore;
                      return (
                        <div key={role} className="rounded-lg bg-white p-2.5 ring-1 ring-[#f0f0ef]">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[11px] font-medium text-[#71717a]">
                              {label} <span className="text-[#a1a1aa]">({role})</span>
                            </span>
                            <span className="flex items-baseline gap-1.5">
                              <span className="text-lg font-bold tabular-nums text-[#0a0a0a]">{scoreText(sc)}</span>
                              {"score" in sc && (
                                <span className={`text-[10px] font-semibold ${passes ? "text-[#1f7a4d]" : "text-[#c23b3b]"}`}>
                                  {passes ? "atende" : "não atende"}
                                </span>
                              )}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] leading-4 text-[#57534e]">
                            {"score" in sc ? sc.reasoning || "Sem justificativa." : explainAiError(sc.error).reason}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </li>
              ))}
          </ul>
          <p className="mt-2 text-[11px] text-[#a1a1aa]">
            {ok.rows.some((r) => r.minIsDefault) && "* Vaga sem nota mínima (banco de talentos): comparado com 60. "}
            Notas de IA variam alguns pontos até no mesmo modelo; o que pesa é a mesma decisão. Para desempatar, teste
            também um terceiro modelo (ex.: Claude Sonnet 5.5) e veja com qual dos dois ele concorda.
          </p>
        </div>
      )}
    </section>
  );
}
