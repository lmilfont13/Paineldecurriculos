"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  submitInfoAnswersAction,
  type InterviewState,
} from "@/server/controllers/application.controller";
import {
  MARITAL_STATUSES,
  type InfoField,
} from "@/server/models/pre-interview.model";

const inputClass =
  "h-11 w-full rounded-xl border border-[#e4e4e7] bg-white px-3 text-sm text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none";

/** "52998224725" → "529.982.247-25" enquanto digita. */
function formatCpf(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function PreInterviewForm({
  slug,
  applicationId,
  fields,
  companyName,
}: {
  slug: string;
  applicationId: string;
  fields: InfoField[];
  companyName: string;
}) {
  const [state, formAction, pending] = useActionState<InterviewState, FormData>(
    submitInfoAnswersAction.bind(null, slug, applicationId),
    null
  );
  const [cpf, setCpf] = useState("");
  const [hasChildren, setHasChildren] = useState<"sim" | "nao" | "">("");

  if (state && "ok" in state) {
    return (
      <div className="mt-8 rounded-2xl border border-[#d6efde] bg-[#f0faf4] p-6">
        <p className="text-sm font-semibold text-[#16a34a]">
          Informações enviadas. Obrigado!
        </p>
        <p className="mt-1 text-[13px] text-[#57534e]">
          A {companyName} entra em contato para combinar a conversa.
        </p>
        <Link
          href={`/${slug}/minhas-candidaturas/${applicationId}`}
          className="mt-4 inline-block text-[13px] font-medium underline"
          style={{ color: "var(--brand-primary)" }}
        >
          Voltar para minha candidatura
        </Link>
      </div>
    );
  }

  const label = "mb-1.5 block text-sm font-medium text-[#0a0a0a]";

  return (
    <form action={formAction} className="mt-8 space-y-5">
      {fields.includes("maritalStatus") && (
        <label className="block">
          <span className={label}>Estado civil</span>
          <select name="maritalStatus" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Escolha
            </option>
            {MARITAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      )}

      {fields.includes("children") && (
        <fieldset>
          <legend className={label}>Tem filhos?</legend>
          <div className="flex gap-4 text-sm text-[#0a0a0a]">
            {(
              [
                ["sim", "Sim"],
                ["nao", "Não"],
              ] as const
            ).map(([value, text]) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="hasChildren"
                  value={value}
                  required
                  checked={hasChildren === value}
                  onChange={() => setHasChildren(value)}
                />
                {text}
              </label>
            ))}
          </div>
          {hasChildren === "sim" && (
            <label className="mt-3 block">
              <span className={label}>Quantos?</span>
              <input
                name="childrenCount"
                type="number"
                min={1}
                max={20}
                className={inputClass}
              />
            </label>
          )}
        </fieldset>
      )}

      {fields.includes("professionalSummary") && (
        <label className="block">
          <span className={label}>Resumo da sua vida profissional</span>
          <textarea
            name="professionalSummary"
            rows={5}
            required
            minLength={20}
            maxLength={1500}
            placeholder="Onde trabalhou, o que fazia e há quanto tempo."
            className="w-full rounded-xl border border-[#e4e4e7] bg-white px-3 py-2 text-sm text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none"
          />
        </label>
      )}

      {fields.includes("rg") && (
        <label className="block">
          <span className={label}>RG</span>
          <input name="rg" required maxLength={20} className={inputClass} />
        </label>
      )}

      {fields.includes("cpf") && (
        <label className="block">
          <span className={label}>CPF</span>
          <input
            name="cpf"
            required
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))}
            className={inputClass}
          />
        </label>
      )}

      <p className="text-[12px] leading-5 text-[#71717a]">
        A {companyName} usa estas informações só para o processo seletivo desta
        vaga. Elas ficam visíveis apenas para a equipe de seleção.
      </p>

      {state && "error" in state && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{
          backgroundColor: "var(--brand-primary)",
          color: "var(--brand-foreground)",
        }}
      >
        {pending ? "Enviando…" : "Enviar informações"}
      </button>
    </form>
  );
}
