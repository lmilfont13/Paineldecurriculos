"use client";

import { useTransition } from "react";
import { BadgeCheck } from "lucide-react";

import { setShowcaseHiddenAction } from "@/server/controllers/application.controller";

/**
 * Situação do contratado na página pública ("Quem já entrou"). Quem decide
 * aparecer é o candidato; o gestor só pode ocultar ou voltar a mostrar.
 */
export function ShowcaseToggle({
  applicationId,
  consent,
  hidden,
}: {
  applicationId: string;
  consent: boolean | null;
  hidden: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const text =
    consent === true
      ? hidden
        ? "Autorizou aparecer na página de vagas, mas está oculto."
        : "Aparece em “Quem já entrou” na página de vagas."
      : consent === false
        ? "Preferiu não aparecer na página de vagas."
        : "Ainda não respondeu se quer aparecer na página de vagas.";

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-3.5 py-2.5 text-[12.5px] text-[#52525b]">
      <BadgeCheck className="size-4 shrink-0" style={{ color: "var(--brand-primary)" }} aria-hidden />
      <span className="min-w-0 flex-1">{text}</span>
      {consent === true && (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => setShowcaseHiddenAction(applicationId, !hidden))}
          className="font-medium underline underline-offset-2 hover:text-[#0a0a0a] disabled:opacity-50"
        >
          {pending ? "Salvando…" : hidden ? "Mostrar de novo" : "Ocultar da página"}
        </button>
      )}
    </div>
  );
}
