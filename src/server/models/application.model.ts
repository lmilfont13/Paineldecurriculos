import { z } from "zod";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB (regra 5)
export const RESUME_MIME = "application/pdf";

export const applicationInputSchema = z.object({
  slug: z.string().min(1),
  jobId: z.string().min(1),
  name: z.string().min(2, "Informe seu nome completo."),
  // e-mail vem da conta do candidato (sessão), não do formulário
  phone: z.string().min(8, "Informe um telefone válido."),
  /** Respostas dos FormFields da empresa: fieldId → valor. */
  answers: z.record(z.string(), z.string()),
});

export type ApplicationInput = z.infer<typeof applicationInputSchema>;

export type SubmitApplicationResult =
  | { ok: true; applicationId: string }
  | { ok: false; error: string };

/**
 * Rótulos do status do processo, na visão do gestor. "Análise" é palavra
 * reservada para a IA — o status do processo nunca a usa, para as duas coisas
 * não se confundirem na mesma tela.
 */
export const appStatusLabels = {
  PENDING: "Triagem",
  INTERVIEW: "Entrevista",
  APPROVED: "Aprovado",
  REJECTED: "Reprovado",
} as const;

export type AppStatusKey = keyof typeof appStatusLabels;

/** "há 9 dias" — torna visível o candidato esquecido. */
export function formatWaiting(since: Date): string {
  const days = Math.floor((Date.now() - since.getTime()) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "há 1 dia";
  return `há ${days} dias`;
}

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
