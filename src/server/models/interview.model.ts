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

/** "20 de agosto, 14:00" — como o candidato lê no e-mail e na tela. */
export function formatInterviewAt(at: Date): string {
  const day = at.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
  });
  const time = at.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day}, ${time}`;
}

/** "quinta-feira, 20 de agosto, 14:00" — versão longa, para o destaque. */
export function formatInterviewLong(at: Date): string {
  const weekday = at.toLocaleDateString("pt-BR", { weekday: "long" });
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
