"use client";

import { useState, useTransition } from "react";

import { InterviewDialog } from "@/components/gestor/interview-dialog";
import { Toast } from "@/components/gestor/toast";
import { setApplicationStatusAction } from "@/server/controllers/application.controller";
import {
  appStatusLabels,
  type AppStatusKey,
} from "@/server/models/application.model";

/** Próximo passo do funil — o processo é direcional, não uma escolha livre. */
const NEXT: Partial<Record<AppStatusKey, { to: AppStatusKey; label: string }>> = {
  PENDING: { to: "INTERVIEW", label: "Chamar para entrevista" },
  INTERVIEW: { to: "APPROVED", label: "Aprovar" },
};

const STAGE_COPY: Record<AppStatusKey, string> = {
  PENDING: "Ainda não decidido. O candidato está esperando um retorno seu.",
  INTERVIEW: "Em entrevista. O candidato já foi avisado por e-mail.",
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
  interview,
}: {
  applicationId: string;
  status: AppStatusKey;
  candidateName: string;
  interview?: ScheduledInterview | null;
}) {
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  const next = NEXT[status];
  const closed = status === "APPROVED" || status === "REJECTED";

  function apply(to: AppStatusKey) {
    startTransition(async () => {
      await setApplicationStatusAction(applicationId, to);
      setToast(`Movido para "${appStatusLabels[to]}".`);
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

      {scheduling && (
        <InterviewDialog
          applicationId={applicationId}
          candidateName={candidateName}
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
            onClick={() => apply("INTERVIEW")}
            className="text-[13px] font-medium text-[#71717a] hover:text-[#0a0a0a] disabled:opacity-50"
          >
            Avançar sem marcar
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
    </section>
  );
}
