"use client";

import { Sparkles } from "lucide-react";
import { useState, useTransition } from "react";

import { backfillTalentCategoriesAction } from "@/server/controllers/talent.controller";

/**
 * Botao que categoriza retroativamente todos os candidatos ja analisados
 * pela IA mas que ainda nao estao em nenhuma pasta do banco de talentos.
 */
export function TalentBackfillButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ count: number } | null>(null);

  function run() {
    startTransition(async () => {
      const res = await backfillTalentCategoriesAction();
      setResult(res);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={isPending}
        className="flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold transition-colors"
        style={{
          backgroundColor: isPending
            ? "color-mix(in srgb, var(--brand-primary) 60%, white)"
            : "var(--brand-primary)",
          color: "var(--brand-foreground, #fff)",
        }}
      >
        <Sparkles className="size-3.5" aria-hidden />
        {isPending ? "Categorizando..." : "Categorizar candidatos existentes"}
      </button>
      {result !== null && !isPending && (
        <span className="text-[13px] text-[#71717a]">
          {result.count === 0
            ? "Todos os candidatos ja estavam em pastas."
            : `${result.count} ${result.count === 1 ? "candidato categorizado" : "candidatos categorizados"}.`}
        </span>
      )}
    </div>
  );
}
