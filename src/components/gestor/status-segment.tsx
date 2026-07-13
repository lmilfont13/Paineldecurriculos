"use client";

import { useState, useTransition } from "react";

import { Toast } from "@/components/gestor/toast";
import { setApplicationStatusAction } from "@/server/controllers/application.controller";
import {
  appStatusLabels,
  type AppStatusKey,
} from "@/server/models/application.model";

const ORDER: AppStatusKey[] = ["PENDING", "INTERVIEW", "APPROVED", "REJECTED"];

/** Controle segmentado de status do processo (E4) — decisão manual do gestor. */
export function StatusSegment({
  applicationId,
  status,
}: {
  applicationId: string;
  status: AppStatusKey;
}) {
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  return (
    <div
      role="radiogroup"
      aria-label="Status do processo"
      className="grid h-10 grid-cols-4 gap-1 rounded-lg bg-[#f4f4f5] p-[3px]"
    >
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      {ORDER.map((key) => {
        const active = key === status;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await setApplicationStatusAction(applicationId, key);
                setToast(`Status atualizado para "${appStatusLabels[key]}".`);
              })
            }
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
}: {
  applicationId: string;
  status: AppStatusKey;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-3">
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
        onClick={() =>
          startTransition(() =>
            setApplicationStatusAction(applicationId, "REJECTED")
          )
        }
        className="h-10 w-[130px] rounded-2xl border border-[#e8d5d2] bg-white text-[13px] font-medium text-[#c23b3b] hover:bg-[#fdf7f6] disabled:opacity-50"
      >
        Reprovar
      </button>
    </div>
  );
}
