"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteApplicationsAction } from "@/server/controllers/application.controller";

/** Excluir a candidatura (definitivo, com confirmação). */
export function DeleteApplicationButton({
  applicationId,
  candidateName,
}: {
  applicationId: string;
  candidateName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    setError(null);
    startTransition(async () => {
      try {
        const { deleted } = await deleteApplicationsAction([applicationId]);
        if (deleted === 0) {
          setError("Candidatura não encontrada.");
          return;
        }
        router.push("/candidaturas");
      } catch {
        setError("Não foi possível excluir. Tente de novo.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#a1a1aa] hover:text-[#c23b3b]"
      >
        <Trash2 aria-hidden className="size-3.5" />
        Excluir candidatura
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-app-title"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="w-full max-w-[400px] rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-app-title" className="text-base font-semibold text-[#0a0a0a]">
              Excluir a candidatura de {candidateName}?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#71717a]">
              Some do painel junto com respostas, histórico, notas e currículo
              enviado para esta vaga. O candidato não é avisado e a conta dele
              continua existindo. Não dá para desfazer.
            </p>
            {error && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {error}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => setOpen(false)}
                className="h-10 rounded-2xl border border-[#e4e4e7] bg-white px-5 text-[13px] font-medium text-[#71717a] hover:text-[#0a0a0a]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={remove}
                className="h-10 rounded-2xl bg-[#c23b3b] px-5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {pending ? "Excluindo…" : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
