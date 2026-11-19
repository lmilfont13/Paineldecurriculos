import { domesticPhoneError } from "@/lib/phone";
import { z } from "zod";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB (regra 5)
export const RESUME_MIME = "application/pdf";

/** MIME types de imagem aceitos como currículo (foto/screenshot). */
export const IMAGE_RESUME_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/** Extensões de imagem aceitas, mapeadas ao MIME. */
const IMAGE_EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** Todos os MIME types que o bucket de currículos deve aceitar. */
export const ALL_RESUME_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

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

/** Aceita imagem (JPEG, PNG, WebP) pelo MIME ou pela extensão. */
export function looksLikeImage(file: { name: string; type: string }): boolean {
  if (IMAGE_RESUME_MIMES.has(file.type)) return true;
  const ext = file.name.trim().match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? "";
  return ext in IMAGE_EXT_TO_MIME;
}

/** Aceita PDF ou imagem como currículo. */
export function looksLikeResume(file: { name: string; type: string }): boolean {
  return looksLikePdf(file) || looksLikeImage(file);
}

/**
 * Determina o MIME type a usar no upload, baseado no arquivo. Para PDFs
 * ambíguos retorna "application/pdf"; para imagens sem MIME retorna pelo
 * extensão. Retorna null se não reconhecer.
 */
export function resolveResumeMime(file: { name: string; type: string }): string | null {
  if (looksLikePdf(file)) return "application/pdf";
  if (IMAGE_RESUME_MIMES.has(file.type)) return file.type;
  const ext = file.name.trim().match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? "";
  return IMAGE_EXT_TO_MIME[ext] ?? null;
}

/** Extensão de arquivo para o caminho no Storage, baseada no MIME. */
export function resumeExtForMime(mime: string): string {
  if (mime === "application/pdf") return ".pdf";
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  return ".pdf"; // fallback
}

/** Assinatura de arquivo PDF: os 5 primeiros bytes são "%PDF-". */
export function hasPdfSignature(bytes: Uint8Array): boolean {
  const sig = [0x25, 0x50, 0x44, 0x46, 0x2d];
  return sig.every((b, i) => bytes[i] === b);
}

/** Verifica se o caminho no Storage aponta para uma imagem (não PDF). */
export function isImageResumePath(path: string): boolean {
  return /\.(jpe?g|png|webp)$/i.test(path);
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

/** Caminho válido: prefixo esperado + UUID + extensão permitida, sem "..". */
export function isAllowedResumePath(path: string, prefix: string): boolean {
  if (!path.startsWith(prefix) || path.includes("..")) return false;
  return /^[0-9a-f-]{36}\.(pdf|jpe?g|png|webp)$/.test(path.slice(prefix.length));
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
  phone: z.string().refine((v) => !domesticPhoneError(v, { mobile: true }),
    "Informe o WhatsApp com DDD, sem +55. Exemplo: (85) 99999-9999."),
  messagePhone: z.string().optional().nullable().refine((v) => !domesticPhoneError(v ?? "", { optional: true }),
    "Informe o número de recado com DDD, sem +55, ou deixe em branco."),
  /** LGPD: aceite do Aviso de Privacidade (exigido em submitApplication). */
  consent: z.boolean().optional(),
  birthDate: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  neighborhood: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  street: z.string().optional().nullable(),
  streetNumber: z.string().optional().nullable(),
  complement: z.string().optional().nullable(),
  rg: z.string().optional().nullable(),
  cpf: z.string().optional().nullable(),
  bootSize: z.string().optional().nullable(),
  hasBankAccount: z.string().optional().nullable(),
  bankNames: z.string().optional().nullable(),
  bankAccountType: z.string().optional().nullable(),
  pantsSize: z.string().optional().nullable(),
  shirtSize: z.string().optional().nullable(),
  desiredRole: z.string().optional().nullable(),
  /** Instagram como o candidato digitou; normalizado em submitApplication. */
  instagram: z.string().max(200).optional().nullable(),
  salaryExpectation: z.string().optional().nullable(),
  workPreference: z.string().optional().nullable(),
  availability: z.string().optional().nullable(),
  hasCnh: z.string().optional().nullable(),
  isPcd: z.boolean().optional().default(false),
  pcdDetails: z.string().optional().nullable(),
  /** Respostas dos FormFields da empresa: fieldId → valor. */
  answers: z.record(z.string(), z.string()),
});

export type ApplicationInput = z.infer<typeof applicationInputSchema>;

export const managerUpdateRegistrationSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome completo."),
  email: z.string().trim().email("Informe um e-mail válido."),
  phone: z.string().trim().optional().nullable(),
  birthDate: z.string().trim().optional().nullable(),
  rg: z.string().trim().optional().nullable(),
  cpf: z.string().trim().optional().nullable(),
  maritalStatus: z.string().trim().optional().nullable(),
  hasChildren: z.boolean().optional().nullable(),
  childrenCount: z.number().int().min(0).max(30).optional().nullable(),
  zipCode: z.string().trim().optional().nullable(),
  street: z.string().trim().optional().nullable(),
  streetNumber: z.string().trim().optional().nullable(),
  complement: z.string().trim().optional().nullable(),
  neighborhood: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().nullable(),
  desiredRole: z.string().trim().optional().nullable(),
  salaryExpectation: z.string().trim().optional().nullable(),
  instagram: z.string().trim().optional().nullable(),
  workPreference: z.string().trim().optional().nullable(),
  availability: z.string().trim().optional().nullable(),
  hasCnh: z.string().trim().optional().nullable(),
  isPcd: z.boolean().optional(),
  pcdDetails: z.string().trim().optional().nullable(),
  bootSize: z.string().trim().optional().nullable(),
  pantsSize: z.string().trim().optional().nullable(),
  shirtSize: z.string().trim().optional().nullable(),
  hasBankAccount: z.string().trim().optional().nullable(),
  bankNames: z.string().trim().optional().nullable(),
  bankAccountType: z.string().trim().optional().nullable(),
  professionalSummary: z.string().trim().optional().nullable(),
  aiProfile: z.string().trim().optional().nullable(),
  aiArea: z.string().trim().optional().nullable(),
  aiLevel: z.string().trim().optional().nullable(),
  answers: z.record(z.string(), z.string()).optional(),
});

export type ManagerUpdateRegistrationInput = z.infer<typeof managerUpdateRegistrationSchema>;

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
  SHORTLISTED: "Em análise",
  INTERVIEW: "Entrevista",
  STANDBY: "Stand-by",
  APPROVED: "Aprovado",
  REJECTED: "Banco de dados",
} as const;

export type AppStatusKey = keyof typeof appStatusLabels;

/** "há 9 dias" — torna visível o candidato esquecido. */
export function formatWaiting(since: Date): string {
  const days = Math.floor((Date.now() - since.getTime()) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "há 1 dia";
  return `há ${days} dias`;
}

/** "candidatou-se em 9 jul" / "…em 9 jul, 14:32" (E3/E4). Sempre no fuso do Brasil (America/Sao_Paulo). */
export function formatAppliedAt(date: Date, withTime = false): string {
  const day = date.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    timeZone: "America/Sao_Paulo",
  });
  if (!withTime) return day;
  const time = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
  return `${day}, ${time}`;
}

const profileChoices = {
  workPreference: {
    ANY: "Qualquer modalidade",
    ONSITE: "Presencial",
    HYBRID: "Híbrido",
    REMOTE: "100% Remoto",
  },
  availability: {
    IMMEDIATE: "Imediata",
    "15_DAYS": "Até 15 dias",
    "30_DAYS": "Até 30 dias",
    NEGOTIABLE: "A combinar",
  },
  hasCnh: {
    NONE: "Não possui",
    A: "Cat. A (Moto)",
    B: "Cat. B (Carro)",
    AB: "Cat. AB (Carro e Moto)",
    C_D_E: "Cat. C/D/E (Pesados)",
  },
} as const;

/** Rótulo que o candidato viu no formulário para a escolha do perfil ("" se desconhecida). */
export function profileChoiceLabel(
  kind: keyof typeof profileChoices,
  value: string
): string {
  return (profileChoices[kind] as Record<string, string>)[value] ?? "";
}
