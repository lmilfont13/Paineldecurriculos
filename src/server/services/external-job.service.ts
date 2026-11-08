import "server-only";

import { readEnv } from "@/lib/env";
import {
  dedupeExternalJobs,
  isSafeHttpUrl,
  normalizeSource,
  parseGoogleJobResult,
  stableHash,
  type ExternalJobCandidate,
  type PublicExternalJob,
} from "@/server/models/external-job.model";
import {
  deleteExternalJob,
  findExistingExternalIds,
  findExternalJobsByCompany,
  findPublishedExternalJobs,
  insertExternalJobs,
  setExternalJobPublished,
} from "@/server/repositories/external-job.repository";

/**
 * O Google não oferece API pública do Google Vagas. A busca usa a SerpApi
 * (engine "google_jobs"), que devolve os resultados do Google Vagas em JSON
 * de forma autorizada.
 */
const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";

export function isGoogleJobsSearchConfigured(): boolean {
  return Boolean(readEnv("SERPAPI_API_KEY"));
}

export type GoogleJobsSearchResult =
  | { ok: true; jobs: (ExternalJobCandidate & { alreadyImported: boolean })[] }
  | { ok: false; error: string };

export async function searchGoogleJobs(
  companyId: string,
  query: string,
  location: string
): Promise<GoogleJobsSearchResult> {
  const apiKey = readEnv("SERPAPI_API_KEY");
  if (!apiKey) {
    return {
      ok: false,
      error:
        "Busca automática no Google Vagas não configurada: adicione a variável SERPAPI_API_KEY no painel da Vercel (plano gratuito disponível com 100 buscas/mês em serpapi.com). Enquanto isso, você pode cadastrar e importar vagas colando o link direto abaixo.",
    };
  }

  const params = new URLSearchParams({
    engine: "google_jobs",
    q: location ? `${query} ${location}` : query,
    gl: "br",
    hl: "pt-br",
    api_key: apiKey,
  });

  let data: Record<string, unknown>;
  try {
    const res = await fetch(`${SERPAPI_ENDPOINT}?${params.toString()}`, {
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      console.error("[vagas-externas] SerpApi HTTP", res.status, String(data.error ?? "").slice(0, 200));
      return {
        ok: false,
        error:
          res.status === 401
            ? "Chave da SerpApi inválida. Verifique o SERPAPI_API_KEY."
            : res.status === 429
            ? "Limite de buscas da SerpApi atingido. Tente mais tarde ou revise o plano."
            : "O Google Vagas não respondeu agora. Tente novamente em instantes.",
      };
    }
  } catch (error) {
    console.error("[vagas-externas] Falha ao consultar a SerpApi:", error);
    return { ok: false, error: "Não foi possível consultar o Google Vagas agora. Tente novamente." };
  }

  const rawResults = Array.isArray(data.jobs_results) ? data.jobs_results : [];
  const jobs = dedupeExternalJobs(
    rawResults.map(parseGoogleJobResult).filter((j): j is ExternalJobCandidate => j !== null)
  );

  const existing = new Set(await findExistingExternalIds(companyId, jobs.map((j) => j.externalId)));
  return {
    ok: true,
    jobs: jobs.map((j) => ({ ...j, alreadyImported: existing.has(j.externalId) })),
  };
}

/**
 * Extrai dados preliminares de vaga a partir de um link externo colado pelo gestor.
 * Tenta ler metatags OpenGraph ou Schema.org JobPosting da página.
 */
export async function extractJobPreviewFromUrl(url: string): Promise<{
  ok: boolean;
  data?: Partial<ExternalJobCandidate>;
  error?: string;
}> {
  if (!isSafeHttpUrl(url)) {
    return { ok: false, error: "Link inválido. Deve começar com http:// ou https://" };
  }

  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.replace(/^www\./, "");
    let source = "Web";
    if (host.includes("linkedin")) source = "LinkedIn";
    else if (host.includes("gupy")) source = "Gupy";
    else if (host.includes("vagas.com")) source = "Vagas.com";
    else if (host.includes("infojobs")) source = "InfoJobs";
    else if (host.includes("catho")) source = "Catho";
    else if (host.includes("indeed")) source = "Indeed";
    else if (host.includes("google")) source = "Google Vagas";

    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) {
      return {
        ok: true,
        data: {
          applyUrl: url,
          source,
          externalId: `url_${stableHash(url)}`,
        },
      };
    }

    const html = await res.text();
    // Extrai título das tags <title> ou og:title
    const titleMatch =
      html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+name=["']title["']\s+content=["']([^"']+)["']/i) ||
      html.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim().replace(/\s*[-|·].*$/, "") : "";

    // Extrai descrição básica
    const descMatch =
      html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1].trim().slice(0, 1000) : "";

    return {
      ok: true,
      data: {
        title: title || undefined,
        applyUrl: url,
        description: description || undefined,
        source,
        externalId: `url_${stableHash(url)}`,
      },
    };
  } catch {
    return {
      ok: true,
      data: {
        applyUrl: url,
        externalId: `url_${stableHash(url)}`,
      },
    };
  }
}

export async function importExternalJobs(companyId: string, items: ExternalJobCandidate[]) {
  const imported = await insertExternalJobs(companyId, dedupeExternalJobs(items));
  return { imported, skipped: items.length - imported };
}

export async function listExternalJobsForManager(companyId: string) {
  return findExternalJobsByCompany(companyId);
}

export async function listPublicExternalJobs(companyId: string): Promise<PublicExternalJob[]> {
  return findPublishedExternalJobs(companyId);
}

export async function toggleExternalJob(companyId: string, id: string, isPublished: boolean) {
  return (await setExternalJobPublished(companyId, id, isPublished)) > 0;
}

export async function removeExternalJob(companyId: string, id: string) {
  return (await deleteExternalJob(companyId, id)) > 0;
}
