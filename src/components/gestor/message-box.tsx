"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import {
  sendMessageAction,
  suggestMessageAction,
  type InterviewState,
} from "@/server/controllers/application.controller";

const TOPICS = [
  { key: "entrevista", label: "Convocar para entrevista" },
  { key: "teste", label: "Teste técnico" },
  { key: "documentos", label: "Solicitar documentos" },
  { key: "informacoes", label: "Pedir informações" },
  { key: "feedback", label: "Feedback positivo" },
  { key: "proposta", label: "Proposta aprovada" },
] as const;

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  // Se não começa com 55 (Brasil), adiciona
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export function MessageBox({
  applicationId,
  candidateName,
  candidatePhone,
}: {
  applicationId: string;
  candidateName: string;
  candidatePhone?: string;
}) {
  const firstName = candidateName.split(" ")[0];

  const [state, formAction, pending] = useActionState<InterviewState, FormData>(
    sendMessageAction.bind(null, applicationId),
    null
  );
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [suggesting, startSuggest] = useTransition();
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const sent = state !== null && "ok" in state;

  useEffect(() => {
    if (sent) {
      formRef.current?.reset();
      setMessage("");
      setSelectedTopic(null);
      setOpen(false);
    }
  }, [sent]);

  function handleSuggest(topicKey: string) {
    setSelectedTopic(topicKey);
    setSuggestError(null);
    startSuggest(async () => {
      const result = await suggestMessageAction(applicationId, topicKey);
      if (result.ok) {
        setMessage(result.text);
      } else {
        setSuggestError(result.error);
      }
    });
  }

  // WhatsApp link direto para o telefone do candidato
  const waLink = candidatePhone
    ? `https://wa.me/${formatPhone(candidatePhone)}?text=${encodeURIComponent(message)}`
    : null;

  if (!open) {
    return (
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-9 rounded-2xl border border-[#0a0a0a]/85 bg-white px-4 text-xs font-medium text-[#0a0a0a] hover:bg-[#fafaf9]"
        >
          Enviar recado
        </button>
        {sent && (
          <span className="text-xs text-[#1f7a4d]">
            Recado enviado. {firstName} recebeu por e-mail e na área dele.
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-[#e4e4e7] bg-[#fafaf9] p-4">
      {/* Assuntos para a IA */}
      <p className="mb-2 text-[11px] font-medium text-[#71717a]">
        Escolha o assunto — a IA escreve o texto:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {TOPICS.map((t) => (
          <button
            key={t.key}
            type="button"
            disabled={suggesting}
            onClick={() => handleSuggest(t.key)}
            className={
              "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors " +
              (selectedTopic === t.key
                ? "border-[#0a0a0a] bg-[#0a0a0a] text-white"
                : "border-[#e4e4e7] bg-white text-[#0a0a0a] hover:border-[#0a0a0a]")
            }
          >
            {suggesting && selectedTopic === t.key ? "Gerando…" : t.label}
          </button>
        ))}
      </div>

      {suggestError && (
        <p className="mt-2 text-[11px] text-red-600">{suggestError}</p>
      )}

      {/* Textarea */}
      <form ref={formRef} action={formAction} className="mt-3">
        <textarea
          name="message"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={`Escreva para ${firstName} ou escolha um assunto acima para a IA sugerir o texto…`}
          className="w-full resize-y rounded-lg border border-[#e4e4e7] bg-white p-3 text-[13px] leading-5 text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none"
        />

        {state && "error" in state && (
          <p role="alert" className="mt-1.5 text-[12px] text-[#c23b3b]">
            {state.error}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* Enviar por e-mail */}
          <button
            type="submit"
            disabled={pending || !message.trim()}
            className="flex h-9 items-center gap-1.5 rounded-2xl px-4 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
          >
            <svg viewBox="0 0 20 20" className="size-3.5 fill-current" aria-hidden>
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
            {pending ? "Enviando…" : "Enviar por e-mail"}
          </button>

          {/* Enviar pelo WhatsApp — só aparece se há telefone e mensagem */}
          {waLink && message.trim() && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 items-center gap-1.5 rounded-2xl bg-[#25D366] px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              <svg viewBox="0 0 24 24" className="size-3.5 fill-current" aria-hidden>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 0C5.373 0 0 5.373 0 12c0 2.125.558 4.12 1.528 5.855L.057 23.27a.75.75 0 0 0 .914.914l5.415-1.47A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.89 0-3.66-.5-5.19-1.374l-.372-.213-3.858 1.048 1.048-3.858-.213-.372A9.956 9.956 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
              </svg>
              WhatsApp
            </a>
          )}

          {!waLink && message.trim() && (
            <span className="text-[11px] text-[#a1a1aa]">
              Sem telefone cadastrado para WhatsApp
            </span>
          )}

          <button
            type="button"
            disabled={pending}
            onClick={() => { setOpen(false); setMessage(""); setSelectedTopic(null); }}
            className="ml-auto text-xs font-medium text-[#71717a] hover:text-[#0a0a0a]"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
