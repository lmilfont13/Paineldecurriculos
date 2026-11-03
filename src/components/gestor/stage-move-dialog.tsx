"use client";

import { useState } from "react";

import { appStatusLabels, type AppStatusKey } from "@/server/models/application.model";
import { stageMovePreview } from "@/server/models/stage-message.model";

export type MoveNoticeChoice =
  | { mode: "standard" }
  | { mode: "silent" }
  | { mode: "custom"; subject: string; text: string };

/**
 * Ao mover um candidato no funil: mostra exatamente o que ele vai receber
 * (e-mail e/ou aviso na área dele — o mesmo texto do envio) e deixa o gestor
 * enviar como está, editar antes ou mover sem avisar.
 */
export function StageMoveDialog({
  candidateName,
  from,
  to,
  companyName,
  jobTitle,
  pending,
  onCancel,
  onConfirm,
}: {
  candidateName: string;
  from: AppStatusKey;
  to: AppStatusKey;
  companyName: string;
  jobTitle: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (notice: MoveNoticeChoice) => void;
}) {
  const preview = stageMovePreview(to, { candidateName, companyName, jobTitle });
  const hasMessage = Boolean(preview.email || preview.site);
  const firstName = candidateName.trim().split(/\s+/)[0] || "O candidato";
  const defaultSubject = preview.email?.subject ?? preview.site?.title ?? "";
  const defaultText = preview.email
    ? `${preview.email.title}\n\n${preview.email.body}`
    : (preview.site?.body ?? "");

  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(defaultSubject);
  const [text, setText] = useState(defaultText);
  const edited = editing && (subject !== defaultSubject || text !== defaultText);
  const danger = to === "REJECTED";

  function confirm() {
    if (!hasMessage) return onConfirm({ mode: "silent" });
    if (edited) return onConfirm({ mode: "custom", subject, text });
    onConfirm({ mode: "standard" });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Mover ${candidateName}`}
      onClick={() => !pending && onCancel()}
    >
      <div
        className="max-h-[92vh] w-full max-w-[540px] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">Mover candidato</p>
        <h3 className="mt-1 text-lg font-semibold text-[#0a0a0a]">{candidateName}</h3>
        <p className="mt-1 flex items-center gap-2 text-[13px] text-[#71717a]">
          <span className="rounded-full bg-[#f4f4f5] px-2 py-0.5">{appStatusLabels[from]}</span>
          <span aria-hidden>→</span>
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${
              danger ? "bg-[#fbeae8] text-[#c23b3b]" : "bg-[#0a0a0a] text-white"
            }`}
          >
            {appStatusLabels[to]}
          </span>
        </p>

        <p className="mt-5 text-[12px] font-medium text-[#0a0a0a]">
          {hasMessage ? `O que ${firstName} vai receber` : "Aviso ao candidato"}
        </p>

        {!hasMessage && (
          <p className="mt-2 rounded-xl border border-dashed border-[#e4e4e7] p-4 text-[13px] text-[#71717a]">
            Nada é enviado: voltar para a triagem é um ajuste interno e não vira aviso para o candidato.
          </p>
        )}

        {hasMessage && !editing && (
          <div className="mt-2 space-y-2">
            {preview.email && (
              <div className="rounded-xl border border-[#e4e4e7] bg-[#fafaf9] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">E-mail</p>
                <p className="mt-1 text-[12px] text-[#71717a]">
                  Assunto: <span className="font-medium text-[#0a0a0a]">{preview.email.subject}</span>
                </p>
                <div className="mt-3 rounded-lg bg-white p-3 text-[13px] leading-5 text-[#3f3f46] shadow-xs">
                  <p className="font-semibold text-[#0a0a0a]">{preview.email.title}</p>
                  <p className="mt-2">{preview.email.greeting}</p>
                  <p className="mt-1">{preview.email.body}</p>
                  <p className="mt-2 text-[11px] font-medium" style={{ color: "var(--brand-primary)" }}>
                    Botão: Ver na minha área
                  </p>
                </div>
              </div>
            )}
            {preview.site && (
              <div className="rounded-xl border border-[#e4e4e7] bg-[#fafaf9] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
                  Aviso na área do candidato
                </p>
                <p className="mt-1 text-[13px] font-semibold text-[#0a0a0a]">{preview.site.title}</p>
                <p className="mt-0.5 text-[13px] leading-5 text-[#3f3f46]">{preview.site.body}</p>
              </div>
            )}
          </div>
        )}

        {hasMessage && editing && (
          <div className="mt-2">
            <label className="block text-[12px] font-medium text-[#71717a]">Assunto</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={80}
              className="mt-1 h-10 w-full rounded-lg border border-[#e4e4e7] px-3 text-[13px] focus:border-[#0a0a0a] focus:outline-none"
            />
            <label className="mt-3 block text-[12px] font-medium text-[#71717a]">Mensagem</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              maxLength={2000}
              className="mt-1 w-full resize-y rounded-lg border border-[#e4e4e7] p-3 text-[13px] leading-5 focus:border-[#0a0a0a] focus:outline-none"
            />
            <p className="mt-1 text-[11px] leading-4 text-[#a1a1aa]">
              {edited
                ? "Vai como recado, por e-mail e na área do candidato, no lugar da mensagem padrão — uma só."
                : "Altere o texto para enviar a sua versão. Sem alteração, vai a mensagem padrão."}
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {hasMessage && (
              <button
                type="button"
                onClick={() => {
                  if (editing) {
                    setSubject(defaultSubject);
                    setText(defaultText);
                  }
                  setEditing((v) => !v);
                }}
                disabled={pending}
                className="text-[12px] font-medium text-[#0a0a0a] underline-offset-2 hover:underline"
              >
                {editing ? "Voltar à mensagem padrão" : "Editar mensagem"}
              </button>
            )}
            {hasMessage && (
              <button
                type="button"
                onClick={() => onConfirm({ mode: "silent" })}
                disabled={pending}
                className="text-[12px] text-[#71717a] underline-offset-2 hover:text-[#0a0a0a] hover:underline"
              >
                Mover sem avisar
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="h-10 rounded-xl border border-[#e4e4e7] px-4 text-[13px] font-medium text-[#57534e]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={pending || (edited && text.trim().length < 2)}
              className={`h-10 rounded-xl px-4 text-[13px] font-semibold disabled:opacity-50 ${danger ? "bg-[#c23b3b] text-white" : ""}`}
              style={danger ? undefined : { backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
            >
              {pending ? "Salvando…" : !hasMessage ? "Mover" : edited ? "Mover e enviar minha versão" : "Mover e enviar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
