"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, BookmarkCheck, Zap } from "lucide-react";

import { InterviewDialog } from "@/components/gestor/interview-dialog";
import { Toast } from "@/components/gestor/toast";
import { setApplicationStatusAction } from "@/server/controllers/application.controller";
import {
  appStatusLabels,
  type AppStatusKey,
} from "@/server/models/application.model";
import { STANDBY_REASONS } from "@/server/models/standby.model";

/** Próximo passo do funil — o processo é direcional, não uma escolha livre. */
const NEXT: Partial<Record<AppStatusKey, { to: AppStatusKey; label: string }>> = {
  PENDING: { to: "SHORTLISTED", label: "Passou da triagem" },
  SHORTLISTED: { to: "INTERVIEW", label: "Chamar para entrevista" },
  STANDBY: { to: "INTERVIEW", label: "Chamar para entrevista" },
  INTERVIEW: { to: "APPROVED", label: "Aprovar" },
};

const STAGE_COPY: Record<AppStatusKey, string> = {
  PENDING: "Ainda não decidido. O candidato está esperando um retorno seu.",
  SHORTLISTED: "Passou da primeira fase. Falta chamar para a entrevista.",
  INTERVIEW: "Em entrevista. O candidato já foi avisado por e-mail.",
  STANDBY: "Guardado em stand-by no funil para próximas oportunidades.",
  APPROVED: "Aprovado. O candidato já foi avisado por e-mail.",
  REJECTED: "Processo encerrado. O candidato já foi avisado por e-mail.",
};

export type ScheduledInterview = {
  at: string; // valor para o datetime-local
  summary: string; // "Videochamada · 20 de agosto, 14:00"
  mode: string;
  location: string;
  past: boolean;
};

/** Diálogo de confirmação para reprovar (envia e-mail, não desfaz). */
function ConfirmReject({
  candidateName,
  onConfirm,
  onCancel,
}: {
  candidateName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[400px] rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-[#0a0a0a]">
          Reprovar {candidateName}?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#71717a]">
          O candidato receberá um e-mail informando o fim do processo. Esta ação
          não pode ser desfeita.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-2xl border border-[#e4e4e7] bg-white px-5 text-[13px] font-medium text-[#71717a] hover:text-[#0a0a0a]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-10 rounded-2xl bg-[#c23b3b] px-5 text-[13px] font-medium text-white hover:opacity-90"
          >
            Reprovar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Diálogo de motivo rápido para colocar em Stand-by (1 clique). */
function StandbyReasonModal({
  candidateName,
  onConfirm,
  onCancel,
}: {
  candidateName: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [customReason, setCustomReason] = useState<string>("");

  function handleSave() {
    const finalReason = (customReason.trim() || selectedReason).trim();
    onConfirm(finalReason);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[460px] rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-[#e6f4f1] text-[#0e7a6b]">
            <BookmarkCheck className="size-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#0a0a0a]">
              Colocar {candidateName.split(" ")[0]} em Stand-by
            </h2>
            <p className="text-xs text-[#71717a]">
              Selecione o motivo para lembrar no futuro ou use 1 clique:
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {STANDBY_REASONS.map((r) => {
            const isSelected = selectedReason === r && !customReason.trim();
            return (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setSelectedReason(r);
                  setCustomReason("");
                }}
                className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                  isSelected
                    ? "border-[#0e7a6b] bg-[#e6f4f1] text-[#0e7a6b]"
                    : "border-[#e4e4e7] bg-[#fafaf9] text-[#52525b] hover:border-[#0e7a6b]/50 hover:bg-white"
                }`}
              >
                {r}
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          <label className="block text-[11px] font-medium text-[#71717a]">
            Ou escreva uma observação personalizada:
          </label>
          <input
            type="text"
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="Ex.: Gostei muito, mas mudará de cidade no próximo mês"
            maxLength={100}
            className="mt-1 h-9 w-full rounded-xl border border-[#e4e4e7] px-3 text-xs text-[#0a0a0a] focus:border-[#0e7a6b] focus:outline-none"
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[#f4f4f5] pt-4">
          <button
            type="button"
            onClick={() => onConfirm("")}
            className="text-xs text-[#71717a] hover:text-[#0a0a0a] hover:underline"
          >
            Guardar sem motivo
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-9 rounded-xl border border-[#e4e4e7] px-4 text-xs font-medium text-[#71717a] hover:text-[#0a0a0a]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="h-9 rounded-xl bg-[#0e7a6b] px-4 text-xs font-semibold text-white hover:opacity-90"
            >
              Confirmar Stand-by
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Decisão do gestor (E4) — um lugar só. Avanço no funil como ação primária,
 * reprovação separada por peso, e a correção de etapa escondida atrás de um
 * controle secundário, porque voltar é conserto de erro e não escolha comum.
 * Regra 2: a IA nunca chama nada disto; o status é sempre decisão manual.
 */
export function DecisionBlock({
  applicationId,
  status,
  candidateName,
  candidatePhone,
  jobTitle,
  hasEmail,
  hasAccount,
  interview,
  queue,
}: {
  applicationId: string;
  status: AppStatusKey;
  candidateName: string;
  candidatePhone?: string;
  jobTitle?: string;
  hasEmail?: boolean;
  hasAccount?: boolean;
  interview?: ScheduledInterview | null;
  queue?: {
    prevId: string | null;
    nextId: string | null;
    nextPendingId: string | null;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [standbyModal, setStandbyModal] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [lastMoved, setLastMoved] = useState<AppStatusKey | null>(null);

  const next = NEXT[status];
  const closed = status === "APPROVED" || status === "REJECTED";

  function apply(to: AppStatusKey, standbyReason?: string) {
    startTransition(async () => {
      await setApplicationStatusAction(applicationId, to, standbyReason);
      setLastMoved(to);
      const reasonTag = standbyReason ? ` (${standbyReason})` : "";
      setToast(`Movido para "${appStatusLabels[to]}"${reasonTag}.`);
    });
  }

  return (
    <section className="mt-8 rounded-xl border border-[#e4e4e7] bg-white p-5">
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      {confirming && (
        <ConfirmReject
          candidateName={candidateName}
          onConfirm={() => {
            setConfirming(false);
            apply("REJECTED");
          }}
          onCancel={() => setConfirming(false)}
        />
      )}

      {standbyModal && (
        <StandbyReasonModal
          candidateName={candidateName}
          onConfirm={(reason) => {
            setStandbyModal(false);
            apply("STANDBY", reason);
          }}
          onCancel={() => setStandbyModal(false)}
        />
      )}

      {scheduling && (
        <InterviewDialog
          applicationId={applicationId}
          candidateName={candidateName}
          candidatePhone={candidatePhone}
          jobTitle={jobTitle}
          hasEmail={hasEmail}
          hasAccount={hasAccount}
          current={
            interview
              ? {
                  at: interview.at,
                  mode: interview.mode,
                  location: interview.location,
                }
              : null
          }
          title={
            interview
              ? `Remarcar com ${candidateName.split(" ")[0]}`
              : `Marcar conversa com ${candidateName.split(" ")[0]}`
          }
          onClose={() => setScheduling(false)}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold text-[#0a0a0a]">
          {appStatusLabels[status]}
        </h2>
        <span className="text-[13px] text-[#71717a]">{STAGE_COPY[status]}</span>
      </div>

      {/* O combinado, à vista: sem isto "Entrevista" é um status que mente */}
      {status === "INTERVIEW" && (
        <p
          className={
            "mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3.5 py-2.5 text-[13px] " +
            (interview
              ? "bg-[#fdfaf3] text-[#0a0a0a]"
              : "bg-[#f4f4f5] text-[#71717a]")
          }
        >
          {interview ? (
            <>
              <span className="font-medium">{interview.summary}</span>
              {interview.location && (
                <span className="text-[#71717a]">{interview.location}</span>
              )}
              {interview.past && (
                <span className="text-[11px] font-medium text-[#b07818]">
                  já aconteceu, falta decidir
                </span>
              )}
              <button
                type="button"
                onClick={() => setScheduling(true)}
                className="text-[12px] font-medium text-[#71717a] underline hover:text-[#0a0a0a]"
              >
                remarcar
              </button>
            </>
          ) : (
            <>
              Nenhum horário combinado ainda.
              <button
                type="button"
                onClick={() => setScheduling(true)}
                className="text-[12px] font-medium underline"
                style={{ color: "var(--brand-primary)" }}
              >
                marcar agora
              </button>
            </>
          )}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {next && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              next.to === "INTERVIEW" ? setScheduling(true) : apply(next.to)
            }
            className="h-10 rounded-2xl px-5 text-[13px] font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              backgroundColor: "var(--brand-primary)",
              color: "var(--brand-foreground)",
            }}
          >
            {pending ? "Salvando…" : next.label}
          </button>
        )}
        {status === "PENDING" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setScheduling(true)}
            className="text-[13px] font-medium text-[#71717a] hover:text-[#0a0a0a] disabled:opacity-50"
          >
            Chamar direto para entrevista
          </button>
        )}
        {status === "SHORTLISTED" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => apply("INTERVIEW")}
            className="text-[13px] font-medium text-[#71717a] hover:text-[#0a0a0a] disabled:opacity-50"
          >
            Avançar sem marcar
          </button>
        )}
        {status !== "STANDBY" && status !== "APPROVED" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setStandbyModal(true)}
            className="h-10 rounded-2xl border border-[#b7e4dc] bg-[#f2fbf9] px-5 text-[13px] font-medium text-[#0e7a6b] hover:bg-[#e6f7f3] disabled:opacity-50"
            title="Guarda em stand-by com seleção rápida de motivo"
          >
            Colocar em stand-by
          </button>
        )}
        {status !== "REJECTED" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirming(true)}
            className="h-10 rounded-2xl border border-[#e8d5d2] bg-white px-5 text-[13px] font-medium text-[#c23b3b] hover:bg-[#fdf7f6] disabled:opacity-50"
          >
            Reprovar
          </button>
        )}
        {!correcting ? (
          <button
            type="button"
            onClick={() => setCorrecting(true)}
            className="text-[13px] font-medium text-[#a1a1aa] hover:text-[#0a0a0a]"
          >
            {closed ? "Reabrir processo…" : "Corrigir etapa…"}
          </button>
        ) : (
          <span className="flex items-center gap-2">
            <label
              htmlFor="corrigir-etapa"
              className="text-[13px] text-[#71717a]"
            >
              Mover para
            </label>
            <select
              id="corrigir-etapa"
              defaultValue={status}
              disabled={pending}
              onChange={(e) => {
                const to = e.target.value as AppStatusKey;
                setCorrecting(false);
                if (to === status) return;
                if (to === "REJECTED") setConfirming(true);
                else apply(to);
              }}
              className="h-9 rounded-lg border border-[#e4e4e7] bg-white px-2 text-[13px] text-[#0a0a0a] focus:border-[#0a0a0a] focus:outline-none"
            >
              {Object.entries(appStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </span>
        )}
      </div>

      {(queue?.nextPendingId || queue?.nextId) && (
        <div className="mt-5 flex items-center justify-between rounded-xl bg-[#fafaf9] p-3 text-xs">
          <span className="text-[#71717a]">
            {lastMoved ? "Decisão registrada. Deseja avançar?" : "Continuar fila desta vaga:"}
          </span>
          <Link
            href={`/candidaturas/${queue.nextPendingId || queue.nextId}`}
            className="inline-flex items-center gap-1 font-semibold text-[#0a0a0a] hover:underline"
            style={{ color: "var(--brand-primary)" }}
          >
            {queue.nextPendingId && <Zap className="size-3 text-[#b07818]" />}
            <span>{queue.nextPendingId ? "Próximo a triar" : "Próximo candidato"}</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}
    </section>
  );
}
