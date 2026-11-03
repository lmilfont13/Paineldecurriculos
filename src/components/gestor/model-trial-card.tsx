"use client";

import { useState, useTransition } from "react";
import { FlaskConical, Loader2 } from "lucide-react";

import { runModelTrialAction } from "@/server/controllers/settings.controller";
import { verdictCopy, type TrialScore, type TrialVerdict } from "@/server/models/model-trial.model";
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

          <div className="mt-4 overflow-x-auto rounded-xl border border-[#e4e4e7]">
            <table className="w-full min-w-[480px] text-left text-[12px]">
              <thead className="bg-[#fafaf9] text-[11px] uppercase tracking-wider text-[#a1a1aa]">
                <tr>
                  <th className="px-3 py-2 font-semibold">Candidato</th>
                  <th className="px-3 py-2 text-right font-semibold">Mínimo</th>
                  <th className="px-3 py-2 text-right font-semibold">{labelFor[ok.referenceModel] ?? "Atual"}</th>
                  <th className="px-3 py-2 text-right font-semibold">{labelFor[ok.candidateModel] ?? "Teste"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f4f5]">
                {ok.rows.map((r) => (
                  <tr key={r.applicationId} className={flagged.has(r.applicationId) ? "bg-[#fdf6e7]" : ""}>
                    <td className="px-3 py-2">
                      <a href={`/candidaturas/${r.applicationId}`} className="font-medium text-[#0a0a0a] hover:underline">
                        {r.name}
                      </a>
                      {flagged.has(r.applicationId) && (
                        <span className="ml-2 text-[10px] font-semibold text-[#8a5d10]">olhar este</span>
                      )}
                      {"score" in r.candidate && r.candidate.reasoning && (
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-[#71717a]">{r.candidate.reasoning}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-[#a1a1aa]">{r.minScore}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{scoreText(r.reference)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{scoreText(r.candidate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-[#a1a1aa]">
            Notas de IA variam alguns pontos até no mesmo modelo; o que pesa é a mesma decisão. A justificativa abaixo do
            nome é a do modelo testado. Se gostar do resultado, troque o modelo acima.
          </p>
        </div>
      )}
    </section>
  );
}
