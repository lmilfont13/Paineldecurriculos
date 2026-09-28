"use client";

import { useTransition } from "react";

import { trackJobShareAction } from "@/server/controllers/job.controller";

export function WhatsAppShare({
  jobId,
  url,
  jobTitle,
}: {
  jobId: string;
  url: string;
  jobTitle: string;
}) {
  const [, startTransition] = useTransition();

  const waText = encodeURIComponent(
    `Nova vaga: *${jobTitle}*\nCandidature-se agora: ${url}`
  );
  const waHref = `https://api.whatsapp.com/send?text=${waText}`;

  function handleClick() {
    startTransition(() => {
      void trackJobShareAction(jobId);
    });
  }

  return (
    <a
      href={waHref}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="flex h-10 items-center gap-2 rounded-2xl bg-[#25D366] px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
    >
      <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.558 4.12 1.528 5.855L.057 23.27a.75.75 0 0 0 .914.914l5.415-1.47A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.89 0-3.66-.5-5.19-1.374l-.372-.213-3.858 1.048 1.048-3.858-.213-.372A9.956 9.956 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
      </svg>
      Compartilhar no WhatsApp
    </a>
  );
}
