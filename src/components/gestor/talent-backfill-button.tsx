"use client";

import { FolderSync, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";

import { backfillTalentCategoriesAction, consolidateTalentFoldersAction } from "@/server/controllers/talent.controller";

/**
 * Duas ações para o banco de talentos:
 * 1. Categorizar candidatos existentes (backfill)
 * 2. Consolidar pastas duplicadas (merge + normalização)
 */
export function TalentBackfillButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function runBackfill() {
    startTransition(async () => {
      setMessage(null);
      const res = await backfillTalentCategoriesAction();
      setMessage(
        res.count === 0
          ? "Todos os candidatos já estavam em pastas."
          : `${res.count} ${res.count === 1 ? "candidato categorizado" : "candidatos categorizados"}.`
      );
    });
  }

  function runConsolidate() {
    startTransition(async () => {
      setMessage(null);
      const res = await consolidateTalentFoldersAction();
      if (res.merged === 0 && res.renamed === 0) {
        setMessage("Nenhuma pasta duplicada encontrada.");
      } else {
        const parts: string[] = [];
        if (res.merged > 0) parts.push(`${res.merged} ${res.merged === 1 ? "pasta mesclada" : "pastas mescladas"}`);
        if (res.renamed > 0) parts.push(`${res.renamed} ${res.renamed === 1 ? "pasta renomeada" : "pastas renomeadas"}`);
        setMessage(parts.join(", ") + ".");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={runBackfill}
          disabled={isPending}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-[#e4e4e7] bg-white px-3 text-[13px] font-medium text-[#3f3f46] transition-colors hover:bg-[#f4f4f5] disabled:opacity-50"
        >
          <Sparkles className="size-3.5" aria-hidden />
          {isPending ? "Processando..." : "Categorizar existentes"}
        </button>
        <button
          type="button"
          onClick={runConsolidate}
          disabled={isPending}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-[#e4e4e7] bg-white px-3 text-[13px] font-medium text-[#3f3f46] transition-colors hover:bg-[#f4f4f5] disabled:opacity-50"
        >
          <FolderSync className="size-3.5" aria-hidden />
          {isPending ? "Processando..." : "Consolidar pastas"}
        </button>
      </div>
      {message && !isPending && (
        <span className="text-[13px] text-[#71717a]">{message}</span>
      )}
    </div>
  );
}
