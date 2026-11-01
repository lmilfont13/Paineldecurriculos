import { toWhatsappNumber } from "@/server/models/pre-interview.model";

/**
 * Canais para falar com o candidato. O gestor escolhe em cada contato:
 * e-mail, WhatsApp e/ou mensagem dentro do sistema. O WhatsApp não sai
 * sozinho: o sistema prepara o link com o texto e o gestor envia.
 */
export const CONTACT_CHANNELS = ["email", "whatsapp", "system"] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export const CHANNEL_LABELS: Record<ContactChannel, string> = {
  email: "E-mail",
  whatsapp: "WhatsApp",
  system: "Mensagem no sistema",
};

/** O que sempre foi feito antes da escolha existir. */
export const DEFAULT_CHANNELS: ContactChannel[] = ["email", "system"];

/** Só canais conhecidos, sem repetir. Sem informação nenhuma, o padrão; lista vazia fica vazia. */
export function parseChannels(raw: unknown): ContactChannel[] {
  if (!Array.isArray(raw)) return [...DEFAULT_CHANNELS];
  const out: ContactChannel[] = [];
  for (const v of raw) {
    if ((CONTACT_CHANNELS as readonly string[]).includes(v as string) && !out.includes(v as ContactChannel)) {
      out.push(v as ContactChannel);
    }
  }
  return out;
}

export const channelsToCsv = (channels: ContactChannel[]) => channels.join(",");

/** Campo ausente = padrão; texto vazio = nenhum canal escolhido. */
export function channelsFromCsv(csv: string | null | undefined): ContactChannel[] {
  if (csv === null || csv === undefined) return [...DEFAULT_CHANNELS];
  return parseChannels(csv.split(",").map((s) => s.trim()).filter(Boolean));
}

/** O que o servidor envia de fato (WhatsApp é aberto pelo gestor). */
export function serverChannels(channels: ContactChannel[]): { email: boolean; system: boolean } {
  return { email: channels.includes("email"), system: channels.includes("system") };
}

/** Link do WhatsApp com o texto pronto; null sem telefone válido. */
export function whatsappUrl(phone: string | null | undefined, text: string): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${toWhatsappNumber(phone as string)}?text=${encodeURIComponent(text)}`;
}
