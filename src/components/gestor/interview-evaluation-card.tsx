"use client";

import { useState, useTransition } from "react";
import { Plus, Star, X } from "lucide-react";

import { saveInterviewEvaluationAction } from "@/server/controllers/application.controller";
import {
  MAX_CRITERIA,
  RECOMMENDATIONS,
  averageScore,
  recommendationLabels,
  scoreLabels,
  type EvaluationCriterion,
  type Recommendation,
} from "@/server/models/interview-evaluation.model";
import type { InterviewEvaluationView } from "@/server/services/interview-evaluation.service";

const REC_STYLE: Record<Recommendation, string> = {
  STRONG_YES: "border-[#1f7a4d] bg-[#e8f5ee] text-[#1f7a4d]",
  YES: "border-[#2f5fa8] bg-[#eef4ff] text-[#2f5fa8]",
  MAYBE: "border-[#b07818] bg-[#fdf6e7] text-[#8a5d10]",
  NO: "border-[#c23b3b] bg-[#fbeae8] text-[#c23b3b]",
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Stars({
  value,
  onChange,
  size = "size-5",
  label,
}: {
  value: number | null;
  onChange?: (v: number | null) => void;
  size?: string;
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  return (
    <div className="flex items-center gap-0.5" role={onChange ? "radiogroup" : "img"} aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} — ${scoreLabels[n]}`}
            title={scoreLabels[n]}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onChange(value === n ? null : n)}
            className="rounded p-0.5 transition hover:scale-110"
          >
            <Star className={`${size} ${n <= shown ? "fill-amber-400 text-amber-400" : "text-[#d4d4d8]"}`} />
          </button>
        ) : (
          <Star key={n} className={`${size} ${n <= shown ? "fill-amber-400 text-amber-400" : "text-[#e4e4e7]"}`} />
        )
      )}
      {onChange && (
        <span className="ml-2 w-28 text-[11px] text-[#71717a]">{shown ? scoreLabels[shown] : "Sem nota"}</span>
      )}
    </div>
  );
}

/**
 * Ficha de avaliação da entrevista (interna). Cada pessoa da equipe preenche a
 * sua; o candidato nunca vê, a IA não recebe e a etapa não muda sozinha.
 */
export function InterviewEvaluationCard({
  applicationId,
  suggestedCriteria,
  evaluations: initial,
  currentUserId,
  interviewSummary,
}: {
  applicationId: string;
  suggestedCriteria: string[];
  evaluations: InterviewEvaluationView[];
  currentUserId: string;
  interviewSummary: string | null;
}) {
  const [evaluations, setEvaluations] = useState(initial);
  const mine = evaluations.find((e) => e.evaluatorId === currentUserId) ?? null;
  const others = evaluations.filter((e) => e.evaluatorId !== currentUserId);
  const [editing, setEditing] = useState(false);
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [summary, setSummary] = useState("");
  const [newCriterion, setNewCriterion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function openForm() {
    setCriteria(
      mine?.criteria.length
        ? mine.criteria.map((c) => ({ ...c }))
        : suggestedCriteria.map((name) => ({ name, score: null, note: "" }))
    );
    setRecommendation(mine?.recommendation ?? null);
    setSummary(mine?.summary ?? "");
    setError(null);
    setEditing(true);
  }

  function update(i: number, patch: Partial<EvaluationCriterion>) {
    setCriteria((list) => list.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }

  function addCriterion() {
    const name = newCriterion.trim();
    if (!name || criteria.length >= MAX_CRITERIA) return;
    if (criteria.some((c) => c.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) return;
    setCriteria((list) => [...list, { name, score: null, note: "" }]);
    setNewCriterion("");
  }

  function save() {
    setError(null);
    start(async () => {
      try {
        const result = await saveInterviewEvaluationAction(applicationId, { criteria, recommendation, summary });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setEvaluations((list) => [result.evaluation, ...list.filter((e) => e.id !== result.evaluation.id)]);
        setEditing(false);
      } catch {
        setError("Falha de conexão. Sua ficha continua aqui; tente salvar de novo.");
      }
    });
  }

  const liveAverage = averageScore(criteria);

  return (
    <section className="rounded-2xl border border-[#e4e4e7] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.6px] text-[#a1a1aa]">Entrevista</p>
          <h2 className="mt-1 text-base font-semibold text-[#0a0a0a]">Ficha de avaliação</h2>
          <p className="mt-1 text-[11px] text-[#a1a1aa]">
            {interviewSummary ? `${interviewSummary} · ` : ""}Interna: o candidato nunca vê e a IA não recebe.
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={openForm}
            className="h-9 rounded-xl px-4 text-[13px] font-semibold"
            style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
          >
            {mine ? "Editar minha avaliação" : "Avaliar entrevista"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-5">
          <ul className="divide-y divide-[#f4f4f5] rounded-xl border border-[#e4e4e7]">
            {criteria.map((c, i) => (
              <li key={`${c.name}-${i}`} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-[#0a0a0a]">{c.name}</span>
                  <div className="flex items-center gap-1">
                    <Stars value={c.score} onChange={(v) => update(i, { score: v })} label={`Nota para ${c.name}`} />
                    <button
                      type="button"
                      onClick={() => setCriteria((list) => list.filter((_, j) => j !== i))}
                      aria-label={`Remover ${c.name}`}
                      title="Remover critério"
                      className="ml-1 rounded p-1 text-[#a1a1aa] hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
                <input
                  value={c.note}
                  onChange={(e) => update(i, { note: e.target.value })}
                  maxLength={500}
                  placeholder="Comentário (opcional)"
                  className="mt-2 h-8 w-full rounded-lg border border-[#ececec] bg-[#fafaf9] px-2.5 text-[12px] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:bg-white focus:outline-none"
                />
              </li>
            ))}
          </ul>

          {criteria.length < MAX_CRITERIA && (
            <div className="mt-2 flex gap-2">
              <input
                value={newCriterion}
                onChange={(e) => setNewCriterion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCriterion();
                  }
                }}
                maxLength={80}
                placeholder="Outro critério (ex.: Conhecimento de produto)"
                className="h-9 flex-1 rounded-lg border border-[#e4e4e7] px-3 text-[12px] focus:border-[#0a0a0a] focus:outline-none"
              />
              <button
                type="button"
                onClick={addCriterion}
                disabled={!newCriterion.trim()}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#e4e4e7] px-3 text-[12px] font-medium text-[#0a0a0a] disabled:opacity-40"
              >
                <Plus className="size-3.5" /> Adicionar
              </button>
            </div>
          )}

          <p className="mt-5 text-[12px] font-medium text-[#0a0a0a]">Recomendação</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {RECOMMENDATIONS.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={recommendation === r}
                onClick={() => setRecommendation(recommendation === r ? null : r)}
                className={`h-9 rounded-lg border px-2 text-[12px] font-medium transition ${
                  recommendation === r ? REC_STYLE[r] : "border-[#e4e4e7] bg-white text-[#57534e] hover:border-[#a1a1aa]"
                }`}
              >
                {recommendationLabels[r]}
              </button>
            ))}
          </div>

          <label className="mt-5 block text-[12px] font-medium text-[#0a0a0a]">Parecer geral</label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Como foi a conversa, pontos fortes, pontos de atenção…"
            className="mt-1 w-full resize-y rounded-lg border border-[#e4e4e7] p-3 text-[13px] leading-5 focus:border-[#0a0a0a] focus:outline-none"
          />

          {error && (
            <p role="alert" className="mt-3 text-[13px] text-[#c23b3b]">
              {error}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12px] text-[#71717a]">
              {liveAverage !== null ? (
                <>
                  Média <strong className="text-[#0a0a0a]">{liveAverage.toFixed(1).replace(".", ",")}</strong> de 5
                </>
              ) : (
                "Dê nota aos critérios que avaliou"
              )}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={pending}
                className="h-10 rounded-xl border border-[#e4e4e7] px-4 text-[13px] text-[#71717a] hover:text-[#0a0a0a]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="h-10 rounded-xl px-5 text-[13px] font-semibold disabled:opacity-50"
                style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
              >
                {pending ? "Salvando…" : "Salvar avaliação"}
              </button>
            </div>
          </div>
        </div>
      ) : evaluations.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-[#e4e4e7] p-4 text-[13px] text-[#71717a]">
          Ninguém avaliou ainda. Depois da conversa, registre as notas por critério e a sua recomendação: fica mais
          fácil comparar e decidir.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {[...(mine ? [mine] : []), ...others].map((e) => (
            <article key={e.id} className="rounded-xl border border-[#e4e4e7] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  {e.average !== null && (
                    <span className="text-2xl font-bold tabular-nums text-[#0a0a0a]">
                      {e.average.toFixed(1).replace(".", ",")}
                    </span>
                  )}
                  <div>
                    {e.average !== null && <Stars value={Math.round(e.average)} size="size-3.5" label={`Média ${e.average}`} />}
                    <p className="mt-0.5 text-[11px] text-[#a1a1aa]">
                      {e.evaluatorId === currentUserId ? "Você" : e.evaluatorName || e.evaluatorEmail} ·{" "}
                      {formatWhen(e.updatedAt)}
                    </p>
                  </div>
                </div>
                {e.recommendation && (
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${REC_STYLE[e.recommendation]}`}>
                    {recommendationLabels[e.recommendation]}
                  </span>
                )}
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {e.criteria.map((c) => (
                  <div key={c.name}>
                    <dt className="flex items-center justify-between gap-2 text-[12px] text-[#57534e]">
                      <span className="truncate">{c.name}</span>
                      <Stars value={c.score} size="size-3" label={`${c.name}: ${c.score ?? "sem nota"}`} />
                    </dt>
                    {c.note && <dd className="mt-0.5 text-[11px] leading-4 text-[#71717a]">{c.note}</dd>}
                  </div>
                ))}
              </dl>
              {e.summary && (
                <p className="mt-3 whitespace-pre-line border-t border-[#f4f4f5] pt-3 text-[13px] leading-5 text-[#3f3f46]">
                  {e.summary}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
