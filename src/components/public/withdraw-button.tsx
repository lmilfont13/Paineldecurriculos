"use client";

import { useState, useTransition } from "react";

import { withdrawApplicationAction } from "@/server/controllers/candidate.controller";

/** Retirar candidatura — confirmação em 2 passos, ação do candidato. */
export function WithdrawButton({
  slug,
  applicationId,
  jobTitle,
}: {
  slug: string;
  applicationId: string;
  jobTitle: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-[13px] font-medium text-[#71717a] hover:text-[#c23b3b]"
      >
        Retirar candidatura…
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[#e8d5d2] bg-[#fdf7f6] p-4">
      <p className="text-[13px] leading-relaxed text-[#0a0a0a]">
        Retirar sua candidatura para <strong>{jobTitle}</strong>? Ela será
        removida do processo e você poderá se candidatar de novo depois, se
        quiser.
      </p>
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(() =>
              withdrawApplicationAction(slug, applicationId)
            )
          }
          className="h-9 rounded-2xl bg-[#c23b3b] px-4 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Retirando…" : "Confirmar retirada"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="h-9 rounded-2xl border border-[#e4e4e7] bg-white px-4 text-xs font-medium text-[#71717a]"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
