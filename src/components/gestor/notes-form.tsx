"use client";

import { useActionState, useEffect, useState } from "react";

import { saveNotesAction } from "@/server/controllers/application.controller";

/** Notas internas do gestor sobre a candidatura (E4) — só a equipe vê. */
export function NotesForm({
  applicationId,
  notes,
}: {
  applicationId: string;
  notes: string | null;
}) {
  const [state, formAction, pending] = useActionState<
    { saved: boolean } | null,
    FormData
  >(saveNotesAction.bind(null, applicationId), null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (state?.saved) setDirty(false);
  }, [state]);

  return (
    <form action={formAction}>
      <textarea
        name="notes"
        rows={3}
        defaultValue={notes ?? ""}
        onChange={() => setDirty(true)}
        placeholder="Impressões da conversa, combinados, próximos passos…"
        className="w-full resize-y rounded-lg border border-[#e4e4e7] bg-white p-3 text-[13px] leading-5 text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !dirty}
          className="h-9 rounded-2xl border border-[#0a0a0a]/85 bg-white px-4 text-xs font-medium text-[#0a0a0a] hover:bg-[#fafaf9] disabled:opacity-40"
        >
          {pending ? "Salvando…" : "Salvar nota"}
        </button>
        {state?.saved && !dirty && !pending && (
          <span className="text-xs text-[#1f7a4d]">Nota salva.</span>
        )}
      </div>
    </form>
  );
}
