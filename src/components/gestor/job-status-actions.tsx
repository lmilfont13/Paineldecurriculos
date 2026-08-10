"use client";

import { useState, useTransition } from "react";

import { setJobStatusAction } from "@/server/controllers/job.controller";

/**
 * Estado da vaga no hub. Publicar/reabrir é a ação positiva; encerrar pede
 * confirmação porque tira a vaga do ar e não se desfaz sozinho.
 */
export function JobStatusActions({
  jobId,
  status,
}: {
  jobId: string;
  status: "DRAFT" | "OPEN" | "PAUSED" | "CLOSED";
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function apply(next: "OPEN" | "PAUSED" | "CLOSED") {
    startTransition(() => setJobStatusAction(jobId, next));
  }

  const primary =
    status === "OPEN"
      ? { label: "Pausar", next: "PAUSED" as const }
      : { label: status === "DRAFT" ? "Publicar" : "Reabrir", next: "OPEN" as const };

  return (
    <>
      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirming(false)}
        >
          <div
            className="w-full max-w-[400px] rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-[#0a0a0a]">
              Encerrar esta vaga?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#71717a]">
              Ela sai da página pública e para de receber candidaturas. Os
              candidatos que já se inscreveram continuam no processo, e você
              pode reabrir depois.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="h-10 rounded-2xl border border-[#e4e4e7] bg-white px-5 text-[13px] font-medium text-[#71717a] hover:text-[#0a0a0a]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  apply("CLOSED");
                }}
                className="h-10 rounded-2xl bg-[#0a0a0a] px-5 text-[13px] font-medium text-white hover:opacity-90"
              >
                Encerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={() => apply(primary.next)}
        className="flex h-10 items-center rounded-2xl px-5 text-[13px] font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{
          backgroundColor: "var(--brand-primary)",
          color: "var(--brand-foreground)",
        }}
      >
        {pending ? "Salvando…" : primary.label}
      </button>

      {status !== "CLOSED" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(true)}
          className="text-[13px] font-medium text-[#a1a1aa] hover:text-[#0a0a0a] disabled:opacity-50"
        >
          Encerrar
        </button>
      )}
    </>
  );
}
