"use client";

import { useState, useTransition } from "react";

import { Toast } from "@/components/gestor/toast";
import { setApplicationStatusAction } from "@/server/controllers/application.controller";

/** Botões Entrevistar/Dispensar dos cards de comparação (E10). */
export function CompareActions({
  applicationId,
  name,
}: {
  applicationId: string;
  name: string;
}) {
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  return (
    <>
      <div className="flex gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setApplicationStatusAction(applicationId, "INTERVIEW");
              setToast(`${name.split(" ")[0]} movido(a) para Entrevista.`);
            })
          }
          className="h-10 flex-1 rounded-2xl text-[13px] font-medium hover:opacity-90 disabled:opacity-50"
          style={{
            backgroundColor: "var(--brand-primary)",
            color: "var(--brand-foreground)",
          }}
        >
          Entrevistar
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setApplicationStatusAction(applicationId, "REJECTED");
              setToast(`${name.split(" ")[0]} dispensado(a).`);
            })
          }
          className="h-10 flex-1 rounded-2xl border border-[#e4e4e7] bg-white text-[13px] font-medium text-[#71717a] hover:text-[#c23b3b]"
        >
          Dispensar
        </button>
      </div>
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}
