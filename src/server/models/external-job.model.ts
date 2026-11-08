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

/**
 * Detecta se uma URL é apenas uma página de busca, filtro, catálogo ou pesquisa genérica
 * (ex: gupy.io/vagas?jobName=..., linkedin.com/jobs/search/..., google.com/search?q=...)
 * em vez de ser o link DIRETO da vaga individual para candidatura imediata.
 */
export function isGenericSearchUrl(urlString: string): boolean {
  if (!isSafeHttpUrl(urlString)) return true;
  try {
    const url = new URL(urlString);
    const host = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();

    // 1. Google Search sem identificador de documento específico
    if (host.includes("google.")) {
      if (pathname.includes("/search")) {
        const hasDocId =
          url.searchParams.has("htidocid") ||
          url.hash.includes("htidocid") ||
          url.hash.includes("htivhid=docid");
        if (!hasDocId) return true;
      }
    }

    // 2. Gupy: páginas genéricas de busca vs vagas diretas
    if (host.includes("gupy.io")) {
      if (
        pathname === "/vagas" ||
        pathname.startsWith("/vagas/") ||
        pathname.includes("/job-search")
      ) {
        if (!pathname.includes("/job/") && !pathname.includes("/jobs/")) return true;
      }
      if (!pathname.includes("/job/") && !pathname.includes("/jobs/")) {
        if (url.searchParams.has("jobName") || url.searchParams.has("term")) return true;
      }
    }

    // 3. LinkedIn: busca de vagas vs vaga específica (/jobs/view/)
    if (host.includes("linkedin.com")) {
      if (pathname.includes("/jobs/search")) return true;
      if (url.searchParams.has("keywords") && !pathname.includes("/jobs/view")) return true;
    }

    // 4. Vagas.com: listagem genérica /vagas-de-* vs vaga direta /vagas/v*
    if (host.includes("vagas.com.br")) {
      if (
        pathname.includes("/vagas-de-") ||
        (!pathname.match(/\/vagas\/v\d+/i) && url.searchParams.has("q"))
      ) {
        return true;
      }
    }

    // 5. Indeed
    if (host.includes("indeed.com")) {
      if (pathname.includes("/jobs") && !pathname.includes("/viewjob") && !url.searchParams.has("jk")) {
        return true;
      }
    }

    // 6. Catho
    if (host.includes("catho.com.br")) {
      if (pathname.includes("/vagas/") && url.searchParams.has("q")) return true;
    }

    // 7. InfoJobs
    if (host.includes("infojobs.com.br")) {
      if (pathname.includes("/vagas-de-") && !pathname.includes("__")) return true;
    }

    // 8. Parâmetros genéricos de busca em qualquer site sem id de vaga
    const genericQueryParams = ["jobname", "keywords", "palavra_chave", "termo"];
    for (const p of genericQueryParams) {
      if (url.searchParams.has(p) && !url.searchParams.has("id") && !url.searchParams.has("jobId")) {
        if (!pathname.includes("/job/") && !pathname.includes("/jobs/") && !pathname.includes("/vaga/")) {
          return true;
        }
      }
    }

    return false;
  } catch {
    return true;
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
  const safeApplyOptions = applyOptions
    .map((o) => (o && typeof o === "object" ? (o as Record<string, unknown>).link : null))
    .filter(isSafeHttpUrl);

  // Prioriza link de candidatura que vai DIRETO para a vaga específica
  const directApply = safeApplyOptions.find((link) => !isGenericSearchUrl(link));

  // Fallback: se houver share_link direto ou primeiro link seguro disponível
  let applyUrl = directApply ?? null;
  if (!applyUrl) {
    if (isSafeHttpUrl(r.share_link) && !isGenericSearchUrl(r.share_link)) {
      applyUrl = r.share_link;
    } else if (safeApplyOptions.length > 0) {
      applyUrl = safeApplyOptions[0];
    } else if (isSafeHttpUrl(r.share_link)) {
      applyUrl = r.share_link;
    }
  }
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

