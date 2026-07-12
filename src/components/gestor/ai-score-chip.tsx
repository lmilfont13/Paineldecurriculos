import type { AIState } from "@prisma/client";

/**
 * Chip de score da IA (frames E1/E3/E4). Estados:
 * DONE e atende o mínimo → verde "Atende"; DONE abaixo → âmbar "Abaixo";
 * WAITING/PROCESSING → "Analisando…"; NO_RESUME → "Sem currículo"; FAILED → "Falhou".
 */
export function AiScoreChip({
  aiScore,
  aiState,
  meetsMinimum,
}: {
  aiScore: number | null;
  aiState: AIState;
  meetsMinimum: boolean;
}) {
  if (aiState === "DONE" && aiScore !== null) {
    return meetsMinimum ? (
      <span className="inline-flex h-[30px] items-center gap-2.5 rounded-lg bg-[#e4f6ec] px-3">
        <span className="text-[15px] font-bold text-[#1f7a4d]">{aiScore}</span>
        <span className="h-4 w-px bg-[#1f7a4d]/30" />
        <span className="text-[11px] font-semibold text-[#1f7a4d]">Atende</span>
      </span>
    ) : (
      <span className="inline-flex h-[30px] items-center gap-2.5 rounded-lg bg-[#fbeae8] px-3">
        <span className="text-[15px] font-bold text-[#c23b3b]">{aiScore}</span>
        <span className="h-4 w-px bg-[#c23b3b]/30" />
        <span className="text-[11px] font-semibold text-[#c23b3b]">
          Não atende
        </span>
      </span>
    );
  }

  const label =
    aiState === "NO_RESUME"
      ? "Não analisado"
      : aiState === "FAILED"
        ? "Análise falhou"
        : "Analisando…";

  return (
    <span className="inline-flex h-[30px] items-center gap-2 rounded-lg bg-[#f1f0ed] px-3">
      {aiState !== "NO_RESUME" && aiState !== "FAILED" && (
        <span className="size-1.5 animate-pulse rounded-full bg-[#8a8781]" />
      )}
      <span className="text-[11px] font-medium text-[#8a8781]">{label}</span>
    </span>
  );
}
