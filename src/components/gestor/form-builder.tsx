"use client";

import { useActionState, useState, useTransition } from "react";

import {
  fieldTypeLabels,
  type PublicFormField,
} from "@/server/models/form.model";
import {
  addFormFieldAction,
  deleteFormFieldAction,
  toggleFieldRequiredAction,
  type FormBuilderState,
} from "@/server/controllers/form.controller";

const CORE_FIXED = ["Nome completo", "E-mail", "Telefone", "Currículo (PDF)"];

/** Construtor de formulário (/formulario) — padrão do frame A5 do Figma. */
export function FormBuilder({ fields }: { fields: PublicFormField[] }) {
  const [adding, setAdding] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [addState, addAction, addPending] = useActionState<
    FormBuilderState,
    FormData
  >(async (prev, formData) => {
    const result = await addFormFieldAction(prev, formData);
    if (!result) setAdding(false);
    return result;
  }, null);
  const [pending, startTransition] = useTransition();
  const [newType, setNewType] = useState("SHORT_TEXT");

  return (
    <div className="max-w-[560px]">
      <p className="text-sm font-medium text-[#0a0a0a]">
        Núcleo (fixo em todas as empresas)
      </p>
      <ul className="mt-3 space-y-2">
        {CORE_FIXED.map((label) => (
          <li
            key={label}
            className="flex h-10 items-center justify-between rounded-md border border-[#e4e4e7] bg-[#fafaf9] px-4"
          >
            <span className="text-[13px] font-medium text-[#0a0a0a]">
              {label}
            </span>
            <span className="rounded-full bg-[#f4f4f5] px-2.5 py-0.5 text-[9px] font-medium text-[#71717a]">
              fixo
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm font-medium text-[#0a0a0a]">
        Campos extras da empresa
      </p>
      <ul className="mt-3 space-y-2.5">
        {fields.length === 0 && (
          <li className="text-sm text-[#71717a]">
            Nenhum campo extra ainda.
          </li>
        )}
        {fields.map((field) => (
          <li
            key={field.id}
            className="flex h-11 items-center gap-4 rounded-md border border-[#e4e4e7] bg-white px-4"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-[#0a0a0a]">
                {field.label}
              </span>
              <span className="block text-[10px] text-[#a1a1aa]">
                {fieldTypeLabels[field.type]}
                {field.isCore ? " · passo Perfil" : ""}
              </span>
            </span>
            <label className="flex items-center gap-2 text-[11px] text-[#71717a]">
              Obrigatório
              <button
                type="button"
                role="switch"
                aria-checked={field.required}
                disabled={pending}
                onClick={() =>
                  startTransition(() =>
                    toggleFieldRequiredAction(field.id, !field.required)
                  )
                }
                className={
                  "relative h-5 w-[34px] rounded-full transition-colors " +
                  (field.required ? "" : "bg-[#e4e4e7]")
                }
                style={
                  field.required
                    ? { backgroundColor: "var(--brand-primary)" }
                    : undefined
                }
              >
                <span
                  className={
                    "absolute top-0.5 size-4 rounded-full bg-white transition-all " +
                    (field.required ? "left-[16px]" : "left-0.5")
                  }
                />
              </button>
            </label>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteFormFieldAction(field.id);
                  setRowError(result?.error ?? null);
                })
              }
              aria-label={`Remover ${field.label}`}
              className="text-[13px] text-[#a1a1aa] hover:text-[#c23b3b]"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {rowError && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {rowError}
        </p>
      )}

      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 h-10 w-full rounded-md border border-[#e4e4e7] bg-[#fafafa] text-[13px] font-medium text-[#0a0a0a] hover:bg-[#f4f4f5]"
        >
          +&nbsp;&nbsp;Adicionar campo
        </button>
      ) : (
        <form
          action={addAction}
          className="mt-3 space-y-4 rounded-md border border-[#e4e4e7] bg-white p-4"
        >
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-[#0a0a0a]">
              Nome do campo
            </span>
            <input
              name="label"
              required
              className="h-10 w-full rounded-md border border-[#e4e4e7] px-3 text-sm focus:border-[#0a0a0a] focus:outline-none"
              placeholder="Ex.: Pretensão salarial"
            />
          </label>
          <div className="flex gap-4">
            <label className="block flex-1">
              <span className="mb-1.5 block text-[13px] font-medium text-[#0a0a0a]">
                Tipo
              </span>
              <select
                name="type"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="h-10 w-full rounded-md border border-[#e4e4e7] bg-white px-3 text-sm focus:border-[#0a0a0a] focus:outline-none"
              >
                {Object.entries(fieldTypeLabels)
                  .filter(([value]) => value !== "FILE_UPLOAD")
                  .map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
              </select>
            </label>
            <div className="flex flex-col justify-end gap-2 pb-1">
              <label className="flex items-center gap-2 text-[13px] text-[#0a0a0a]">
                <input type="checkbox" name="required" className="size-4 accent-[#0a0a0a]" />
                Obrigatório
              </label>
              <label className="flex items-center gap-2 text-[13px] text-[#0a0a0a]">
                <input type="checkbox" name="isCore" className="size-4 accent-[#0a0a0a]" />
                Mostrar no passo “Perfil”
              </label>
            </div>
          </div>
          {newType === "DROPDOWN" && (
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-[#0a0a0a]">
                Opções (uma por linha)
              </span>
              <textarea
                name="options"
                rows={3}
                className="w-full rounded-md border border-[#e4e4e7] px-3 py-2 text-sm focus:border-[#0a0a0a] focus:outline-none"
                placeholder={"Júnior\nPleno\nSênior"}
              />
            </label>
          )}
          {addState?.error && (
            <p role="alert" className="text-sm text-red-600">
              {addState.error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="h-9 rounded-2xl border border-[#e4e4e7] px-4 text-[13px] font-medium text-[#71717a]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={addPending}
              className="h-9 rounded-2xl px-5 text-[13px] font-medium disabled:opacity-60"
              style={{
                backgroundColor: "var(--brand-primary)",
                color: "var(--brand-foreground)",
              }}
            >
              {addPending ? "Salvando…" : "Adicionar"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
