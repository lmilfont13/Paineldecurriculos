"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import {
  contractLabels,
  jobFormSchema,
  workModeLabels,
  type JobFormInput,
} from "@/server/models/job.model";
import {
  createJobAction,
  rewriteJobTextAction,
  updateJobAction,
  type JobFormState,
} from "@/server/controllers/job.controller";

const STEPS = ["Básico", "Descrição", "Critérios", "Revisão"] as const;

type Draft = {
  title: string;
  location: string;
  contract: JobFormInput["contract"];
  workMode: JobFormInput["workMode"];
  description: string;
  requirements: string;
  aiCriteria: string[];
  aiMinScore: number;
};

/** E5–E8 · Nova vaga / editar vaga (frames 89:378..89:514 do Figma). */
export function JobWizard({
  jobId,
  initial,
}: {
  jobId?: string;
  initial?: Partial<Draft>;
}) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [publish, setPublish] = useState(true);
  const [rewriting, setRewriting] = useState<"description" | "requirements" | null>(null);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [criterionInput, setCriterionInput] = useState("");
  const [draft, setDraft] = useState<Draft>({
    title: initial?.title ?? "",
    location: initial?.location ?? "",
    contract: initial?.contract ?? "CLT",
    workMode: initial?.workMode ?? "REMOTE",
    description: initial?.description ?? "",
    requirements: initial?.requirements ?? "",
    aiCriteria: initial?.aiCriteria ?? [],
    aiMinScore: initial?.aiMinScore ?? 70,
  });

  const action = useMemo(
    () => (jobId ? updateJobAction.bind(null, jobId) : createJobAction),
    [jobId]
  );
  const [state, formAction, pending] = useActionState<JobFormState, FormData>(
    action,
    null
  );

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  function validateStep(): string | null {
    if (step === 0 && draft.title.trim().length < 3)
      return "Informe o título da vaga.";
    if (step === 1 && draft.description.trim().length < 10)
      return "Descreva a vaga.";
    return null;
  }

  function next() {
    const err = validateStep();
    if (err) return setError(err);
    setError(null);
    setStep((s) => Math.min(s + 1, 3));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function rewrite(field: "description" | "requirements") {
    const text = draft[field];
    if (!text.trim()) return;
    setRewriteError(null);
    setRewriting(field);
    const result = await rewriteJobTextAction(field, text, draft.title);
    setRewriting(null);
    if (result.ok) {
      set(field, result.text);
    } else {
      setRewriteError(result.error);
    }
  }

  function addCriterion() {
    const value = criterionInput.trim();
    if (!value || draft.aiCriteria.includes(value)) return;
    set("aiCriteria", [...draft.aiCriteria, value]);
    setCriterionInput("");
  }

  const parsed = jobFormSchema.safeParse(draft);
  const inputClass =
    "h-10 w-full rounded-md border border-[#e4e4e7] bg-white px-3 text-sm text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none";
  const progress = ["w-0", "w-1/3", "w-2/3", "w-full"][step];

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-[#e4e4e7] bg-white px-8">
        <span className="text-sm font-medium text-[#0a0a0a]">
          {jobId ? "Editar vaga" : "Nova vaga"}
        </span>
        <Link
          href="/vagas"
          className="text-[13px] text-[#71717a] transition-colors hover:text-[#0a0a0a]"
        >
          Sair sem salvar
        </Link>
      </header>

      <div className="mx-auto w-full max-w-[512px] flex-1 px-6 pt-12">
        {/* Stepper com a cor da marca (regra 4: acentos do painel do gestor) */}
        <ol className="flex justify-between px-6">
          {STEPS.map((label, i) => (
            <li key={label} className="flex w-24 flex-col items-center gap-2">
              <span
                className={
                  "flex size-4 items-center justify-center rounded-full text-[9px] font-bold " +
                  (i === step ? "ring-4 ring-[#0a0a0a]/10 " : "") +
                  (i > step ? "bg-[#e4e4e7]" : "")
                }
                style={
                  i <= step
                    ? {
                        backgroundColor: "var(--brand-primary)",
                        color: "var(--brand-foreground)",
                      }
                    : undefined
                }
              >
                {i < step ? "✓" : ""}
              </span>
              <span
                className={
                  "text-xs " +
                  (i === step
                    ? "font-medium text-[#0a0a0a]"
                    : "text-[#71717a]")
                }
              >
                {label}
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-3 h-1.5 w-full rounded-[3px] bg-[#e4e4e7]">
          <div
            className={`h-1.5 rounded-[3px] transition-all ${progress}`}
            style={{ backgroundColor: "var(--brand-primary)" }}
          />
        </div>

        <form
          action={formAction}
          className="mt-10 mb-4 flex min-h-[600px] flex-col rounded-3xl border border-[#e4e4e7] bg-white p-6 shadow-[0px_4px_6px_rgba(0,0,0,0.07)]"
        >
          {/* Campos do form enviados ao controller */}
          <input type="hidden" name="title" value={draft.title} />
          <input type="hidden" name="location" value={draft.location} />
          <input type="hidden" name="contract" value={draft.contract} />
          <input type="hidden" name="workMode" value={draft.workMode} />
          <input type="hidden" name="description" value={draft.description} />
          <input type="hidden" name="requirements" value={draft.requirements} />
          <input
            type="hidden"
            name="aiCriteria"
            value={JSON.stringify(draft.aiCriteria)}
          />
          <input type="hidden" name="aiMinScore" value={draft.aiMinScore} />
          <input type="hidden" name="publish" value={String(publish)} />

          <div className="flex-1">
            {step === 0 && (
              <>
                <h1 className="text-2xl font-semibold text-[#0a0a0a]">
                  O básico da vaga
                </h1>
                <p className="mt-2 text-sm text-[#71717a]">
                  Título, local e tipo de contratação.
                </p>
                <div className="mt-6 space-y-5">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-[#0a0a0a]">
                      Título da vaga
                    </span>
                    <input
                      className={inputClass}
                      value={draft.title}
                      onChange={(e) => set("title", e.target.value)}
                      placeholder="Ex.: Desenvolvedor(a) Full Stack Pleno"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-[#0a0a0a]">
                      Localização (opcional)
                    </span>
                    <input
                      className={inputClass}
                      value={draft.location}
                      onChange={(e) => set("location", e.target.value)}
                      placeholder="Ex.: Fortaleza, CE"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-[#0a0a0a]">
                      Contrato
                    </span>
                    <select
                      className={inputClass}
                      value={draft.contract}
                      onChange={(e) =>
                        set("contract", e.target.value as Draft["contract"])
                      }
                    >
                      {Object.entries(contractLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-[#0a0a0a]">
                      Modelo de trabalho
                    </span>
                    <select
                      className={inputClass}
                      value={draft.workMode}
                      onChange={(e) =>
                        set("workMode", e.target.value as Draft["workMode"])
                      }
                    >
                      {Object.entries(workModeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <h1 className="text-2xl font-semibold text-[#0a0a0a]">
                  Descreva a vaga
                </h1>
                <p className="mt-2 text-sm text-[#71717a]">
                  O que o candidato vê na página pública.
                </p>
                {rewriteError && (
                  <p className="mt-3 text-sm text-red-600">{rewriteError}</p>
                )}
                <div className="mt-6 space-y-5">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[#0a0a0a]">
                        Sobre a vaga
                      </span>
                      <button
                        type="button"
                        disabled={rewriting !== null || !draft.description.trim()}
                        onClick={() => rewrite("description")}
                        className="flex items-center gap-1.5 rounded-full border border-[#e4e4e7] bg-white px-2.5 py-1 text-[11px] font-medium text-[#71717a] transition-colors hover:border-[#0a0a0a] hover:text-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-40"
                        title="Cole o texto da vaga acima e clique aqui"
                      >
                        {rewriting === "description" ? (
                          <>
                            <span className="size-3 animate-spin rounded-full border border-current border-t-transparent" />
                            Reescrevendo…
                          </>
                        ) : (
                          <>✦ Reescrever com IA</>
                        )}
                      </button>
                    </div>
                    <textarea
                      rows={7}
                      className="w-full rounded-md border border-[#e4e4e7] bg-white px-3 py-2 text-sm text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none"
                      value={draft.description}
                      onChange={(e) => set("description", e.target.value)}
                      placeholder="Responsabilidades, time, desafios…"
                    />
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[#0a0a0a]">
                        O que esperamos (um item por linha)
                      </span>
                      <button
                        type="button"
                        disabled={rewriting !== null || !draft.requirements.trim()}
                        onClick={() => rewrite("requirements")}
                        className="flex items-center gap-1.5 rounded-full border border-[#e4e4e7] bg-white px-2.5 py-1 text-[11px] font-medium text-[#71717a] transition-colors hover:border-[#0a0a0a] hover:text-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-40"
                        title="Cole os requisitos acima e clique aqui"
                      >
                        {rewriting === "requirements" ? (
                          <>
                            <span className="size-3 animate-spin rounded-full border border-current border-t-transparent" />
                            Reescrevendo…
                          </>
                        ) : (
                          <>✦ Reescrever com IA</>
                        )}
                      </button>
                    </div>
                    <textarea
                      rows={5}
                      className="w-full rounded-md border border-[#e4e4e7] bg-white px-3 py-2 text-sm text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none"
                      value={draft.requirements}
                      onChange={(e) => set("requirements", e.target.value)}
                      placeholder={"3+ anos com React\nInglês para leitura técnica"}
                    />
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h1 className="text-2xl font-semibold text-[#0a0a0a]">
                  O que a IA deve avaliar
                </h1>
                <p className="mt-2 text-sm text-[#71717a]">
                  A IA sinaliza quem atende. Você decide.
                </p>
                <p className="mt-5 flex h-11 items-center gap-2.5 rounded-md bg-[#f4f4f5] px-4 text-[13px] text-[#71717a]">
                  🔒 Nada disso aparece para o candidato.
                </p>
                <p className="mt-6 text-sm font-medium text-[#0a0a0a]">
                  Critérios de aderência
                </p>
                <ul className="mt-3 space-y-3">
                  {draft.aiCriteria.map((criterion) => (
                    <li
                      key={criterion}
                      className="flex h-11 items-center gap-3 rounded-md border border-[#e4e4e7] bg-white px-4 text-sm text-[#0a0a0a]"
                    >
                      <span className="size-1.5 rounded-full bg-[#0a0a0a]" />
                      <span className="flex-1 truncate">{criterion}</span>
                      <button
                        type="button"
                        onClick={() =>
                          set(
                            "aiCriteria",
                            draft.aiCriteria.filter((c) => c !== criterion)
                          )
                        }
                        aria-label={`Remover ${criterion}`}
                        className="text-[13px] text-[#a1a1aa] hover:text-[#0a0a0a]"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex h-11 items-center gap-2 rounded-md border border-[#e4e4e7] bg-[#fafafa] px-3">
                  <input
                    className="h-full flex-1 bg-transparent text-sm text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:outline-none"
                    value={criterionInput}
                    onChange={(e) => setCriterionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCriterion();
                      }
                    }}
                    placeholder="+  Adicionar critério"
                  />
                  {criterionInput.trim() && (
                    <button
                      type="button"
                      onClick={addCriterion}
                      className="text-sm font-medium text-[#0a0a0a]"
                    >
                      Adicionar
                    </button>
                  )}
                </div>

                <div className="mt-8 flex items-center justify-between">
                  <span className="text-sm font-medium text-[#0a0a0a]">
                    Score mínimo para “Atende”
                  </span>
                  <span className="text-[28px] font-bold text-[#0a0a0a]">
                    {draft.aiMinScore}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={draft.aiMinScore}
                  onChange={(e) => set("aiMinScore", Number(e.target.value))}
                  className="mt-2 w-full"
                  style={{ accentColor: "var(--brand-primary)" }}
                  aria-label="Score mínimo"
                />
              </>
            )}

            {step === 3 && (
              <>
                <h1 className="text-2xl font-semibold text-[#0a0a0a]">
                  Revisão
                </h1>
                <p className="mt-2 text-sm text-[#71717a]">
                  Confira antes de publicar.
                </p>
                <dl className="mt-6">
                  {[
                    ["Título", draft.title],
                    ["Local", draft.location || "—"],
                    ["Contrato", contractLabels[draft.contract]],
                    ["Modelo", workModeLabels[draft.workMode]],
                    [
                      "Critérios da IA",
                      draft.aiCriteria.length > 0
                        ? draft.aiCriteria.join(", ")
                        : "—",
                    ],
                    ["Score mínimo", String(draft.aiMinScore)],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-baseline justify-between gap-6 border-b border-[#e4e4e7] py-3 last:border-b-0"
                    >
                      <dt className="shrink-0 text-xs text-[#71717a]">
                        {label}
                      </dt>
                      <dd className="truncate text-right text-[13px] text-[#0a0a0a]">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <label className="mt-6 flex items-center gap-2.5 text-sm text-[#0a0a0a]">
                  <input
                    type="checkbox"
                    checked={publish}
                    onChange={(e) => setPublish(e.target.checked)}
                    className="size-4 accent-[#0a0a0a]"
                  />
                  Publicar imediatamente (senão fica como rascunho)
                </label>
              </>
            )}
          </div>

          {(error || state?.error) && (
            <p role="alert" className="mb-4 text-sm text-red-600">
              {error ?? state?.error}
            </p>
          )}

          <div className="flex items-center justify-between">
            {step > 0 ? (
              <button
                type="button"
                onClick={back}
                disabled={pending}
                className="flex h-10 w-[100px] items-center justify-center gap-2 rounded-2xl border border-[#e4e4e7] bg-white text-sm font-medium text-[#71717a] hover:text-[#0a0a0a]"
              >
                <span aria-hidden>‹</span> Voltar
              </button>
            ) : (
              <span />
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={next}
                className="flex h-10 w-32 items-center justify-center gap-2 rounded-2xl text-sm font-medium hover:opacity-90"
                style={{
                  backgroundColor: "var(--brand-primary)",
                  color: "var(--brand-foreground)",
                }}
              >
                Continuar <span aria-hidden>›</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={pending || !parsed.success}
                className="flex h-10 w-44 items-center justify-center rounded-2xl text-sm font-medium hover:opacity-90 disabled:opacity-60"
                style={{
                  backgroundColor: "var(--brand-primary)",
                  color: "var(--brand-foreground)",
                }}
              >
                {pending
                  ? "Salvando…"
                  : publish
                    ? "Publicar vaga"
                    : "Salvar rascunho"}
              </button>
            )}
          </div>
        </form>

        <p className="pb-10 text-center text-sm text-[#71717a]">
          Passo {step + 1} de 4: {STEPS[step]}
        </p>
      </div>
    </>
  );
}
