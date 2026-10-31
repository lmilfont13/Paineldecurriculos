"use client";

import { useState, useTransition } from "react";

import { sendBulkMessageAction } from "@/server/controllers/application.controller";
import { REJECTION_TEMPLATE, fillTemplate } from "@/server/models/message-templates.model";
import type { BulkMessageResult } from "@/server/services/bulk-message.service";

type Sent = Extract<BulkMessageResult, { ok: true }>;

/** Recado para vários candidatos de uma vez, com confirmação antes de enviar. */
export function BulkMessageDialog({
  ids,
  names,
  sample,
  companyName,
  templates,
  onClose,
  onDone,
}: {
  /** Candidaturas selecionadas. */
  ids: string[];
  /** Até 3 nomes, só para o gestor reconhecer a seleção. */
  names: string[];
  /** Primeiro destinatário: base da pré-visualização. */
  sample: { firstName: string; jobTitle: string } | null;
  companyName: string;
  templates: { id: string; subject: string; body: string }[];
  onClose: () => void;
  /** Depois de um envio com sucesso (a lista limpa a seleção). */
  onDone: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [pending, start] = useTransition();
  const count = ids.length;

  const preview =
    sample && text.trim()
      ? fillTemplate(text, { firstName: sample.firstName, companyName, jobTitle: sample.jobTitle })
      : "";
  const canSend = text.trim().length >= 2 && confirmed && !pending;

  function send() {
    setError(null);
    start(async () => {
      const result = await sendBulkMessageAction(ids, subject, text);
      if (result.ok) {
        setSent(result);
        onDone();
      } else {
        setError(result.error);
      }
    });
  }

  const chip =
    "rounded-full border border-[#e4e4e7] bg-white px-3 py-1 text-[11px] font-medium text-[#0a0a0a] hover:border-[#0a0a0a]";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Enviar mensagem em massa"
    >
      <div className="max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        {sent ? (
          <>
            <h2 className="text-lg font-semibold text-[#0a0a0a]">Mensagem enviada</h2>
            <p className="mt-2 text-sm leading-6 text-[#57534e]">
              {sent.total} candidato{sent.total === 1 ? "" : "s"}: {sent.notified} receberam o aviso no site e{" "}
              {sent.emailed} estão recebendo e-mail agora.
            </p>
            {sent.noChannel > 0 && (
              <p className="mt-2 text-[13px] text-[#a16207]">
                {sent.noChannel} não têm conta no site nem e-mail válido, então ninguém foi avisado nesses casos.
              </p>
            )}
            {sent.skipped > 0 && (
              <p className="mt-2 text-[13px] text-[#71717a]">
                {sent.skipped} candidatura{sent.skipped === 1 ? "" : "s"} não entrou (demonstração ou fora da empresa).
              </p>
            )}
            <button
              type="button"
              onClick={onClose}
              className="mt-5 h-10 rounded-xl px-5 text-sm font-semibold"
              style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
            >
              Fechar
            </button>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-[#0a0a0a]">
              Enviar mensagem para {count} candidato{count === 1 ? "" : "s"}
            </h2>
            <p className="mt-1 text-[12px] text-[#71717a]">
              {names.join(", ")}
              {count > names.length ? ` e mais ${count - names.length}` : ""}. Cada um recebe o aviso no site e por
              e-mail, com o nome e a vaga dele.
            </p>

            <div className="mt-4 flex flex-wrap gap-1.5">
              <button
                type="button"
                className={chip}
                onClick={() => {
                  setSubject("Retorno sobre sua candidatura");
                  setText(REJECTION_TEMPLATE);
                }}
              >
                Negativa
              </button>
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={chip}
                  onClick={() => {
                    setSubject(t.subject);
                    setText(t.body);
                  }}
                >
                  {t.subject}
                </button>
              ))}
            </div>

            <label className="mt-4 block text-[12px] font-medium text-[#71717a]">Assunto (opcional)</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={80}
              placeholder="Ex.: Retorno sobre sua candidatura"
              className="mt-1 h-10 w-full rounded-lg border border-[#e4e4e7] px-3 text-[13px] focus:border-[#0a0a0a] focus:outline-none"
            />

            <label className="mt-3 block text-[12px] font-medium text-[#71717a]">Mensagem</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              maxLength={2000}
              placeholder="Escreva aqui. Use {nome}, {vaga} e {empresa}: cada pessoa recebe o dela."
              className="mt-1 w-full resize-y rounded-lg border border-[#e4e4e7] p-3 text-[13px] leading-5 focus:border-[#0a0a0a] focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-[#a1a1aa]">
              Marcadores: {"{nome}"}, {"{vaga}"} e {"{empresa}"}. Com assunto, o texto fica salvo para os próximos envios.
            </p>

            {preview && (
              <div className="mt-3 rounded-lg border border-[#ebe7e3] bg-[#fdfcfb] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
                  Como {sample?.firstName} vai receber
                </p>
                <p className="mt-1 whitespace-pre-line text-[13px] leading-5 text-[#3f3f46]">{preview}</p>
              </div>
            )}

            <label className="mt-4 flex items-start gap-2.5 text-[13px] text-[#0a0a0a]">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 size-4 accent-[#0a0a0a]"
              />
              <span>
                Confirmo o envio para <strong>{count}</strong> candidato{count === 1 ? "" : "s"}. Não dá para desfazer.
              </span>
            </label>

            {error && (
              <p role="alert" className="mt-3 text-[13px] text-[#c23b3b]">
                {error}
              </p>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="h-10 rounded-xl border border-[#e4e4e7] px-4 text-sm text-[#71717a] hover:text-[#0a0a0a]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={send}
                disabled={!canSend}
                className="h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
              >
                {pending ? "Enviando…" : `Enviar para ${count}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
