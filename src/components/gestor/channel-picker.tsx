"use client";

import {
  CHANNEL_LABELS,
  CONTACT_CHANNELS,
  type ContactChannel,
} from "@/server/models/contact-channels.model";

/**
 * Escolha dos canais de contato: e-mail, WhatsApp e/ou mensagem no sistema.
 * O WhatsApp só fica disponível com telefone; ele não sai sozinho, o sistema
 * prepara o link com o texto.
 */
export function ChannelPicker({
  value,
  onChange,
  hasPhone,
  hasEmail = true,
  hasAccount = true,
  disabled,
}: {
  value: ContactChannel[];
  onChange: (next: ContactChannel[]) => void;
  hasPhone: boolean;
  hasEmail?: boolean;
  /** Mensagem no sistema só chega a quem tem conta no site. */
  hasAccount?: boolean;
  disabled?: boolean;
}) {
  const unavailable: Record<ContactChannel, string | null> = {
    email: hasEmail ? null : "sem e-mail",
    whatsapp: hasPhone ? null : "sem telefone",
    system: hasAccount ? null : "sem conta no site",
  };

  const toggle = (c: ContactChannel) =>
    onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c]);

  return (
    <fieldset disabled={disabled}>
      <legend className="text-[11px] font-medium text-[#71717a]">Enviar por</legend>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {CONTACT_CHANNELS.map((c) => {
          const off = unavailable[c];
          const on = value.includes(c) && !off;
          return (
            <label
              key={c}
              className={
                "flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] " +
                (off
                  ? "cursor-not-allowed border-[#e4e4e7] bg-[#fafafa] text-[#a1a1aa]"
                  : on
                    ? "cursor-pointer border-[#0a0a0a] bg-white text-[#0a0a0a]"
                    : "cursor-pointer border-[#e4e4e7] bg-white text-[#57534e] hover:border-[#0a0a0a]")
              }
            >
              <input
                type="checkbox"
                checked={on}
                disabled={Boolean(off)}
                onChange={() => toggle(c)}
                className="size-3.5 accent-[#0a0a0a]"
              />
              {CHANNEL_LABELS[c]}
              {off && <span className="text-[10px]">· {off}</span>}
            </label>
          );
        })}
      </div>
      {value.length === 0 && (
        <p className="mt-1.5 text-[11px] text-[#a16207]">Escolha ao menos um canal.</p>
      )}
    </fieldset>
  );
}
