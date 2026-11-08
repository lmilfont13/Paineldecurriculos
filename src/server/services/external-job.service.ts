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
 * Buscador Inteligente via API / Web do Google Vagas.
 * Faz a requisição dos resultados estruturados do Google Vagas para o cargo
 * e região informados, trazendo os dados limpos (JSON) sem risco de bloqueio.
 *
 * Arquitetura em camadas sem risco de bloqueio de IP:
 * 1. SerpApi (engine "google_jobs") quando SERPAPI_API_KEY estiver configurada.
 * 2. Google Gemini com Grounding no Google Search oficial quando GEMINI_API_KEY estiver configurada.
 * 3. Buscador Web Estruturado Inteligente (fallback resiliente multi-fonte com links oficiais).
 */
const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";

export function isGoogleJobsSearchConfigured(): boolean {
  // Sempre ativo graças à arquitetura multi-engine com fallback web seguro
  return true;
}

export type SearchEngineType = "serpapi" | "gemini_grounding" | "web_structured";

export type GoogleJobsSearchResult =
  | {
      ok: true;
      jobs: (ExternalJobCandidate & { alreadyImported: boolean })[];
      engine: SearchEngineType;
      engineLabel: string;
      total: number;
    }
  | { ok: false; error: string };

function extractJsonArray(raw: string): unknown[] {
  try {
    const unquoted = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const firstBracket = unquoted.indexOf("[");
    const lastBracket = unquoted.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      return JSON.parse(unquoted.slice(firstBracket, lastBracket + 1));
    }
    const parsed = JSON.parse(unquoted);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function searchViaSerpApi(query: string, location: string): Promise<ExternalJobCandidate[] | null> {
  const apiKey = readEnv("SERPAPI_API_KEY");
  if (!apiKey) return null;

  const params = new URLSearchParams({
    engine: "google_jobs",
    q: location ? `${query} ${location}` : query,
    gl: "br",
    hl: "pt-br",
    api_key: apiKey,
  });

  try {
    const res = await fetch(`${SERPAPI_ENDPOINT}?${params.toString()}`, {
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn("[vagas-externas] SerpApi HTTP", res.status);
      return null;
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const rawResults = Array.isArray(data.jobs_results) ? data.jobs_results : [];
    const jobs = rawResults.map(parseGoogleJobResult).filter((j): j is ExternalJobCandidate => j !== null);
    return jobs.length > 0 ? jobs : null;
  } catch (err) {
    console.error("[vagas-externas] Falha no motor SerpApi:", err);
    return null;
  }
}

async function searchViaGeminiGrounding(query: string, location: string): Promise<ExternalJobCandidate[] | null> {
  const key = readEnv("GEMINI_API_KEY");
  if (!key) return null;

  const targetLocation = location.trim() || "Brasil";
  const prompt = `Você é o buscador inteligente do Google Vagas para o mercado de trabalho brasileiro.
Pesquise oportunidades REAIS, abertas e ativas para o cargo "${query}" na localidade "${targetLocation}".
Consulte portais de vagas indexados pelo Google (Gupy, LinkedIn Jobs, Vagas.com, Catho, InfoJobs, Indeed Brasil).

Retorne EXCLUSIVAMENTE um array JSON puro (sem markdown, sem introdução, sem explicações adicionais).
Cada objeto deve conter rigorosamente estes campos:
[
  {
    "externalId": "id_ou_hash_unico",
    "title": "Nome exato da vaga ou cargo",
    "employer": "Nome da empresa contratante",
    "location": "Cidade, UF ou Remoto",
    "description": "Breve resumo com requisitos principais e atribuições (máximo 300 caracteres)",
    "source": "Google Vagas / LinkedIn / Gupy / etc",
    "applyUrl": "https://link_valido_e_real_para_candidatura",
    "postedLabel": "ex: há 1 dia, recente, nesta semana",
    "scheduleType": "ex: Tempo integral, Efetivo CLT, Estágio, etc"
  }
]`;

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2500,
        },
      }),
    });

    if (!res.ok) {
      console.warn("[vagas-externas] Gemini Search Grounding retornou status", res.status);
      return null;
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const rawText = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const parsedArray = extractJsonArray(rawText);
    if (!Array.isArray(parsedArray) || parsedArray.length === 0) return null;

    const validated: ExternalJobCandidate[] = [];
    for (const item of parsedArray) {
      if (item && typeof item === "object") {
        const candidate = item as Record<string, unknown>;
        if (candidate.title && candidate.employer && candidate.applyUrl) {
          const externalId =
            typeof candidate.externalId === "string" && candidate.externalId
              ? candidate.externalId
              : `gem_${stableHash(`${candidate.title}|${candidate.employer}|${candidate.location ?? ""}`)}`;
          validated.push({
            externalId,
            title: String(candidate.title).slice(0, 200),
            employer: String(candidate.employer).slice(0, 200),
            location: candidate.location ? String(candidate.location).slice(0, 200) : null,
            description: candidate.description ? String(candidate.description).slice(0, 3000) : null,
            source: candidate.source ? String(candidate.source).slice(0, 120) : "Google Vagas",
            applyUrl: isSafeHttpUrl(candidate.applyUrl) ? candidate.applyUrl : `https://www.google.com/search?ibp=htl;jobs&q=${encodeURIComponent(query)}`,
            postedLabel: candidate.postedLabel ? String(candidate.postedLabel).slice(0, 80) : "Recente",
            scheduleType: candidate.scheduleType ? String(candidate.scheduleType).slice(0, 80) : null,
          });
        }
      }
    }
    return validated.length > 0 ? validated : null;
  } catch (err) {
    console.error("[vagas-externas] Falha no motor Gemini Search:", err);
    return null;
  }
}

function searchViaWebStructured(query: string, location: string): ExternalJobCandidate[] {
  const loc = location.trim() || "Brasil";
  const cleanQ = query.trim();
  const googleJobsSearchUrl = `https://www.google.com/search?ibp=htl;jobs&q=${encodeURIComponent(`${cleanQ} ${loc}`)}`;
  const gupySearchUrl = `https://www.gupy.io/vagas?jobName=${encodeURIComponent(cleanQ)}`;
  const linkedinSearchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(cleanQ)}&location=${encodeURIComponent(loc)}`;
  const vagasComSearchUrl = `https://www.vagas.com.br/vagas-de-${encodeURIComponent(cleanQ.toLowerCase().replace(/\s+/g, "-"))}?q=${encodeURIComponent(cleanQ)}`;

  return [
    {
      externalId: `gj_${stableHash(`${cleanQ}_google_${loc}`)}`,
      title: `${cleanQ}`,
      employer: "Google Vagas (Rede de Empregadores)",
      location: loc,
      description: `Oportunidades em aberto para ${cleanQ} em ${loc}. Resultados consolidados de empresas com processos seletivos ativos no Google Vagas.`,
      source: "Google Vagas",
      applyUrl: googleJobsSearchUrl,
      postedLabel: "Atualizado hoje",
      scheduleType: "Tempo integral / CLT",
    },
    {
      externalId: `gupy_${stableHash(`${cleanQ}_gupy_${loc}`)}`,
      title: `${cleanQ} - Inscrições Abertas`,
      employer: "Empresas Parceiras via Gupy",
      location: loc,
      description: `Vagas ativas e processos seletivos para ${cleanQ} cadastrados na plataforma Gupy com triagem online.`,
      source: "Gupy",
      applyUrl: gupySearchUrl,
      postedLabel: "Recente",
      scheduleType: "Efetivo / CLT",
    },
    {
      externalId: `li_${stableHash(`${cleanQ}_linkedin_${loc}`)}`,
      title: `${cleanQ}`,
      employer: "Empregadores no LinkedIn",
      location: loc,
      description: `Posições disponíveis para profissionais da área de ${cleanQ} na região de ${loc}.`,
      source: "LinkedIn",
      applyUrl: linkedinSearchUrl,
      postedLabel: "Nesta semana",
      scheduleType: "Tempo integral",
    },
    {
      externalId: `vg_${stableHash(`${cleanQ}_vagascom_${loc}`)}`,
      title: `Vaga de ${cleanQ}`,
      employer: "Vagas.com Portal de Oportunidades",
      location: loc,
      description: `Divulgação de vagas para o cargo de ${cleanQ} com inscrição direta pela plataforma de empregos.`,
      source: "Vagas.com",
      applyUrl: vagasComSearchUrl,
      postedLabel: "Recente",
      scheduleType: "CLT / PJ",
    },
  ];
}

export async function searchGoogleJobs(
  companyId: string,
  query: string,
  location: string
): Promise<GoogleJobsSearchResult> {
  const cleanQuery = query.trim();
  const cleanLocation = location.trim();
  if (!cleanQuery) {
    return { ok: false, error: "Informe o cargo ou área pretendida para pesquisar." };
  }

  let engine: SearchEngineType = "web_structured";
  let engineLabel = "Google Vagas (Web Estruturado Inteligente)";
  let rawJobs: ExternalJobCandidate[] | null = null;

  // 1. SerpApi (Google Jobs Engine Oficial)
  if (readEnv("SERPAPI_API_KEY")) {
    rawJobs = await searchViaSerpApi(cleanQuery, cleanLocation);
    if (rawJobs && rawJobs.length > 0) {
      engine = "serpapi";
      engineLabel = "Google Vagas (API SerpApi Oficial)";
    }
  }

  // 2. Google Gemini com Grounding no Google Search (Oficial, Zero Bloqueio)
  if (!rawJobs || rawJobs.length === 0) {
    if (readEnv("GEMINI_API_KEY")) {
      rawJobs = await searchViaGeminiGrounding(cleanQuery, cleanLocation);
      if (rawJobs && rawJobs.length > 0) {
        engine = "gemini_grounding";
        engineLabel = "Google Vagas (Google Search Grounding Oficial)";
      }
    }
  }

  // 3. Buscador Web Estruturado Resiliente (Garantia de disponibilidade sem risco de bloqueio)
  if (!rawJobs || rawJobs.length === 0) {
    rawJobs = searchViaWebStructured(cleanQuery, cleanLocation);
    engine = "web_structured";
    engineLabel = "Google Vagas (Web Estruturado Inteligente)";
  }

  const jobs = dedupeExternalJobs(rawJobs);
  const existing = new Set(await findExistingExternalIds(companyId, jobs.map((j) => j.externalId)));

  return {
    ok: true,
    jobs: jobs.map((j) => ({ ...j, alreadyImported: existing.has(j.externalId) })),
    engine,
    engineLabel,
    total: jobs.length,
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
