"use client";

import { useMemo, useState, useTransition } from "react";

import { CandidateAvatar } from "@/components/gestor/candidate-avatar";
import { bulkRejectWithMessageAction } from "@/server/controllers/application.controller";
import { DEFAULT_CHANNELS } from "@/server/models/contact-channels.model";
import { REJECTION_TEMPLATE, fillTemplate } from "@/server/models/message-templates.model";
import type { BulkRejectResult } from "@/server/services/bulk-reject.service";

type Done = Extract<BulkRejectResult, { ok: true }>;

export type RejectCandidate = {
  id: string;
  name: string;
  aiScore: number | null;
  /** IA ainda lendo o currículo: começa desmarcado (ainda não dá para comparar). */
  analyzing: boolean;
  photoUrl?: string | null;
};

const DEFAULT_SUBJECT = "Retorno sobre sua candidatura";

/**
 * Reprovar de uma vez quem ficou na triagem, com a mensagem de agradecimento
 * escolhida. Cada pessoa recebe uma mensagem só (a escolhida), por e-mail e
 * na área do candidato, e continua no banco de talentos.
 */
export function BulkRejectDialog({
  jobId,
  jobTitle,
  companyName,
  candidates,
  templates,
  onClose,
  onDone,
}: {
  jobId: string;
  jobTitle: string;
  companyName: string;
  candidates: RejectCandidate[];
  templates: { id: string; subject: string; body: string }[];
  onClose: () => void;
  onDone: (rejectedIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(candidates.filter((c) => !c.analyzing).map((c) => c.id))
  );
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [text, setText] = useState(REJECTION_TEMPLATE);
  const [activePreset, setActivePreset] = useState<string>("default");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [pending, start] = useTransition();

  const chosen = candidates.filter((c) => selected.has(c.id));
  const count = chosen.length;
  const analyzingCount = candidates.filter((c) => c.analyzing).length;
  const sampleName = (chosen[0]?.name ?? candidates[0]?.name ?? "").trim().split(/\s+/)[0] ?? "";
  const preview = useMemo(
    () => (text.trim() ? fillTemplate(text, { firstName: sampleName, companyName, jobTitle }) : ""),
    [text, sampleName, companyName, jobTitle]
  );
  const canSend = count > 0 && text.trim().length >= 2 && confirmed && !pending;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function pick(id: string, nextSubject: string, body: string) {
    setActivePreset(id);
    setSubject(nextSubject);
    setText(body);
  }

  function send() {
    setError(null);
    start(async () => {
      try {
        const result = await bulkRejectWithMessageAction(
          jobId,
          chosen.map((c) => c.id),
          subject,
          text,
          [...DEFAULT_CHANNELS]
        );
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setDone(result);
        onDone(result.rejectedIds);
      } catch {
        setError("Falha de conexão. Recarregue a página para ver quem já foi reprovado antes de tentar de novo.");
      }
    });
  }

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-[11px] font-medium transition ${
      active
        ? "border-[#0a0a0a] bg-[#0a0a0a] text-white"
        : "border-[#e4e4e7] bg-white text-[#0a0a0a] hover:border-[#0a0a0a]"
    }`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Reprovar quem ficou na triagem"
      onClick={() => !pending && !done && onClose()}
    >
      <div
        className="max-h-[92vh] w-full max-w-[600px] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <>
            <h2 className="text-lg font-semibold text-[#0a0a0a]">Pronto</h2>
            <p className="mt-2 text-sm leading-6 text-[#57534e]">
              {done.rejected} candidato{done.rejected === 1 ? " foi reprovado" : "s foram reprovados"} e
              {done.message?.ok
                ? ` ${done.message.emailed === 1 ? "está recebendo" : "estão recebendo"} a mensagem por e-mail (${done.message.emailed}) e na área do candidato (${done.message.notified}).`
                : " não houve envio de mensagem."}{" "}
              Todos continuam no banco de talentos.
            </p>
            {done.message?.ok && done.message.noChannel > 0 && (
              <p className="mt-2 text-[13px] text-[#a16207]">
                {done.message.noChannel} não têm e-mail válido nem conta no site: foram reprovados, mas não
                receberam a mensagem.
              </p>
            )}
            {done.skipped > 0 && (
              <p className="mt-2 text-[13px] text-[#71717a]">
                {done.skipped} já tinha{done.skipped === 1 ? "" : "m"} saído da triagem e ficou como estava.
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">
              Reprovar em massa
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#0a0a0a]">
              Reprovar quem ficou na triagem
            </h2>
            <p className="mt-1 text-[13px] leading-5 text-[#71717a]">
              Eles saem do funil desta vaga e recebem a mensagem abaixo — uma só, por e-mail e na área do
              candidato. O cadastro continua no banco de talentos para as próximas vagas.
            </p>

            {/* Quem será reprovado */}
            <div className="mt-4 flex items-center justify-between">
              <p className="text-[12px] font-medium text-[#0a0a0a]">
                {count} de {candidates.length} selecionado{count === 1 ? "" : "s"}
              </p>
              <div className="flex gap-3 text-[11px] font-medium text-[#71717a]">
                <button type="button" onClick={() => setSelected(new Set(candidates.map((c) => c.id)))} className="hover:text-[#0a0a0a]">
                  Marcar todos
                </button>
                <button type="button" onClick={() => setSelected(new Set())} className="hover:text-[#0a0a0a]">
                  Desmarcar todos
                </button>
              </div>
            </div>
            {analyzingCount > 0 && (
              <p className="mt-1 text-[11px] text-[#a16207]">
                {analyzingCount} ainda {analyzingCount === 1 ? "está" : "estão"} com o currículo em análise pela IA e
                começa{analyzingCount === 1 ? "" : "m"} desmarcado{analyzingCount === 1 ? "" : "s"}.
              </p>
            )}
            <ul className="mt-2 max-h-52 divide-y divide-[#f4f4f5] overflow-y-auto rounded-xl border border-[#e4e4e7]">
              {candidates.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-[#fafaf9]">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                      className="size-4 shrink-0 accent-[#0a0a0a]"
                    />
                    <CandidateAvatar
                      name={c.name}
                      photoUrl={c.photoUrl}
                      className="size-7 rounded-lg bg-[#1c1917] text-[10px] font-bold text-white"
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-[#0a0a0a]">{c.name}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-[#71717a]">
                      {c.analyzing ? "IA analisando" : c.aiScore !== null ? `nota ${c.aiScore}` : "sem nota"}
                    </span>
                  </label>
                </li>
              ))}
            </ul>

            {/* Mensagem */}
            <p className="mt-5 text-[12px] font-medium text-[#0a0a0a]">Mensagem</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                className={chip(activePreset === "default")}
                onClick={() => pick("default", DEFAULT_SUBJECT, REJECTION_TEMPLATE)}
              >
                Agradecimento padrão
              </button>
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={chip(activePreset === t.id)}
                  onClick={() => pick(t.id, t.subject, t.body)}
                >
                  {t.subject}
                </button>
              ))}
            </div>

            <label className="mt-3 block text-[12px] font-medium text-[#71717a]">Assunto</label>
            <input
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setActivePreset("");
              }}
              maxLength={80}
              className="mt-1 h-10 w-full rounded-lg border border-[#e4e4e7] px-3 text-[13px] focus:border-[#0a0a0a] focus:outline-none"
            />
            <label className="mt-3 block text-[12px] font-medium text-[#71717a]">Texto</label>
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setActivePreset("");
              }}
              rows={6}
              maxLength={2000}
              className="mt-1 w-full resize-y rounded-lg border border-[#e4e4e7] p-3 text-[13px] leading-5 focus:border-[#0a0a0a] focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-[#a1a1aa]">
              {"{nome}"}, {"{vaga}"} e {"{empresa}"} viram o nome, a vaga e a empresa de cada pessoa. O texto fica salvo
              como modelo com este assunto.
            </p>

            {preview && (
              <div className="mt-3 rounded-lg border border-[#ebe7e3] bg-[#fdfcfb] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
                  Como {sampleName || "o candidato"} vai receber
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
                Confirmo reprovar <strong>{count}</strong> candidato{count === 1 ? "" : "s"} e enviar a mensagem. A
                etapa dá para mudar depois; a mensagem enviada, não.
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
                className="h-10 rounded-xl bg-[#c23b3b] px-5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Reprovando e enviando…" : `Reprovar e enviar para ${count}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
