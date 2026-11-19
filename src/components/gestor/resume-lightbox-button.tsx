"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, ExternalLink, Eye, X } from "lucide-react";

export function ResumeLightboxModal({
  applicationId,
  candidateName,
  onClose,
}: {
  applicationId: string;
  candidateName: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Currículo de ${candidateName}`}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 backdrop-blur-xs transition-opacity sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl"
      >
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 border-b border-[#e4e4e7] bg-white px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="shrink-0 rounded-lg bg-[#e4f6ec] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#1f7a4d]">
              PDF
            </span>
            <p className="truncate text-sm font-bold text-[#0a0a0a]">
              {candidateName}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <a
              href={`/candidaturas/${applicationId}/cv?download=1`}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-white px-3 text-xs font-semibold text-[#0a0a0a] transition hover:bg-[#fafaf9]"
              title="Baixar currículo em PDF"
            >
              <Download className="size-3.5 text-[#52525b]" />
              <span>Baixar PDF</span>
            </a>

            <a
              href={`/candidaturas/${applicationId}/cv`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden h-8 items-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-white px-2.5 text-xs font-medium text-[#71717a] transition hover:bg-[#fafaf9] hover:text-[#0a0a0a] sm:inline-flex"
              title="Abrir em nova aba"
            >
              <ExternalLink className="size-3.5" />
              <span>Nova guia</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar currículo"
              title="Fechar (Esc ou clique fora)"
              className="inline-flex size-8 items-center justify-center rounded-xl bg-[#f4f4f5] text-[#52525b] transition hover:bg-[#e4e4e7] hover:text-[#0a0a0a]"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Visualizador PDF em tela destacada */}
        <div className="relative flex-1 bg-[#525659]">
          <iframe
            src={`/candidaturas/${applicationId}/cv`}
            title={`Currículo de ${candidateName}`}
            className="h-full w-full border-0"
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ResumeLightboxButton({
  applicationId,
  candidateName,
  label = "Ver currículo",
  showIcon = true,
  className,
}: {
  applicationId: string;
  candidateName: string;
  label?: string;
  showIcon?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={
          className ??
          "inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-white px-3 text-xs font-semibold text-[#0a0a0a] shadow-2xs transition hover:bg-[#fafaf9]"
        }
        title="Visualizar currículo em destaque na tela"
      >
        {showIcon && <Eye className="size-3.5 text-[#52525b]" />}
        <span>{label}</span>
      </button>

      {open && (
        <ResumeLightboxModal
          applicationId={applicationId}
          candidateName={candidateName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
