"use client";

import { useState, useTransition } from "react";
import { BadgeCheck } from "lucide-react";

import { askShowcaseConsentAction } from "@/server/controllers/application.controller";
import { SHOWCASE_ASK_SUBJECT, SHOWCASE_ASK_TEXT } from "@/server/models/showcase.model";

/**
 * Aviso no topo de Candidatos: há aprovados que ainda não disseram se querem
 * aparecer em "Quem já entrou". Mostra o texto antes de enviar.
 */
export function ShowcaseAskBanner({ pending, companyName }: { pending: number; companyName: string }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  if (pending === 0 && !result) return null;

  const preview = SHOWCASE_ASK_TEXT.split("{nome}").join("Maria").split("{empresa}").join(companyName);
  const people = pending === 1 ? "1 pessoa aprovada ainda não respondeu" : `${pending} pessoas aprovadas ainda não responderam`;

  function send() {
    startTransition(async () => {
      const r = await askShowcaseConsentAction();
      setOpen(false);
      setResult(
        r.ok
          ? `Pedido enviado para ${r.sent} ${r.sent === 1 ? "pessoa" : "pessoas"}. Quem disser sim aparece na página de vagas.`
          : r.error
      );
    });
  }

  return (
    <div className="mb-4 rounded-xl border border-[#e4e4e7] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <BadgeCheck className="size-[18px] shrink-0" style={{ color: "var(--brand-primary)" }} aria-hidden />
        <p className="min-w-0 flex-1 text-[13px] text-[#3f3f46]">
          {result ?? (
            <>
              <strong className="font-semibold text-[#0a0a0a]">{people}</strong> se quer aparecer em
              “Quem já entrou” na página de vagas.
            </>
          )}
        </p>
        {!result && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold hover:opacity-90"
            style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
          >
            {open ? "Fechar" : "Pedir autorização"}
          </button>
        )}
      </div>

      {open && !result && (
        <div className="mt-3 border-t border-[#f0f0f0] pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#71717a]">
            Prévia · aviso no site e e-mail com o link da candidatura
          </p>
          <p className="mt-2 text-[13px] font-semibold text-[#0a0a0a]">{SHOWCASE_ASK_SUBJECT}</p>
          <p className="mt-1 whitespace-pre-line text-[13px] leading-6 text-[#3f3f46]">{preview}</p>
          <p className="mt-2 text-[12px] text-[#71717a]">
            O nome é trocado pelo de cada pessoa. Quem já recebeu não recebe de novo.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={send}
              className="rounded-lg px-3.5 py-2 text-[13px] font-semibold hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
            >
              {busy ? "Enviando…" : `Enviar para ${pending}`}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-[#e4e4e7] bg-white px-3.5 py-2 text-[13px] font-medium text-[#0a0a0a] hover:bg-[#fafaf9]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
