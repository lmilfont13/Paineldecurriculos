/**
 * Atribuição de origem real e identificável: de onde veio cada candidato.
 *
 * Fontes reconhecidas (Application.source):
 *   instagram, whatsapp, telegram, google, facebook, linkedin, tiktok, indicacao, direto
 */

import { z } from "zod";

// ── Fontes conhecidas ──────────────────────────────────────────────

export const KNOWN_SOURCES = [
  "instagram",
  "whatsapp",
  "telegram",
  "google",
  "facebook",
  "linkedin",
  "tiktok",
  "indicacao",
  "direto",
] as const;

export type KnownSource = (typeof KNOWN_SOURCES)[number];

/** Rótulo legível para exibir no painel. */
export const SOURCE_LABELS: Record<string, string> = {
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  google: "Google",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  indicacao: "Indicação",
  direto: "Link direto",
  desconhecido: "Link direto",
};

export function sourceLabel(source: string | null | undefined): string {
  if (!source) return "Link direto";
  return SOURCE_LABELS[source.toLowerCase()] ?? source;
}

// ── Cookie / Storage ───────────────────────────────────────────────

export const ATTRIBUTION_COOKIE = "__triagem_src";
export const REFERRER_COOKIE = "__triagem_ref";
/** 30 dias em segundos. */
export const COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

export function normalizeSourceParam(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const val = raw.toLowerCase().trim();
  if (!val) return null;
  if (val === "ig" || val === "insta" || val.includes("instagram")) return "instagram";
  if (val === "wpp" || val === "zap" || val.includes("whatsapp")) return "whatsapp";
  if (val === "tg" || val.includes("telegram") || val === "t.me") return "telegram";
  if (val === "fb" || val.includes("facebook") || val === "meta") return "facebook";
  if (val.includes("google") || val === "gads") return "google";
  if (val === "li" || val.includes("linkedin")) return "linkedin";
  if (val.includes("tiktok") || val === "tt") return "tiktok";
  if (val === "link" || val === "direto" || val === "direct") return "direto";
  return val;
}

/** Extrai a origem explícita da URL: ?origem=telegram, ?utm_source=..., ?igsh=..., ou ?ref=joao-silva. */
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
      url.searchParams.get("source") ??
      url.searchParams.get("canal"),
  );
  if (explicit) {
    return { source: explicit, referrerCode: null };
  }

  // Parâmetros automáticos adicionados pelo Instagram ao compartilhar links
  if (url.searchParams.has("igsh") || url.searchParams.has("igshid")) {
    return { source: "instagram", referrerCode: null };
  }

  // Parâmetros automáticos do Telegram
  if (url.searchParams.has("tg") || url.searchParams.has("tgWebAppStartParam")) {
    return { source: "telegram", referrerCode: null };
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
 * Detecta a origem real pelo User-Agent (navegadores internos do Instagram,
 * Telegram, WhatsApp, Facebook, LinkedIn, TikTok), pelo Referer HTTP ou
 * document.referrer (incluindo `android-app://org.telegram.messenger`, etc.).
 */
export function detectSourceFromHeaders(
  referer: string | null,
  userAgent: string | null,
  url?: URL,
): string | null {
  const ua = (userAgent ?? "").toLowerCase();
  const ref = (referer ?? "").toLowerCase().trim();

  // 1. User-Agent de navegadores internos de apps
  if (ua.includes("instagram")) return "instagram";
  if (ua.includes("telegram")) return "telegram";
  if (ua.includes("whatsapp")) return "whatsapp";
  if (ua.includes("linkedinapp")) return "linkedin";
  if (ua.includes("tiktok") || ua.includes("musical_ly") || ua.includes("bytedancewebview")) {
    return "tiktok";
  }
  if (ua.includes("fban") || ua.includes("fbav") || ua.includes("fb_iab")) {
    return "facebook";
  }

  // 2. Esquemas de apps mobile em document.referrer (Android/iOS)
  if (ref.startsWith("android-app://") || ref.startsWith("ios-app://") || ref.startsWith("tg://")) {
    if (ref.includes("telegram") || ref.startsWith("tg://")) return "telegram";
    if (ref.includes("whatsapp")) return "whatsapp";
    if (ref.includes("instagram")) return "instagram";
    if (ref.includes("linkedin")) return "linkedin";
    if (ref.includes("facebook")) return "facebook";
    if (ref.includes("tiktok") || ref.includes("musically")) return "tiktok";
    if (ref.includes("google")) return "google";
  }

  // 3. Referer HTTP padrão (web / redirecionadores como l.instagram.com, t.me, wa.me)
  if (ref) {
    try {
      const host = new URL(referer!).hostname.toLowerCase();
      if (host.includes("instagram.com")) return "instagram";
      if (host === "t.me" || host.endsWith(".t.me") || host.includes("telegram.org") || host.includes("telegram.me")) {
        return "telegram";
      }
      if (host.includes("whatsapp.com") || host === "wa.me" || host.endsWith(".wa.me")) {
        return "whatsapp";
      }
      if (host.endsWith("google.com") || host.endsWith("google.com.br")) return "google";
      if (host.includes("facebook.com") || host.endsWith("fb.com")) return "facebook";
      if (host.includes("linkedin.com") || host.endsWith("lnkd.in")) return "linkedin";
      if (host.includes("tiktok.com")) return "tiktok";
    } catch {
      // ignora URL malformada
    }
  }

  // 4. Parâmetro fbclid (quando não veio de outro canal explícito)
  if (url?.searchParams.has("fbclid")) {
    return "facebook";
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
