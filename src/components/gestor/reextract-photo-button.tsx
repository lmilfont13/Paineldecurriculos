"use client";

import { useState, useTransition } from "react";

import { reextractPhotoAction } from "@/server/controllers/application.controller";

/** Re-extrai a foto do currículo sem re-rodar a análise de IA. */
export function ReextractPhotoButton({ applicationId }: { applicationId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const result = await reextractPhotoAction(applicationId);
      setMessage(result.message);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        className="h-9 rounded-2xl border border-[#0a0a0a]/85 bg-white px-4 text-xs font-medium text-[#0a0a0a] hover:bg-[#fafaf9] disabled:opacity-60"
      >
        {pending ? "Buscando foto…" : "Extrair foto do currículo"}
      </button>
      {message && (
        <p className="text-xs text-muted-foreground">{message}</p>
      )}
    </div>
  );
}
