"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { correctAnswersAction, reanalyzeAction } from "@/server/controllers/application.controller";

export type EditableAnswer = {
  id: string;
  label: string;
  value: string;
  type: string;
  options: string[];
};

const inputClass =
  "mt-1 w-full rounded-lg border border-[#e4e4e7] bg-white px-3 py-2 text-[13px] text-[#0a0a0a] focus:border-[#0a0a0a] focus:outline-none";

/** Respostas do formulário, com opção de o gestor corrigir o que o candidato errou. */
export function AnswersEditor({
  applicationId,
  answers,
  canReanalyze,
}: {
  applicationId: string;
  answers: EditableAnswer[];
  canReanalyze: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string; changed?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function start() {
    setValues(Object.fromEntries(answers.map((a) => [a.id, a.value])));
    setMessage(null);
    setEditing(true);
  }

  function save() {
    startTransition(async () => {
      const result = await correctAnswersAction(applicationId, values);
      if (!result.ok) {
        setMessage({ kind: "error", text: result.error });
        return;
      }
      setEditing(false);
      setMessage({
        kind: "ok",
        changed: result.changed > 0,
        text: result.changed > 0 ? "Respostas corrigidas." : "Nada mudou.",
      });
      router.refresh();
    });
  }

  function reanalyze() {
    startTransition(async () => {
      await reanalyzeAction(applicationId);
      setMessage({ kind: "ok", text: "Análise reenviada. O resultado aparece na leitura da IA em instantes." });
      router.refresh();
    });
  }

  function setValue(id: string, v: string) {
    setValues((prev) => ({ ...prev, [id]: v }));
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[#0a0a0a]">Respostas do formulário</h2>
        {answers.length > 0 && !editing && (
          <button
            type="button"
            onClick={start}
            className="h-8 rounded-lg border border-[#e4e4e7] bg-white px-3 text-[12px] font-medium text-[#0a0a0a] hover:border-[#0a0a0a]"
          >
            Corrigir respostas
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-4">
          <p className="text-[11px] text-[#a1a1aa]">
            Corrija o que o candidato preencheu errado (por exemplo, nível ou tempo de experiência). A resposta corrigida passa a valer no sistema.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            {answers.map((a) => (
              <label key={a.id} className={"block " + (a.type === "LONG_TEXT" ? "sm:col-span-2" : "")}>
                <span className="text-[11px] font-medium text-[#71717a]">{a.label}</span>
                {a.type === "LONG_TEXT" ? (
                  <textarea
                    rows={3}
                    value={values[a.id] ?? ""}
                    onChange={(e) => setValue(a.id, e.target.value)}
                    className={inputClass}
                  />
                ) : a.type === "YES_NO" || (a.type === "DROPDOWN" && a.options.length > 0) ? (
                  <select value={values[a.id] ?? ""} onChange={(e) => setValue(a.id, e.target.value)} className={inputClass}>
                    {[...new Set([values[a.id] ?? "", ...(a.type === "YES_NO" ? ["Sim", "Não"] : a.options)])]
                      .filter(Boolean)
                      .map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                  </select>
                ) : (
                  <input value={values[a.id] ?? ""} onChange={(e) => setValue(a.id, e.target.value)} className={inputClass} />
                )}
              </label>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="h-9 rounded-xl px-5 text-[13px] font-semibold disabled:opacity-60"
              style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
            >
              {pending ? "Salvando…" : "Salvar correções"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={pending}
              className="h-9 rounded-xl border border-[#e4e4e7] bg-white px-4 text-[13px] font-medium text-[#0a0a0a] disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
          {answers.map((a) => (
            <div key={a.id}>
              <dt className="text-[11px] font-medium text-[#71717a]">{a.label}</dt>
              <dd className="mt-1 break-words text-[13px] leading-5 text-[#0a0a0a]">{a.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {message && (
        <p
          role={message.kind === "error" ? "alert" : undefined}
          className={"mt-3 text-[12px] " + (message.kind === "error" ? "text-[#c23b3b]" : "text-[#1f7a4d]")}
        >
          {message.text}
          {message.changed && canReanalyze && (
            <>
              {" "}
              A nota não muda sozinha.{" "}
              <button type="button" onClick={reanalyze} disabled={pending} className="font-medium underline underline-offset-2">
                Analisar de novo com a correção
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );
}
