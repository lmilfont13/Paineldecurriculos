"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { ChannelPicker } from "@/components/gestor/channel-picker";
import {
  DEFAULT_CHANNELS,
  channelsToCsv,
  whatsappUrl,
  type ContactChannel,
} from "@/server/models/contact-channels.model";

import {
  scheduleInterviewAction,
  type InterviewState,
} from "@/server/controllers/application.controller";
import {
  INTERVIEW_MODES,
  locationLabel,
  type InterviewMode,
} from "@/server/models/interview.model";

const field =
  "h-10 w-full rounded-lg border border-[#e4e4e7] bg-white px-3 text-[13px] text-[#0a0a0a] focus:border-[#0a0a0a] focus:outline-none";

/** Valor inicial do datetime-local: amanhã às 10h, no fuso do navegador. */
function defaultAt(existing?: string | null): string {
  if (existing) return existing;
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Combina a conversa. Marcar o horário é o passo de maior atrito do processo
 * real — fica junto da mudança de etapa, não depois dela e por fora.
 */
export function InterviewDialog({
  applicationId,
  candidateName,
  current,
  title,
  onClose,
  candidatePhone,
  jobTitle,
  hasEmail = true,
  hasAccount = true,
}: {
  applicationId: string;
  candidateName: string;
  current?: { at: string; mode: string; location: string } | null;
  title: string;
  onClose: () => void;
  candidatePhone?: string;
  jobTitle?: string;
  hasEmail?: boolean;
  hasAccount?: boolean;
}) {
  const [state, formAction, pending] = useActionState<InterviewState, FormData>(
    scheduleInterviewAction.bind(null, applicationId),
    null
  );
  const [mode, setMode] = useState<InterviewMode>(
    (current?.mode as InterviewMode) ?? "Videochamada"
  );

  const [channels, setChannels] = useState<ContactChannel[]>([...DEFAULT_CHANNELS]);
  const [waUrl, setWaUrl] = useState<string | null>(null);
  // O formulário é limpo depois do envio: o texto do WhatsApp é montado no momento do envio.
  const waDraft = useRef<string | null>(null);

  function captureWhatsapp(form: HTMLFormElement) {
    waDraft.current = null;
    if (!channels.includes("whatsapp") || !candidatePhone) return;
    const data = new FormData(form);
    const at = new Date(String(data.get("at") ?? ""));
    if (isNaN(at.getTime())) return;
    const when = at.toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });
    const where = String(data.get("location") ?? "").trim();
    const how = String(data.get("mode") ?? "");
    const text =
      `Olá, ${candidateName.split(" ")[0]}! Sua conversa${jobTitle ? ` para a vaga de ${jobTitle}` : ""} está marcada para ${when} (${how}${where ? `: ${where}` : ""}). ` +
      "Se esse horário não servir, é só me avisar por aqui.";
    waDraft.current = whatsappUrl(candidatePhone, text);
  }

  useEffect(() => {
    if (state && "ok" in state) {
      if (waDraft.current) setWaUrl(waDraft.current);
      else onClose();
    }
  }, [state, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <form
        action={formAction}
        onSubmit={(e) => captureWhatsapp(e.currentTarget)}
        className="w-full max-w-[440px] rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input type="hidden" name="channels" value={channelsToCsv(channels)} />
        {waUrl ? (
          <div>
            <h2 className="text-base font-semibold text-[#0a0a0a]">Conversa marcada</h2>
            <p className="mt-1.5 text-[13px] leading-5 text-[#71717a]">
              Abra o WhatsApp para enviar o convite com o horário já escrito.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="h-10 rounded-2xl border border-[#e4e4e7] bg-white px-5 text-[13px] font-medium text-[#71717a] hover:text-[#0a0a0a]"
              >
                Fechar
              </button>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 items-center rounded-2xl bg-[#25D366] px-5 text-[13px] font-semibold text-white hover:opacity-90"
              >
                Abrir no WhatsApp
              </a>
            </div>
          </div>
        ) : (
        <>
        <h2 className="text-base font-semibold text-[#0a0a0a]">{title}</h2>
        <p className="mt-1.5 text-[13px] leading-5 text-[#71717a]">
          Escolha abaixo por onde {candidateName.split(" ")[0]} recebe o convite. Se o horário
          não servir, ele responde.
        </p>

        <label className="mt-5 block">
          <span className="mb-1.5 block text-[13px] font-medium text-[#0a0a0a]">
            Quando
          </span>
          <input
            type="datetime-local"
            name="at"
            required
            defaultValue={defaultAt(current?.at)}
            className={field}
          />
        </label>

        <fieldset className="mt-4">
          <legend className="mb-1.5 text-[13px] font-medium text-[#0a0a0a]">
            Como
          </legend>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-[#f4f4f5] p-[3px]">
            {INTERVIEW_MODES.map((option) => (
              <label
                key={option}
                className={
                  "cursor-pointer rounded-md py-1.5 text-center text-xs transition-colors " +
                  (mode === option
                    ? "bg-white font-medium text-[#0a0a0a] shadow-sm"
                    : "text-[#71717a] hover:text-[#0a0a0a]")
                }
              >
                <input
                  type="radio"
                  name="mode"
                  value={option}
                  checked={mode === option}
                  onChange={() => setMode(option)}
                  className="sr-only"
                />
                {option}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[13px] font-medium text-[#0a0a0a]">
            {locationLabel[mode]}{" "}
            <span className="font-normal text-[#a1a1aa]">(opcional)</span>
          </span>
          <input
            name="location"
            defaultValue={current?.location ?? ""}
            placeholder={
              mode === "Videochamada"
                ? "https://meet.google.com/…"
                : mode === "Presencial"
                  ? "Rua, número, bairro"
                  : "(85) 9 0000-0000"
            }
            className={field}
          />
        </label>

        <div className="mt-4">
          <ChannelPicker
            value={channels}
            onChange={setChannels}
            hasPhone={Boolean(candidatePhone)}
            hasEmail={hasEmail}
            hasAccount={hasAccount}
          />
        </div>

        {state && "error" in state && (
          <p role="alert" className="mt-3 text-[13px] text-[#c23b3b]">
            {state.error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-2xl border border-[#e4e4e7] bg-white px-5 text-[13px] font-medium text-[#71717a] hover:text-[#0a0a0a]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending || channels.length === 0}
            className="h-10 rounded-2xl px-5 text-[13px] font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{
              backgroundColor: "var(--brand-primary)",
              color: "var(--brand-foreground)",
            }}
          >
            {pending ? "Enviando…" : "Marcar e avisar"}
          </button>
        </div>
        </>
        )}
      </form>
    </div>
  );
}
