/**
 * Atribuição de origem: de onde veio cada candidato.
 *
 * Fontes reconhecidas (Application.source):
 *   instagram, whatsapp, google, facebook, linkedin, indicacao, direto
 *
 * O cookie `__triagem_src` guarda a origem por 30 dias. O proxy
 * captura ?origem=, ?utm_source=, ?igsh=, ?ref= da URL, além do
 * Referer e do User-Agent (ex.: navegador interno do Instagram/WhatsApp).
 */

import { z } from "zod";

// ── Fontes conhecidas ──────────────────────────────────────────────

export const KNOWN_SOURCES = [
  "instagram",
  "whatsapp",
  "google",
  "facebook",
  "linkedin",
  "indicacao",
  "direto",
] as const;

export type KnownSource = (typeof KNOWN_SOURCES)[number];

/** Rótulo legível para exibir no painel. */
export const SOURCE_LABELS: Record<string, string> = {
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  google: "Google",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  indicacao: "Indicação",
  direto: "Acesso direto",
  desconhecido: "Instagram",
};

export function sourceLabel(source: string | null | undefined): string {
  if (!source) return "Instagram";
  return SOURCE_LABELS[source] ?? source;
}

// ── Cookie ─────────────────────────────────────────────────────────

export const ATTRIBUTION_COOKIE = "__triagem_src";
export const REFERRER_COOKIE = "__triagem_ref";
/** 30 dias em segundos. */
export const COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

function normalizeSourceParam(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const val = raw.toLowerCase().trim();
  if (!val) return null;
  if (val === "ig" || val === "insta" || val.includes("instagram")) return "instagram";
  if (val === "wpp" || val === "zap" || val.includes("whatsapp")) return "whatsapp";
  if (val === "fb" || val.includes("facebook") || val === "meta") return "facebook";
  if (val.includes("google") || val === "gads") return "google";
  if (val === "li" || val.includes("linkedin")) return "linkedin";
  return val;
}

/** Extrai a origem da URL: ?origem=instagram, ?utm_source=..., ?igsh=..., ou ?ref=joao-silva. */
export function extractAttribution(url: URL): {
  source: string | null;
  referrerCode: string | null;
} {
  const ref = url.searchParams.get("ref")?.trim() || null;
  if (ref) {
    return { source: "indicacao", referrerCode: ref };
  }

  const explicit = normalizeSourceParam(
    url.searchParams.get("origem") ??
      url.searchParams.get("utm_source") ??
      url.searchParams.get("source"),
  );
  if (explicit) {
    return { source: explicit, referrerCode: null };
  }

  // Parâmetros automáticos do Instagram (?igsh=...)
  if (url.searchParams.has("igsh") || url.searchParams.has("igshid")) {
    return { source: "instagram", referrerCode: null };
  }

  return { source: null, referrerCode: null };
}

/** Verifica se o Referer HTTP é do Google (busca orgânica ou Google for Jobs). */
export function isGoogleReferer(referer: string | null): boolean {
  if (!referer) return false;
  try {
    const host = new URL(referer).hostname.toLowerCase();
    return host.endsWith("google.com") || host.endsWith("google.com.br");
  } catch {
    return false;
  }
}

/**
 * Detecta a origem pelo User-Agent (navegador in-app do Instagram, WhatsApp,
 * Facebook, LinkedIn), pelo cabeçalho Referer ou por parâmetros como fbclid.
 */
export function detectSourceFromHeaders(
  referer: string | null,
  userAgent: string | null,
  url?: URL,
): string | null {
  const ua = (userAgent ?? "").toLowerCase();

  // 1. Navegador interno dos apps (mais confiável em mobile)
  if (ua.includes("instagram")) return "instagram";
  if (ua.includes("whatsapp")) return "whatsapp";
  if (ua.includes("linkedinapp")) return "linkedin";
  if (ua.includes("fban") || ua.includes("fbav") || ua.includes("fb_iab")) {
    return "facebook";
  }

  // 2. Cabeçalho Referer (quando abre no navegador externo)
  if (referer) {
    try {
      const host = new URL(referer).hostname.toLowerCase();
      if (host.includes("instagram.com")) return "instagram";
      if (host.includes("whatsapp.com") || host.endsWith("wa.me")) return "whatsapp";
      if (host.endsWith("google.com") || host.endsWith("google.com.br")) return "google";
      if (host.includes("facebook.com") || host.endsWith("fb.com")) return "facebook";
      if (host.includes("linkedin.com") || host.endsWith("lnkd.in")) return "linkedin";
    } catch {
      // ignora URL malformada no Referer
    }
  }

  // 3. Parâmetro fbclid (Meta/Instagram)
  if (url?.searchParams.has("fbclid")) {
    return "instagram";
  }

  return null;
}

// ── Referrer (indicador) ───────────────────────────────────────────

export const referrerSchema = z.object({
  name: z
    .string()
    .min(2, "Nome precisa de pelo menos 2 caracteres")
    .max(100),
  code: z
    .string()
    .min(2, "Código precisa de pelo menos 2 caracteres")
    .max(50)
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
      "Código deve ter só letras minúsculas, números e hifens (sem começar ou terminar com hifen)",
    ),
});

export type ReferrerInput = z.infer<typeof referrerSchema>;

export type ReferrerDTO = {
  id: string;
  companyId: string;
  name: string;
  code: string;
  createdAt: Date;
  /** Quantas candidaturas vieram por este indicador (calculado). */
  applicationCount?: number;
  /** Quantas contratações (status APPROVED) vieram por este indicador. */
  hiredCount?: number;
};

/** Gera um código a partir do nome (slug simples). */
export function nameToCode(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}
