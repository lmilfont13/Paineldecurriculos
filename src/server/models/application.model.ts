import { z } from "zod";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB (regra 5)
export const RESUME_MIME = "application/pdf";

export const applicationInputSchema = z.object({
  slug: z.string().min(1),
  jobId: z.string().min(1),
  name: z.string().min(2, "Informe seu nome completo."),
  email: z.email("Informe um e-mail válido."),
  phone: z.string().min(8, "Informe um telefone válido."),
  /** Respostas dos FormFields da empresa: fieldId → valor. */
  answers: z.record(z.string(), z.string()),
});

export type ApplicationInput = z.infer<typeof applicationInputSchema>;

export type SubmitApplicationResult =
  | { ok: true; applicationId: string }
  | { ok: false; error: string };

export const appStatusLabels = {
  PENDING: "Em análise",
  INTERVIEW: "Entrevista",
  APPROVED: "Aprovado",
  REJECTED: "Reprovado",
} as const;

export type AppStatusKey = keyof typeof appStatusLabels;

/** "candidatou-se em 9 jul" / "…em 9 jul, 14:32" (E3/E4). */
export function formatAppliedAt(date: Date, withTime = false): string {
  const day = date.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
  });
  if (!withTime) return day;
  const time = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day}, ${time}`;
}
