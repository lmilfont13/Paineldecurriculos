"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";

import type { PublicFormField } from "@/server/models/form.model";
import type { QuestionSuggestion } from "@/server/models/question-catalog.model";
import {
  addCustomQuestionAction,
  addSuggestedQuestionAction,
  deleteJobQuestionAction,
  toggleJobQuestionRequiredAction,
  type JobQuestionState,
} from "@/server/controllers/job-questions.controller";

const TYPE_LABELS: Record<string, string> = {
  SHORT_TEXT: "resposta curta",
  LONG_TEXT: "resposta longa",
  DROPDOWN: "lista de opções",
  YES_NO: "sim ou não",
  NUMBER: "número",
  DATE: "data",
};

/**
 * Perguntas desta vaga (hub da vaga): escolher do banco de sugestões, com as
 * recomendadas para o texto da vaga primeiro, ou criar uma nova.
 */
export function JobQuestions({
  jobId,
  questions,
  companyQuestions,
  suggestions,
}: {
  jobId: string;
  questions: PublicFormField[];
  companyQuestions: string[];
  suggestions: QuestionSuggestion[];
}) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newType, setNewType] = useState("YES_NO");
  const [formState, formAction, formPending] = useActionState<JobQuestionState, FormData>(
    async (prev, formData) => {
      const result = await addCustomQuestionAction(jobId, prev, formData);
      if (!result) setCreating(false);
      return result;
    },
    null
  );

  const recommended = suggestions.filter((s) => s.recommended);
  const others = suggestions.filter((s) => !s.recommended);

  function run(id: string, task: () => Promise<JobQuestionState | void>) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const result = await task();
      if (result && "error" in result) setError(result.error);
      setBusyId(null);
    });
  }

  function addAll() {
    run("all", async () => {
      for (const s of recommended) {
        const result = await addSuggestedQuestionAction(jobId, s.id);
        if (result) return result;
      }
    });
  }

  const suggestionRow = (s: QuestionSuggestion) => (
    <li
      key={s.id}
      className="flex items-center justify-between gap-3 border-b border-[#f4f4f5] py-2 last:border-b-0"
    >
      <span className="min-w-0">
        <span className="block text-[12px] text-[#0a0a0a]">{s.label}</span>
        <span className="text-[10px] text-[#a1a1aa]">
          {TYPE_LABELS[s.type]}
          {s.type === "DROPDOWN" && `: ${s.options.join(", ")}`}
        </span>
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(s.id, () => addSuggestedQuestionAction(jobId, s.id))}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ring-1 ring-[#e4e4e7] hover:bg-[#fafafa] disabled:opacity-50"
        style={{ color: "var(--brand-primary)" }}
      >
        {busyId === s.id ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
        Adicionar
      </button>
    </li>
  );

  return (
    <section className="mt-4 rounded-xl border border-[#e4e4e7] bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-semibold text-[#0a0a0a]">Perguntas desta vaga</h2>
          <p className="mt-0.5 text-[12px] text-[#71717a]">
            Aparecem no passo &quot;Extras&quot; da candidatura só desta vaga. A IA lê as respostas junto com o currículo.
          </p>
        </div>
      </div>

      {questions.length === 0 ? (
        <p className="mt-4 rounded-lg bg-[#fafaf9] px-3.5 py-3 text-[12px] text-[#71717a] ring-1 ring-[#f4f4f5]">
          Nenhuma pergunta própria ainda. Escolha nas sugestões abaixo.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {questions.map((q) => (
            <li
              key={q.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-[#e4e4e7] px-3.5 py-2.5"
            >
              <span className="min-w-0">
                <span className="block text-[12px] font-medium text-[#0a0a0a]">{q.label}</span>
                <span className="text-[10px] text-[#a1a1aa]">
                  {TYPE_LABELS[q.type] ?? q.type}
                  {q.type === "DROPDOWN" && `: ${q.options.join(", ")}`}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[#52525b]">
                  <input
                    type="checkbox"
                    checked={q.required}
                    disabled={pending}
                    onChange={(e) =>
                      run(q.id, () => toggleJobQuestionRequiredAction(jobId, q.id, e.target.checked))
                    }
                    className="size-3.5 accent-[var(--brand-primary)]"
                  />
                  obrigatória
                </label>
                <button
                  type="button"
                  aria-label={`Remover a pergunta ${q.label}`}
                  disabled={pending}
                  onClick={() => run(q.id, () => deleteJobQuestionAction(jobId, q.id))}
                  className="rounded-md p-1.5 text-[#a1a1aa] hover:bg-[#fafafa] hover:text-[#b91c1c] disabled:opacity-50"
                >
                  {busyId === q.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mt-3 text-[12px] text-[#b91c1c]" role="alert">
          {error}
        </p>
      )}

      {recommended.length > 0 && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.5px] text-[#71717a]">
              <Sparkles className="size-3.5" /> Recomendadas para esta vaga
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={addAll}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold disabled:opacity-60"
              style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
            >
              {busyId === "all" ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
              Adicionar todas ({recommended.length})
            </button>
          </div>
          <ul className="mt-2">{recommended.map(suggestionRow)}</ul>
        </div>
      )}

      {others.length > 0 && (
        <details className="mt-4 group">
          <summary className="cursor-pointer text-[12px] font-medium text-[#52525b] hover:text-[#0a0a0a]">
            Mais perguntas prontas ({others.length})
          </summary>
          <ul className="mt-2">{others.map(suggestionRow)}</ul>
        </details>
      )}

      <div className="mt-5 border-t border-[#f4f4f5] pt-4">
        {creating ? (
          <form action={formAction} className="space-y-3">
            <input
              name="label"
              required
              minLength={2}
              autoFocus
              placeholder="Escreva a pergunta"
              className="h-9 w-full rounded-lg border border-[#e4e4e7] px-3 text-[13px] outline-none focus:border-[#a1a1aa]"
            />
            <div className="flex flex-wrap items-center gap-3">
              <select
                name="type"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="h-9 rounded-lg border border-[#e4e4e7] bg-white px-2.5 text-[12px]"
              >
                <option value="YES_NO">Sim ou não</option>
                <option value="SHORT_TEXT">Resposta curta</option>
                <option value="LONG_TEXT">Resposta longa</option>
                <option value="DROPDOWN">Lista de opções</option>
                <option value="NUMBER">Número</option>
              </select>
              <label className="flex items-center gap-1.5 text-[12px] text-[#52525b]">
                <input type="checkbox" name="required" defaultChecked className="size-3.5 accent-[var(--brand-primary)]" />
                obrigatória
              </label>
            </div>
            {newType === "DROPDOWN" && (
              <textarea
                name="options"
                rows={3}
                placeholder={"Uma opção por linha\nEx.: Manhã\nTarde"}
                className="w-full rounded-lg border border-[#e4e4e7] px-3 py-2 text-[12px] outline-none focus:border-[#a1a1aa]"
              />
            )}
            {formState?.error && (
              <p className="text-[12px] text-[#b91c1c]" role="alert">
                {formState.error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={formPending}
                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12px] font-semibold disabled:opacity-60"
                style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
              >
                {formPending && <Loader2 className="size-3 animate-spin" />}
                Salvar pergunta
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="rounded-lg px-3.5 py-2 text-[12px] text-[#52525b] hover:bg-[#fafafa]"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium"
            style={{ color: "var(--brand-primary)" }}
          >
            <Plus className="size-3.5" /> Criar outra pergunta
          </button>
        )}
      </div>

      {companyQuestions.length > 0 && (
        <p className="mt-4 text-[11px] leading-4 text-[#a1a1aa]">
          Também aparecem em todas as vagas (Configurações → Formulário): {companyQuestions.join(" · ")}.
        </p>
      )}
    </section>
  );
}
