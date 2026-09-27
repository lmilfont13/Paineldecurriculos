"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  sendMessageAction,
  type InterviewState,
} from "@/server/controllers/application.controller";

/**
 * Recado do gestor para o candidato. Mão única de propósito: um canal de duas
 * mãos traria moderação e uma caixa de entrada para o gestor gerenciar. O
 * e-mail sai com responder-para do gestor, então a resposta chega onde ele já lê.
 */
export function MessageBox({
  applicationId,
  candidateName,
}: {
  applicationId: string;
  candidateName: string;
}) {
  const [state, formAction, pending] = useActionState<InterviewState, FormData>(
    sendMessageAction.bind(null, applicationId),
    null
  );
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const sent = state !== null && "ok" in state;

  useEffect(() => {
    if (sent) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [sent]);

  if (!open) {
    return (
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-9 rounded-2xl border border-[#0a0a0a]/85 bg-white px-4 text-xs font-medium text-[#0a0a0a] hover:bg-[#fafaf9]"
        >
          Enviar recado
        </button>
        {sent && (
          <span className="text-xs text-[#1f7a4d]">
            Recado enviado. {candidateName.split(" ")[0]} recebeu por e-mail e
            na área dele.
          </span>
        )}
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="mt-3">
      <textarea
        name="message"
        rows={3}
        autoFocus
        placeholder={`Escreva para ${candidateName.split(" ")[0]}. Ex.: "Pode enviar um portfólio dos seus projetos?"`}
        className="w-full resize-y rounded-lg border border-[#e4e4e7] bg-white p-3 text-[13px] leading-5 text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none"
      />
      <p className="mt-1.5 text-[11px] text-[#a1a1aa]">
        Vai por e-mail e aparece nas novidades do candidato. Ele responde no
        seu e-mail.
      </p>
      {state && "error" in state && (
        <p role="alert" className="mt-2 text-[13px] text-[#c23b3b]">
          {state.error}
        </p>
      )}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-2xl px-4 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{
            backgroundColor: "var(--brand-primary)",
            color: "var(--brand-foreground)",
          }}
        >
          {pending ? "Enviando…" : "Enviar recado"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setOpen(false)}
          className="text-xs font-medium text-[#71717a] hover:text-[#0a0a0a]"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
