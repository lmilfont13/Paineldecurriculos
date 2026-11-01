"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import { ChannelPicker } from "@/components/gestor/channel-picker";
import {
  CHANNEL_LABELS,
  DEFAULT_CHANNELS,
  channelsToCsv,
  whatsappUrl,
  type ContactChannel,
} from "@/server/models/contact-channels.model";
import { fillTemplate } from "@/server/models/message-templates.model";
import {
  sendMessageAction,
  suggestCustomMessageAction,
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
  { key: "negativa", label: "Negativa (não seguiremos)" },
] as const;

export function MessageBox({
  applicationId,
  candidateName,
  candidatePhone,
  companyName,
  jobTitle,
  templates,
  hasEmail = true,
  hasAccount = true,
}: {
  applicationId: string;
  candidateName: string;
  candidatePhone?: string;
  companyName: string;
  jobTitle: string;
  /** Recados salvos da empresa (texto com marcadores {nome}, {empresa}, {vaga}). */
  templates: { id: string; subject: string; body: string }[];
  hasEmail?: boolean;
  hasAccount?: boolean;
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
  const [subject, setSubject] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const sent = state !== null && "ok" in state;
  const [channels, setChannels] = useState<ContactChannel[]>([...DEFAULT_CHANNELS]);
  const [sentVia, setSentVia] = useState<ContactChannel[]>([]);
  const [waAfter, setWaAfter] = useState<string | null>(null);
  // WhatsApp não sai sozinho: o link já leva o texto escrito.
  const waLink = whatsappUrl(candidatePhone, message);

  useEffect(() => {
    if (sent) {
      setSentVia(channels);
      setWaAfter(channels.includes("whatsapp") ? waLink : null);
      formRef.current?.reset();
      setMessage("");
      setSelectedTopic(null);
      setSubject("");
      setNote(null);
      setOpen(false);
    }
  }, [sent]);

  function handleSubject() {
    setSelectedTopic(null);
    setSuggestError(null);
    setNote(null);
    startSuggest(async () => {
      const result = await suggestCustomMessageAction(applicationId, subject);
      if (result.ok) {
        setMessage(result.text);
        setNote(
          result.fromSaved
            ? "Texto salvo de um recado anterior com este assunto."
            : "Texto sugerido pela IA. Ao enviar, ele fica salvo para os próximos."
        );
      } else {
        setSuggestError(result.error);
      }
    });
  }

  function loadSaved(t: { subject: string; body: string }) {
    setSelectedTopic(null);
    setSuggestError(null);
    setSubject(t.subject);
    setMessage(fillTemplate(t.body, { firstName, companyName, jobTitle }));
    setNote("Texto salvo de um recado anterior com este assunto.");
  }

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
            Recado enviado
            {sentVia.filter((c) => c !== "whatsapp").length > 0
              ? ` por ${sentVia
                  .filter((c) => c !== "whatsapp")
                  .map((c) => CHANNEL_LABELS[c].toLowerCase())
                  .join(" e ")}`
              : ""}
            .
          </span>
        )}
        {sent && waAfter && (
          <a
            href={waAfter}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 items-center rounded-2xl bg-[#25D366] px-4 text-xs font-semibold text-white hover:opacity-90"
          >
            Abrir no WhatsApp
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-[#e4e4e7] bg-[#fafaf9] p-4">
      {/* Assuntos para a IA */}
      <div className="mb-4">
        <label className="mb-1.5 block text-[11px] font-medium text-[#71717a]">
          Assunto do recado
        </label>
        <div className="flex gap-2">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={80}
            placeholder="Ex.: Documentos para o registro"
            className="h-9 min-w-0 flex-1 rounded-lg border border-[#e4e4e7] bg-white px-3 text-[13px] text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[#0a0a0a] focus:outline-none"
          />
          <button
            type="button"
            disabled={suggesting || subject.trim().length < 3}
            onClick={handleSubject}
            className="h-9 shrink-0 rounded-lg border border-[#e4e4e7] bg-white px-3 text-[12px] font-medium text-[#0a0a0a] hover:border-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {suggesting && selectedTopic === null ? "Gerando…" : "✦ Gerar com IA"}
          </button>
        </div>
        {templates.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-[#a1a1aa]">Salvos:</span>
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={suggesting}
                onClick={() => loadSaved(t)}
                className="rounded-full border border-[#e4e4e7] bg-[#fafafa] px-3 py-1 text-[11px] font-medium text-[#0a0a0a] hover:border-[#0a0a0a]"
              >
                {t.subject}
              </button>
            ))}
          </div>
        )}
        {note && <p className="mt-2 text-[11px] text-[#71717a]">{note}</p>}
      </div>

      <p className="mb-2 text-[11px] font-medium text-[#71717a]">
        Ou escolha um assunto pronto — a IA escreve o texto:
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
        <input type="hidden" name="subject" value={subject} />
        <input type="hidden" name="channels" value={channelsToCsv(channels)} />
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

        <div className="mt-3">
          <ChannelPicker
            value={channels}
            onChange={setChannels}
            hasPhone={Boolean(candidatePhone)}
            hasEmail={hasEmail}
            hasAccount={hasAccount}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={pending || !message.trim() || channels.length === 0}
            className="flex h-9 items-center gap-1.5 rounded-2xl px-4 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
          >
            {pending ? "Enviando…" : "Enviar recado"}
          </button>
          {channels.includes("whatsapp") && (
            <span className="text-[11px] text-[#71717a]">
              O WhatsApp abre com o texto pronto depois do envio.
            </span>
          )}

          <button
            type="button"
            disabled={pending}
            onClick={() => { setOpen(false); setMessage(""); setSelectedTopic(null); setSubject(""); setNote(null); }}
            className="ml-auto text-xs font-medium text-[#71717a] hover:text-[#0a0a0a]"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
