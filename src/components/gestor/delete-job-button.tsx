"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteJobAction } from "@/server/controllers/job.controller";

const CONFIRM_WORD = "EXCLUIR";

/**
 * Excluir a vaga (definitivo). Com candidatos, apaga as candidaturas junto e
 * pede para digitar EXCLUIR — e lembra que "Encerrar" só tira do ar.
 */
export function DeleteJobButton({
  jobId,
  jobTitle,
  applicationCount,
}: {
  jobId: string;
  jobTitle: string;
  applicationCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const needsWord = applicationCount > 0;
  const canDelete = !needsWord || typed.trim().toUpperCase() === CONFIRM_WORD;

  function close() {
    if (pending) return;
    setOpen(false);
    setTyped("");
    setError(null);
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteJobAction(jobId);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.push("/vagas");
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
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#a1a1aa] hover:text-[#c23b3b]"
      >
        <Trash2 aria-hidden className="size-3.5" />
        Excluir
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-job-title"
          onClick={close}
        >
          <div
            className="w-full max-w-[420px] rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-job-title" className="text-base font-semibold text-[#0a0a0a]">
              Excluir a vaga “{jobTitle}”?
            </h2>
            {needsWord ? (
              <>
                <p className="mt-2 text-sm leading-relaxed text-[#71717a]">
                  Isso apaga também{" "}
                  <strong className="text-[#0a0a0a]">
                    {applicationCount} {applicationCount === 1 ? "candidatura" : "candidaturas"}
                  </strong>
                  , com currículos, respostas, notas e histórico. Os candidatos deixam de ver essa candidatura na área deles. Não dá para desfazer.
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[#71717a]">
                  Se a ideia é só parar de receber candidaturas, use <strong className="text-[#0a0a0a]">Encerrar</strong>.
                </p>
                <label className="mt-4 block text-[12px] text-[#52525b]">
                  Para confirmar, digite <strong>{CONFIRM_WORD}</strong>
                  <input
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoFocus
                    autoComplete="off"
                    className="mt-1.5 h-10 w-full rounded-xl border border-[#e4e4e7] px-3 text-[13px] outline-none focus:border-[#a1a1aa]"
                  />
                </label>
              </>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-[#71717a]">
                A vaga ainda não tem candidaturas. Ela sai do painel e da página pública, e o link para de funcionar. Não dá para desfazer.
              </p>
            )}
            {error && (
              <p className="mt-3 text-[12px] text-[#c23b3b]" role="alert">
                {error}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={close}
                className="h-10 rounded-2xl border border-[#e4e4e7] bg-white px-5 text-[13px] font-medium text-[#71717a] hover:text-[#0a0a0a]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={!canDelete || pending}
                className="h-10 rounded-2xl bg-[#c23b3b] px-5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-40"
              >
                {pending ? "Excluindo…" : "Excluir vaga"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
