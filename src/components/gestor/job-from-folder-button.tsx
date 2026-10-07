"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Briefcase, Loader2, Sparkles } from "lucide-react";

import { createJobFromFolderAction } from "@/server/controllers/talent.controller";

/**
 * "Sugerir vaga para este perfil": a IA escreve um rascunho de vaga a partir
 * da pasta e abre a edição para o gestor revisar antes de publicar. Se a pasta
 * já gerou uma vaga, vira um link para ela.
 */
export function JobFromFolderButton({
  folderId,
  jobId,
  variant = "primary",
}: {
  folderId: string;
  jobId: string | null;
  variant?: "primary" | "subtle";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (jobId) {
    return (
      <Link
        href={`/vagas/${jobId}`}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium"
        style={{ color: "var(--brand-primary)" }}
      >
        <Briefcase className="size-3.5" /> Ver a vaga criada para este perfil
      </Link>
    );
  }

  function create() {
    setError(null);
    startTransition(async () => {
      const result = await createJobFromFolderAction(folderId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/vagas/${result.jobId}/editar`);
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={create}
        disabled={pending}
        className={
          variant === "primary"
            ? "inline-flex h-10 items-center gap-2 rounded-2xl px-4 text-[13px] font-medium hover:opacity-90 disabled:opacity-60"
            : "inline-flex items-center gap-1.5 text-[12px] font-medium disabled:opacity-60"
        }
        style={
          variant === "primary"
            ? { backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }
            : { color: "var(--brand-primary)" }
        }
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
        {pending ? "Escrevendo o rascunho…" : "Sugerir vaga para este perfil"}
      </button>
      {error && (
        <span className="text-[11px] text-[#c23b3b]" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
