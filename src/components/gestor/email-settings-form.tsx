"use client";

import { useActionState } from "react";

import {
  updateEmailSettingsAction,
  type SettingsState,
} from "@/server/controllers/settings.controller";

type Initial = {
  email: string;
  senderEmail: string;
  effectiveSender: string;
  sandbox: boolean;
};

const input =
  "h-9 w-full rounded-lg border border-[#e4e4e7] bg-white px-3 text-[13px] text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none";

/** E-mails do sistema: respostas dos candidatos e remetente, com o estado do envio. */
export function EmailSettingsForm({ initial }: { initial: Initial }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    updateEmailSettingsAction,
    null
  );

  return (
    <form action={action} className="mt-3 space-y-4">
      {initial.sandbox ? (
        <div className="rounded-lg border border-[#f0e3c8] bg-[#fdfaf3] px-4 py-3 text-[12px] leading-5 text-[#7a5a14]">
          <strong>Envio em modo de teste.</strong> Hoje os e-mails saem de{" "}
          <span className="font-medium">{initial.effectiveSender}</span>, e o Resend só entrega nesse modo para o dono da
          conta, não para os candidatos. Para os candidatos receberem, verifique o seu domínio no Resend (resend.com
          &gt; Domains) e informe abaixo um remetente desse domínio.
        </div>
      ) : (
        <div className="rounded-lg border border-[#d6efde] bg-[#f0faf4] px-4 py-3 text-[12px] leading-5 text-[#1f6f46]">
          Os e-mails saem de <strong>{initial.effectiveSender}</strong>.
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="settings-email" className="text-[12px] font-medium text-[#71717a]">
          E-mail da empresa (respostas dos candidatos)
        </label>
        <input
          id="settings-email"
          name="email"
          type="email"
          required
          defaultValue={initial.email}
          placeholder="rh@suaempresa.com.br"
          className={input}
        />
        <p className="text-[11px] text-[#a1a1aa]">
          Quando um candidato responde a um e-mail do sistema, a resposta chega aqui.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="settings-sender" className="text-[12px] font-medium text-[#71717a]">
          Remetente dos e-mails (opcional)
        </label>
        <input
          id="settings-sender"
          name="senderEmail"
          type="email"
          defaultValue={initial.senderEmail}
          placeholder="rh@suaempresa.com.br"
          className={input}
        />
        <p className="text-[11px] leading-4 text-[#a1a1aa]">
          Endereço de onde os e-mails saem. Só funciona se o domínio dele estiver verificado no Resend; com um endereço
          não verificado os e-mails deixam de ser enviados. Deixe vazio para usar o padrão do sistema.
        </p>
      </div>

      {state && "error" in state && (
        <p role="alert" className="text-[12px] text-[#c23b3b]">
          {state.error}
        </p>
      )}
      {state && "ok" in state && (
        <p className="text-[12px] text-[#1f7a4d]">Configurações de e-mail salvas.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-xl px-5 text-[13px] font-semibold disabled:opacity-60"
        style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
      >
        {pending ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}
