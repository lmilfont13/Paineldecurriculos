import { z } from "zod";

/**
 * Domínio das vagas externas (Google Vagas). Sem I/O — só tipos, schemas e
 * funções puras (regra 6).
 *
 * Vaga externa = divulgação comunitária. O candidato se inscreve na fonte
 * original; a empresa dona do portal não conduz nem responde pelo processo.
 */

export const EXTERNAL_JOBS_DISCLAIMER =
  "Estas são oportunidades públicas de outras empresas, reunidas aqui para ajudar quem está procurando emprego. " +
  "A seleção, os requisitos e a contratação são de responsabilidade exclusiva da empresa anunciante. " +
  "Não cobramos nada e não temos vínculo com esses processos. Desconfie de qualquer pedido de pagamento.";

/** Resultado de busca já normalizado, pronto para o gestor revisar. */
export type ExternalJobCandidate = {
  externalId: string;
  title: string;
  employer: string;
  location: string | null;
  description: string | null;
  source: string | null;
  applyUrl: string;
  postedLabel: string | null;
  scheduleType: string | null;
};

/** Vaga externa como aparece na página pública. */
export type PublicExternalJob = {
  id: string;
  title: string;
  employer: string;
  location: string | null;
  description: string | null;
  source: string | null;
  applyUrl: string;
  postedLabel: string | null;
  scheduleType: string | null;
};

export const externalJobSearchSchema = z.object({
  query: z.string().trim().min(2, "Informe o cargo ou termo.").max(120),
  location: z.string().trim().max(120).optional().default(""),
});

/** Só aceita links http(s) — nunca javascript:, data: etc. */
export function isSafeHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2000) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export const externalJobCandidateSchema = z.object({
  externalId: z.string().min(1).max(500),
  title: z.string().trim().min(1).max(200),
  employer: z.string().trim().min(1).max(200),
  location: z.string().trim().max(200).nullable(),
  description: z.string().max(6000).nullable(),
  source: z.string().trim().max(120).nullable(),
  applyUrl: z.string().refine(isSafeHttpUrl, "Link inválido."),
  postedLabel: z.string().trim().max(80).nullable(),
  scheduleType: z.string().trim().max(80).nullable(),
});

export const importExternalJobsSchema = z
  .array(externalJobCandidateSchema)
  .min(1, "Selecione ao menos uma vaga.")
  .max(50);

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, max) : null;
}

/** Normaliza "via LinkedIn" → "LinkedIn". */
export function normalizeSource(via: unknown): string | null {
  const s = str(via, 120);
  return s ? s.replace(/^via\s+/i, "") : null;
}

/** Hash curto e estável (djb2) para quando a fonte não manda um id. */
export function stableHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Converte um item de `jobs_results` (Google Vagas via SerpApi) para o nosso
 * formato. Devolve null se faltar título, empresa ou um link seguro.
 */
export function parseGoogleJobResult(raw: unknown): ExternalJobCandidate | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const title = str(r.title, 200);
  const employer = str(r.company_name, 200);
  if (!title || !employer) return null;

  const applyOptions = Array.isArray(r.apply_options) ? r.apply_options : [];
  const firstApply = applyOptions
    .map((o) => (o && typeof o === "object" ? (o as Record<string, unknown>).link : null))
    .find(isSafeHttpUrl);
  const applyUrl = firstApply ?? (isSafeHttpUrl(r.share_link) ? r.share_link : null);
  if (!applyUrl) return null;

  const ext = (r.detected_extensions ?? {}) as Record<string, unknown>;
  const location = str(r.location, 200);
  const externalId =
    str(r.job_id, 500) ?? `h_${stableHash(`${title}|${employer}|${location ?? ""}`)}`;

  return {
    externalId,
    title,
    employer,
    location,
    description: str(r.description, 6000),
    source: normalizeSource(r.via),
    applyUrl,
    postedLabel: str(ext.posted_at, 80),
    scheduleType: str(ext.schedule_type, 80),
  };
}

/** Remove resultados repetidos (mesmo id) mantendo a ordem do Google. */
export function dedupeExternalJobs(items: ExternalJobCandidate[]): ExternalJobCandidate[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.externalId)) return false;
    seen.add(item.externalId);
    return true;
  });
}

