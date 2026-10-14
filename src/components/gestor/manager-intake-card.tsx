"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Copy, FileUp, Loader2, MessageCircle } from "lucide-react";

import { checkResumeFile, uploadResumeToStorage } from "@/lib/resume-upload";
import {
  attachManagerResumeAction,
  requestManagerResumeUploadAction,
} from "@/server/controllers/intake.controller";

/**
 * Detalhe do candidato · cadastro rápido: convite para completar (copiar ou
 * WhatsApp) e anexar o currículo que chegou por fora (e-mail, WhatsApp).
 * Anexou, a IA analisa.
 */
export function ManagerIntakeCard({
  applicationId,
  preRegistered,
  hasResume,
  invite,
  whatsapp,
}: {
  applicationId: string;
  preRegistered: boolean;
  hasResume: boolean;
  invite: string;
  whatsapp: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  async function copy() {
    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage(invite);
    }
  }

  function upload(file: File) {
    setMessage(null);
    startTransition(async () => {
      const problem = await checkResumeFile(file);
      if (problem) {
        setMessage(problem);
        return;
      }
      const target = await requestManagerResumeUploadAction(applicationId);
      if (!target) {
        setMessage("Não foi possível preparar o envio. Tente de novo.");
        return;
      }
      const sent = await uploadResumeToStorage(file, target);
      if (!sent.ok) {
        setMessage(sent.error);
        return;
      }
      const result = await attachManagerResumeAction(applicationId, target.path);
      setMessage(result.ok ? "Currículo anexado. A IA já está analisando." : result.error);
    });
  }

  return (
    <section
      className={
        "rounded-2xl border p-5 shadow-sm " +
        (preRegistered ? "border-[#fde68a] bg-[#fffbeb]" : "border-[#e4e4e7] bg-white")
      }
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[#a1a1aa]">
        {preRegistered ? "Cadastro incompleto" : "Currículo recebido por fora?"}
      </p>
      {preRegistered && (
        <p className="mt-2 text-[12px] leading-5 text-[#78350f]">
          Você cadastrou esta pessoa só com o e-mail. Mande o convite para ela completar; quando completar, a
          candidatura é atualizada e a IA analisa.
        </p>
      )}

      {preRegistered && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#0a0a0a] ring-1 ring-[#e4e4e7] hover:bg-[#fafafa]"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copiado" : "Copiar convite"}
          </button>
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#1f7a4d] ring-1 ring-[#c6ecd6] hover:bg-[#e7f9f0]"
            >
              <MessageCircle className="size-3.5" /> WhatsApp
            </a>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={pending}
        className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-white text-[12px] font-semibold text-[#0a0a0a] hover:bg-[#fafafa] disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <FileUp className="size-3.5" />}
        {pending ? "Enviando…" : hasResume ? "Trocar currículo (PDF)" : "Anexar currículo (PDF)"}
      </button>
      <p className="mt-1.5 text-[10px] text-[#a1a1aa]">Só PDF, até 5 MB.</p>

      {message && (
        <p className="mt-2 break-words text-[11px] text-[#52525b]" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
