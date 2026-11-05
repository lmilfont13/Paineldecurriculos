"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Zap, Columns, FileText, Keyboard } from "lucide-react";

export type QueueBarProps = {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  hasResume: boolean;
  queue: {
    currentPosition: number;
    total: number;
    prevId: string | null;
    nextId: string | null;
    nextPendingId: string | null;
  };
  splitView: boolean;
  onToggleSplitView: () => void;
};

export function CandidateQueueBar({
  applicationId,
  jobId,
  jobTitle,
  hasResume,
  queue,
  splitView,
  onToggleSplitView,
}: QueueBarProps) {
  const router = useRouter();
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Navegação por teclado: atalhos J/K ou setas, quando o foco não está em inputs/textarea
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLSelectElement ||
        (activeEl instanceof HTMLElement && activeEl.isContentEditable);

      if (isInput) return;

      if ((e.key === "ArrowLeft" || e.key === "k" || e.key === "K") && queue.prevId) {
        e.preventDefault();
        router.push(`/candidaturas/${queue.prevId}`);
      } else if ((e.key === "ArrowRight" || e.key === "j" || e.key === "J") && (queue.nextPendingId || queue.nextId)) {
        e.preventDefault();
        router.push(`/candidaturas/${queue.nextPendingId || queue.nextId}`);
      } else if (e.key === "v" || e.key === "V") {
        if (hasResume) {
          e.preventDefault();
          onToggleSplitView();
        }
      } else if (e.key === "?") {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [queue, router, hasResume, onToggleSplitView]);

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e4e4e7] bg-white px-4 py-3 shadow-xs">
      <div className="flex items-center gap-3">
        <Link
          href={`/vagas/${jobId}`}
          className="text-xs font-semibold text-[#71717a] hover:text-[#0a0a0a]"
        >
          ← {jobTitle}
        </Link>
        <span className="text-[#d4d4d8]" aria-hidden>|</span>
        <span className="rounded-full bg-[#f4f4f5] px-2.5 py-0.5 text-[11px] font-medium text-[#52525b]">
          Candidato {queue.currentPosition} de {queue.total}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {hasResume && (
          <button
            type="button"
            onClick={onToggleSplitView}
            className={`inline-flex h-8 items-center gap-1.5 rounded-xl border px-3 text-[11px] font-medium transition ${
              splitView
                ? "border-[#0a0a0a] bg-[#0a0a0a] text-white"
                : "border-[#e4e4e7] bg-white text-[#52525b] hover:bg-[#fafaf9] hover:text-[#0a0a0a]"
            }`}
            title="Alterna a exibição do PDF original lado a lado com a análise (Atalho: V)"
          >
            <Columns className="size-3.5" />
            <span className="hidden sm:inline">Visualizar CV lado a lado</span>
            <span className="sm:hidden">Split CV</span>
          </button>
        )}

        {queue.nextPendingId && queue.nextPendingId !== queue.nextId && (
          <Link
            href={`/candidaturas/${queue.nextPendingId}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-[11px] font-semibold transition hover:opacity-90"
            style={{
              backgroundColor: "var(--brand-tint)",
              color: "var(--brand-primary)",
            }}
            title="Avança direto para o próximo candidato com decisão pendente"
          >
            <Zap className="size-3.5" />
            <span>Próximo a triar</span>
          </Link>
        )}

        <div className="inline-flex rounded-xl border border-[#e4e4e7] bg-white p-0.5 shadow-2xs">
          {queue.prevId ? (
            <Link
              href={`/candidaturas/${queue.prevId}`}
              className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[11px] font-medium text-[#52525b] hover:bg-[#fafaf9] hover:text-[#0a0a0a]"
              title="Candidato anterior (Atalho: K ou ←)"
            >
              <ChevronLeft className="size-3.5" />
              <span className="hidden md:inline">Anterior</span>
            </Link>
          ) : (
            <span className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[11px] font-medium text-[#d4d4d8]">
              <ChevronLeft className="size-3.5" />
              <span className="hidden md:inline">Anterior</span>
            </span>
          )}

          {queue.nextId ? (
            <Link
              href={`/candidaturas/${queue.nextId}`}
              className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[11px] font-medium text-[#52525b] hover:bg-[#fafaf9] hover:text-[#0a0a0a]"
              title="Próximo candidato (Atalho: J ou →)"
            >
              <span className="hidden md:inline">Próximo</span>
              <ChevronRight className="size-3.5" />
            </Link>
          ) : (
            <span className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[11px] font-medium text-[#d4d4d8]">
              <span className="hidden md:inline">Próximo</span>
              <ChevronRight className="size-3.5" />
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowShortcuts((s) => !s)}
          className="inline-flex size-8 items-center justify-center rounded-xl text-[#a1a1aa] hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
          title="Atalhos de teclado (?)"
          aria-label="Atalhos de teclado"
        >
          <Keyboard className="size-4" />
        </button>
      </div>

      {showShortcuts && (
        <div className="w-full border-t border-[#f4f4f5] pt-2 text-[11px] text-[#71717a]">
          <span className="font-semibold text-[#0a0a0a]">Atalhos de navegação:</span>{" "}
          <kbd className="rounded bg-[#f4f4f5] px-1.5 py-0.5 font-mono text-[10px]">J</kbd> ou{" "}
          <kbd className="rounded bg-[#f4f4f5] px-1.5 py-0.5 font-mono text-[10px]">→</kbd> Próximo ·{" "}
          <kbd className="rounded bg-[#f4f4f5] px-1.5 py-0.5 font-mono text-[10px]">K</kbd> ou{" "}
          <kbd className="rounded bg-[#f4f4f5] px-1.5 py-0.5 font-mono text-[10px]">←</kbd> Anterior ·{" "}
          <kbd className="rounded bg-[#f4f4f5] px-1.5 py-0.5 font-mono text-[10px]">V</kbd> Alternar CV lado a lado ·{" "}
          <kbd className="rounded bg-[#f4f4f5] px-1.5 py-0.5 font-mono text-[10px]">?</kbd> Fechar ajuda
        </div>
      )}
    </div>
  );
}

