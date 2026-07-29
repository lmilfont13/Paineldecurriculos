"use client";

import { useState, useTransition } from "react";

import { Toast } from "@/components/gestor/toast";
import { setApplicationStatusAction } from "@/server/controllers/application.controller";
import {
  appStatusLabels,
  type AppStatusKey,
} from "@/server/models/application.model";

const ORDER: AppStatusKey[] = ["PENDING", "INTERVIEW", "APPROVED", "REJECTED"];

/** Diálogo de confirmação para reprovar (envia e-mail, não desfaz). */
function ConfirmReject({
  candidateName,
  onConfirm,
  onCancel,
}: {
  candidateName?: string;
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
          Reprovar {candidateName ?? "esta candidatura"}?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#71717a]">
          O candidato receberá um e-mail informando o fim do processo. Esta
          ação não pode ser desfeita.
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

/** Controle segmentado de status do processo (E4) — decisão manual do gestor. */
export function StatusSegment({
  applicationId,
  status,
  candidateName,
}: {
  applicationId: string;
  status: AppStatusKey;
  candidateName?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function apply(key: AppStatusKey) {
    startTransition(async () => {
      await setApplicationStatusAction(applicationId, key);
      setToast(`Status atualizado para "${appStatusLabels[key]}".`);
    });
  }

  return (
    <div
      role="radiogroup"
      aria-label="Status do processo"
      className="grid h-10 grid-cols-4 gap-1 rounded-lg bg-[#f4f4f5] p-[3px]"
    >
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
      {ORDER.map((key) => {
        const active = key === status;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={pending}
            onClick={() => {
              if (active) return;
              if (key === "REJECTED") setConfirming(true);
              else apply(key);
            }}
            className={
              "rounded-md text-xs transition-colors " +
              (active
                ? "bg-white font-medium text-[#0a0a0a] shadow-sm"
                : "text-[#71717a] hover:text-[#0a0a0a]") +
              (pending ? " opacity-60" : "")
            }
          >
            {appStatusLabels[key]}
          </button>
        );
      })}
    </div>
  );
}

/** Botões Aprovar / Reprovar do rodapé da E4. */
export function DecisionButtons({
  applicationId,
  status,
  candidateName,
}: {
  applicationId: string;
  status: AppStatusKey;
  candidateName?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex gap-3">
      {confirming && (
        <ConfirmReject
          candidateName={candidateName}
          onConfirm={() => {
            setConfirming(false);
            startTransition(() =>
              setApplicationStatusAction(applicationId, "REJECTED")
            );
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
      <button
        type="button"
        disabled={pending || status === "APPROVED"}
        onClick={() =>
          startTransition(() =>
            setApplicationStatusAction(applicationId, "APPROVED")
          )
        }
        className="h-10 w-[130px] rounded-2xl text-[13px] font-medium hover:opacity-90 disabled:opacity-50"
        style={{
          backgroundColor: "var(--brand-primary)",
          color: "var(--brand-foreground)",
        }}
      >
        Aprovar
      </button>
      <button
        type="button"
        disabled={pending || status === "REJECTED"}
        onClick={() => setConfirming(true)}
        className="h-10 w-[130px] rounded-2xl border border-[#e8d5d2] bg-white text-[13px] font-medium text-[#c23b3b] hover:bg-[#fdf7f6] disabled:opacity-50"
      >
        Reprovar
      </button>
    </div>
  );
}
