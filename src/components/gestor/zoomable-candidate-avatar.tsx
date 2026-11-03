"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";

import { CandidateAvatar } from "@/components/gestor/candidate-avatar";
import { getLargePhotoUrlAction } from "@/server/controllers/application.controller";

/**
 * Avatar do candidato que abre a foto ampliada ao clicar. A ampliada é uma
 * versão própria em alta (até 800px, nunca maior que o original do PDF), não
 * o avatar esticado — por isso não perde qualidade. Sem foto, é só o avatar.
 */
export function ZoomableCandidateAvatar({
  applicationId,
  name,
  photoUrl,
  className,
}: {
  applicationId: string;
  name: string;
  photoUrl?: string | null;
  className: string;
}) {
  const [open, setOpen] = useState(false);

  if (!photoUrl) {
    return <CandidateAvatar name={name} photoUrl={photoUrl} className={className} />;
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        title="Ampliar foto"
        aria-label={`Ampliar foto de ${name}`}
        className="block shrink-0 cursor-zoom-in rounded-[inherit] transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a0a0a]"
      >
        <CandidateAvatar name={name} photoUrl={photoUrl} className={className} />
      </button>
      {open && (
        <PhotoLightbox
          applicationId={applicationId}
          name={name}
          previewUrl={photoUrl}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function PhotoLightbox({
  applicationId,
  name,
  previewUrl,
  onClose,
}: {
  applicationId: string;
  name: string;
  previewUrl: string;
  onClose: () => void;
}) {
  const [largeUrl, setLargeUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getLargePhotoUrlAction(applicationId)
      .then((url) => {
        if (!cancelled) setLargeUrl(url ?? previewUrl);
      })
      .catch(() => {
        if (!cancelled) setLargeUrl(previewUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, previewUrl]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onClose();
      }
    }
    // Captura: fecha a foto antes dos atalhos da página (Esc fecharia o dossiê).
    window.addEventListener("keydown", onKey, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Foto de ${name}`}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar foto"
        className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
      >
        <X className="size-5" />
      </button>

      <figure className="flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          {/* Prévia (avatar) enquanto a versão em alta carrega */}
          {!loaded && (
            // eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage
            <img
              src={previewUrl}
              alt=""
              className="size-[min(80vw,60vh)] rounded-2xl object-cover blur-sm"
            />
          )}
          {largeUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage
            <img
              src={largeUrl}
              alt={`Foto de ${name}`}
              onLoad={() => setLoaded(true)}
              // Tamanho natural, limitado à tela: nunca estica além do original.
              className={`max-h-[80vh] max-w-[90vw] rounded-2xl shadow-2xl ${
                loaded ? "" : "absolute inset-0 opacity-0"
              }`}
            />
          )}
          {!loaded && (
            <Loader2 className="absolute inset-0 m-auto size-8 animate-spin text-white" />
          )}
        </div>
        <figcaption className="text-sm font-semibold text-white">{name}</figcaption>
      </figure>
    </div>,
    document.body
  );
}
