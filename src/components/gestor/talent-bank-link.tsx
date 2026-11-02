"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** Link do cadastro sem vaga: o RH copia e manda por WhatsApp, redes ou e-mail. */
export function TalentBankLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* sem permissão de área de transferência: o link continua visível para copiar à mão */
    }
  }

  return (
    <div className="mt-5 rounded-2xl border border-[#e4e4e7] bg-white p-4">
      <p className="text-sm font-semibold text-[#0a0a0a]">Cadastro sem vaga</p>
      <p className="mt-1 text-[13px] leading-5 text-[#71717a]">
        Compartilhe este link para a pessoa deixar o currículo mesmo sem ter vaga aberta. Quem se cadastrar cai na
        pasta “Cadastros espontâneos” e, quando você abrir uma vaga parecida, a IA confere quem combina. Também aparece
        um botão na página de vagas da empresa.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-10 min-w-0 flex-1 rounded-md border border-[#e4e4e7] bg-[#fafaf9] px-3 text-[13px] text-[#0a0a0a]"
        />
        <button
          type="button"
          onClick={copy}
          className="flex h-10 items-center gap-1.5 rounded-md bg-[#0a0a0a] px-4 text-[13px] font-semibold text-white hover:bg-[#27272a]"
        >
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "Copiado" : "Copiar link"}
        </button>
      </div>
    </div>
  );
}
