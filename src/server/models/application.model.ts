import { z } from "zod";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB (regra 5)
export const RESUME_MIME = "application/pdf";

/**
 * MIME types que o celular costuma informar para um PDF vindo do WhatsApp,
 * Drive ou gerenciador de arquivos. Nesses casos a extensão decide, e o
 * conteúdo é conferido pelos bytes iniciais ("%PDF-") antes do envio.
 */
const AMBIGUOUS_PDF_MIMES = new Set([
  "",
  "application/octet-stream",
  "binary/octet-stream",
  "application/x-pdf",
  "application/acrobat",
]);

/** Aceita PDF pelo MIME ou, quando o MIME é ambíguo, pela extensão. */
export function looksLikePdf(file: { name: string; type: string }): boolean {
  if (file.type === RESUME_MIME) return true;
  return (
    AMBIGUOUS_PDF_MIMES.has(file.type) && /\.pdf$/i.test(file.name.trim())
  );
}

/** Assinatura de arquivo PDF: os 5 primeiros bytes são "%PDF-". */
export function hasPdfSignature(bytes: Uint8Array): boolean {
  const sig = [0x25, 0x50, 0x44, 0x46, 0x2d];
  return sig.every((b, i) => bytes[i] === b);
}

/** Destino de upload direto no Storage (URL assinada, válida por 2 h). */
export type ResumeUploadTarget = { path: string; token: string };

/**
 * Prefixo do caminho de currículo que um candidato pode enviar para uma vaga.
 * O servidor só aceita de volta caminhos que comecem com este prefixo — o
 * candidato não consegue apontar a candidatura para o arquivo de outra pessoa.
 */
export function applicationResumePrefix(
  companyId: string,
  jobId: string,
  candidateId: string
): string {
  return `${companyId}/${jobId}/${candidateId}/`;
}

export function profileResumePrefix(candidateId: string): string {
  return `profile/${candidateId}/`;
}

/** Caminho válido: prefixo esperado + UUID + ".pdf", sem "..". */
export function isAllowedResumePath(path: string, prefix: string): boolean {
  if (!path.startsWith(prefix) || path.includes("..")) return false;
  return /^[0-9a-f-]{36}\.pdf$/.test(path.slice(prefix.length));
}

/** Arquivo de demonstração servido de /public (não está no Storage). */
export const DEMO_RESUME_PREFIX = "demo/";
export function isDemoResumePath(path: string | null | undefined): boolean {
  return Boolean(path?.startsWith(DEMO_RESUME_PREFIX));
}

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
