/**
 * Atribuição de origem: de onde veio cada candidato.
 *
 * Fontes reconhecidas (Application.source):
 *   instagram, whatsapp, google, indicacao, direto
 *
 * O cookie `__triagem_src` guarda a origem por 30 dias. O proxy
 * captura ?origem= ou ?ref= da URL e o Referer do Google; a candidatura
 * lê o cookie na hora de gravar.
 */

import { z } from "zod";

// ── Fontes conhecidas ──────────────────────────────────────────────

export const KNOWN_SOURCES = [
  "instagram",
  "whatsapp",
  "google",
  "indicacao",
  "direto",
] as const;

export type KnownSource = (typeof KNOWN_SOURCES)[number];

/** Rótulo legível para exibir no painel. */
export const SOURCE_LABELS: Record<string, string> = {
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  google: "Google",
  indicacao: "Indicação",
  direto: "Acesso direto",
};

export function sourceLabel(source: string | null | undefined): string {
  if (!source) return "Desconhecido";
  return SOURCE_LABELS[source] ?? source;
}

// ── Cookie ─────────────────────────────────────────────────────────

export const ATTRIBUTION_COOKIE = "__triagem_src";
export const REFERRER_COOKIE = "__triagem_ref";
/** 30 dias em segundos. */
export const COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

/** Extrai a origem da URL: ?origem=instagram ou ?ref=joao-silva. */
export function extractAttribution(url: URL): {
  source: string | null;
  referrerCode: string | null;
} {
  const origem = url.searchParams.get("origem")?.toLowerCase().trim() || null;
  const ref = url.searchParams.get("ref")?.trim() || null;

  if (ref) {
    return { source: "indicacao", referrerCode: ref };
  }
  if (origem) {
    return { source: origem, referrerCode: null };
  }
  return { source: null, referrerCode: null };
}

/** Verifica se o Referer HTTP é do Google (busca orgânica ou Google for Jobs). */
export function isGoogleReferer(referer: string | null): boolean {
  if (!referer) return false;
  try {
    const host = new URL(referer).hostname;
    return host.endsWith("google.com") || host.endsWith("google.com.br");
  } catch {
    return false;
  }
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
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}
