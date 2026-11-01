"use client";

import { useState, useTransition } from "react";

import { ChannelPicker } from "@/components/gestor/channel-picker";
import {
  CHANNEL_LABELS,
  DEFAULT_CHANNELS,
  type ContactChannel,
} from "@/server/models/contact-channels.model";
import {
  requestInfoAction,
  revealSensitiveInfoAction,
} from "@/server/controllers/application.controller";
import {
  INFO_FIELDS,
  infoFieldLabels,
  whatsappInfoLink,
  type InfoField,
} from "@/server/models/pre-interview.model";

/** Respostas já recebidas; RG/CPF chegam mascarados do servidor. */
export type InfoAnswers = {
  maritalStatus: string | null;
  hasChildren: boolean | null;
  childrenCount: number | null;
  professionalSummary: string | null;
  rgMasked: string | null;
  cpfMasked: string | null;
  address?: string | null;
  uniform?: string | null;
};

export function InfoRequestBox({
  applicationId,
  candidateName,
  candidatePhone,
  companyName,
  jobTitle,
  formUrl,
  known,
  requestedFields,
  requestedAt,
  answeredAt,
  answers,
  hasEmail = true,
  hasAccount = true,
}: {
  applicationId: string;
  candidateName: string;
  candidatePhone?: string;
  companyName: string;
  jobTitle: string;
  formUrl: string;
  /** Campos que a candidatura já tem (não se pedem de novo). */
  known: Record<InfoField, boolean>;
  requestedFields: InfoField[];
  requestedAt: string | null;
  answeredAt: string | null;
  answers: InfoAnswers;
  hasEmail?: boolean;
  hasAccount?: boolean;
}) {
  const firstName = candidateName.split(" ")[0];
  const [selected, setSelected] = useState<InfoField[]>(
    INFO_FIELDS.filter((f) => !known[f])
  );
  const [sent, setSent] = useState(requestedAt !== null);
  const [channels, setChannels] = useState<ContactChannel[]>([...DEFAULT_CHANNELS]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [revealed, setRevealed] = useState<{ rg: string | null; cpf: string | null } | null>(
    null
  );

  const toggle = (field: InfoField) =>
    setSelected((cur) =>
      cur.includes(field) ? cur.filter((f) => f !== field) : [...cur, field]
    );

  function submit() {
    setError(null);
    start(async () => {
      const result = await requestInfoAction(applicationId, selected, channels);
      if ("error" in result) setError(result.error);
      else setSent(true);
    });
  }

  function reveal() {
    start(async () => setRevealed(await revealSensitiveInfoAction(applicationId)));
  }

  const hasAnswers =
    answers.maritalStatus !== null ||
    answers.hasChildren !== null ||
    answers.professionalSummary !== null ||
    answers.rgMasked !== null ||
    answers.cpfMasked !== null ||
    Boolean(answers.address) ||
    Boolean(answers.uniform);
  const hasSensitive = answers.rgMasked !== null || answers.cpfMasked !== null;
  const waHref = candidatePhone
    ? whatsappInfoLink({
        phone: candidatePhone,
        candidateName,
        companyName,
        jobTitle,
        url: formUrl,
      })
    : null;

  return (
    <div className="mt-3 space-y-4">
      <fieldset>
        <legend className="text-[11px] text-[#a1a1aa]">Pedir para {firstName}:</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {INFO_FIELDS.map((field) => {
            const already = known[field];
            const on = selected.includes(field);
            return (
              <label
                key={field}
                className={
                  "flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] " +
                  (already
                    ? "cursor-not-allowed border-[#e4e4e7] bg-[#fafafa] text-[#a1a1aa]"
                    : "cursor-pointer border-[#e4e4e7] bg-white text-[#0a0a0a] hover:border-[#0a0a0a]")
                }
              >
                <input
                  type="checkbox"
                  disabled={already}
                  checked={!already && on}
                  onChange={() => toggle(field)}
                  className="size-3.5 accent-[#0a0a0a]"
                />
                {infoFieldLabels[field]}
                {already && <span className="text-[10px]">· já informado</span>}
              </label>
            );
          })}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-[12px] text-red-600">
          {error}
        </p>
      )}

      <ChannelPicker
        value={channels}
        onChange={setChannels}
        hasPhone={Boolean(candidatePhone)}
        hasEmail={hasEmail}
        hasAccount={hasAccount}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending || selected.length === 0 || channels.length === 0}
          className="h-9 rounded-xl bg-[#0a0a0a] px-4 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          {pending ? "Enviando…" : sent ? "Pedir de novo" : "Enviar pedido"}
        </button>
        {sent && waHref && channels.includes("whatsapp") && (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 items-center rounded-xl border border-[#e4e4e7] bg-white px-4 text-[12px] font-medium text-[#0a0a0a] hover:border-[#0a0a0a]"
          >
            Abrir no WhatsApp
          </a>
        )}
      </div>

      {sent && (
        <p className="text-[11px] text-[#71717a]">
          {answeredAt
            ? "Respondido pelo candidato."
            : `Aviso enviado ao candidato (${channels
                .filter((c) => c !== "whatsapp")
                .map((c) => CHANNEL_LABELS[c].toLowerCase())
                .join(" + ") || "pedido registrado"})${
                requestedFields.length > 0
                  ? `: ${requestedFields.map((f) => infoFieldLabels[f]).join(", ")}`
                  : ""
              }. Aguardando resposta.`}
        </p>
      )}

      {hasAnswers && (
        <dl className="divide-y divide-[#f0f0f0] rounded-xl border border-[#e4e4e7] text-[13px]">
          {answers.maritalStatus && (
            <Row label="Estado civil" value={answers.maritalStatus} />
          )}
          {answers.hasChildren !== null && (
            <Row
              label="Filhos"
              value={
                answers.hasChildren
                  ? `Sim${answers.childrenCount ? ` (${answers.childrenCount})` : ""}`
                  : "Não"
              }
            />
          )}
          {answers.professionalSummary && (
            <Row label="Resumo profissional" value={answers.professionalSummary} multiline />
          )}
          {answers.rgMasked && (
            <Row label="RG" value={revealed?.rg ?? answers.rgMasked} />
          )}
          {answers.cpfMasked && (
            <Row label="CPF" value={revealed?.cpf ?? answers.cpfMasked} />
          )}
          {answers.address && <Row label="Endereço" value={answers.address} />}
          {answers.uniform && <Row label="Uniforme" value={answers.uniform} />}
        </dl>
      )}
      {hasSensitive && !revealed && (
        <button
          type="button"
          onClick={reveal}
          disabled={pending}
          className="text-[12px] font-medium text-[#0a0a0a] underline-offset-2 hover:underline disabled:opacity-40"
        >
          Mostrar RG/CPF (fica registrado na auditoria)
        </button>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="flex gap-4 px-4 py-2.5">
      <dt className="w-28 shrink-0 text-[11px] text-[#71717a]">{label}</dt>
      <dd className={multiline ? "whitespace-pre-line text-[#0a0a0a]" : "text-[#0a0a0a]"}>
        {value}
      </dd>
    </div>
  );
}
