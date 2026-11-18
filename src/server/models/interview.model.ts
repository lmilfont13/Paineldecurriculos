import { z } from "zod";

export const INTERVIEW_MODES = [
  "Videochamada",
  "Presencial",
  "Telefone",
] as const;

export type InterviewMode = (typeof INTERVIEW_MODES)[number];

/** Rótulo do campo de onde, que muda de sentido conforme o modo. */
export const locationLabel: Record<InterviewMode, string> = {
  Videochamada: "Link da chamada",
  Presencial: "Endereço",
  Telefone: "Telefone para contato",
};

export const interviewSchema = z.object({
  /** `datetime-local` do formulário: "2026-08-20T14:00". */
  at: z
    .string()
    .min(1, "Escolha a data e a hora da conversa.")
    .refine((value) => !Number.isNaN(Date.parse(value)), "Data inválida."),
  mode: z.enum(INTERVIEW_MODES),
  location: z.string().max(500).optional().default(""),
});

export type InterviewInput = z.infer<typeof interviewSchema>;

/**
 * Converte um valor `datetime-local` ("2026-08-20T14:00") para Date no fuso
 * do Brasil (-03:00), mesmo quando o servidor roda em UTC (Vercel).
 */
export function parseBrazilDateTimeLocal(raw: string): Date {
  const s = raw.trim();
  if (/[Z+-]\d*$/.test(s)) return new Date(s);
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? `${s}:00` : s;
  return new Date(`${withSeconds}-03:00`);
}

/** "20 de agosto, 14:00" — como o candidato lê no e-mail e na tela (sempre fuso America/Sao_Paulo). */
export function formatInterviewAt(at: Date): string {
  const day = at.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    timeZone: "America/Sao_Paulo",
  });
  const time = at.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
  return `${day}, ${time}`;
}

/** "quinta-feira, 20 de agosto, 14:00" — versão longa, para o destaque. */
export function formatInterviewLong(at: Date): string {
  const weekday = at.toLocaleDateString("pt-BR", {
    weekday: "long",
    timeZone: "America/Sao_Paulo",
  });
  return `${weekday}, ${formatInterviewAt(at)}`;
}

/** Uma linha com o combinado: "Videochamada · 20 de agosto, 14:00". */
export function interviewSummary(
  at: Date,
  mode: string | null
): string {
  return mode ? `${mode} · ${formatInterviewAt(at)}` : formatInterviewAt(at);
}

/** Já passou? Serve para o gestor ver o que ficou para trás sem decisão. */
export function isPastInterview(at: Date): boolean {
  return at.getTime() < Date.now();
}
