"use client";

import { useActionState } from "react";

import { updateAiModelAction, type SettingsState } from "@/server/controllers/settings.controller";

type Option = { id: string; label: string; hint: string; available: boolean };

/** Escolha do modelo de IA da empresa. Só sugere nota: a decisão continua com o gestor. */
export function AiModelForm({ current, options }: { current: string; options: Option[] }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateAiModelAction, null);

  return (
    <form action={action} className="space-y-3">
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e4e4e7] bg-white px-4 py-3 has-[:checked]:border-[#0a0a0a]">
        <input type="radio" name="aiModel" value="" defaultChecked={current === ""} className="mt-1" />
        <span>
          <span className="block text-[13px] font-medium text-[#0a0a0a]">Padrão do sistema</span>
          <span className="block text-[11px] text-[#71717a]">Usa o Claude quando a chave está configurada; senão, a Groq.</span>
        </span>
      </label>

      {options.map((o) => (
        <label
          key={o.id}
          className={
            "flex items-start gap-3 rounded-xl border border-[#e4e4e7] bg-white px-4 py-3 has-[:checked]:border-[#0a0a0a] " +
            (o.available ? "cursor-pointer" : "cursor-not-allowed opacity-60")
          }
        >
          <input
            type="radio"
            name="aiModel"
            value={o.id}
            defaultChecked={current === o.id}
            disabled={!o.available}
            className="mt-1"
          />
          <span>
            <span className="block text-[13px] font-medium text-[#0a0a0a]">{o.label}</span>
            <span className="block text-[11px] text-[#71717a]">
              {o.hint}
              {!o.available && " Indisponível: falta a chave deste serviço no servidor."}
            </span>
          </span>
        </label>
      ))}

      {state && "error" in state && (
        <p role="alert" className="text-[12px] text-[#c23b3b]">{state.error}</p>
      )}
      {state && "ok" in state && <p className="text-[12px] text-[#1f7a4d]">Modelo salvo. Vale para as próximas análises.</p>}

      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-xl px-5 text-[13px] font-semibold disabled:opacity-60"
        style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
      >
        {pending ? "Salvando…" : "Salvar"}
      </button>
      <p className="text-[11px] text-[#a1a1aa]">
        Análises já feitas não mudam. A IA só sugere a nota; nota e etapa continuam sendo decisão sua.
      </p>
    </form>
  );
}
