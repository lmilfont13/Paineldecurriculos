/**
 * Cartão de aniversário (sem I/O): temas, cores e limpeza do texto.
 *
 * O cartão é desenhado pelo próprio sistema (sem IA e sem serviço externo),
 * com a cor e o nome da empresa do gestor logado.
 */
import { brandForeground, mixHex } from "@/server/models/company.model";
import { titleCasePt } from "@/server/models/text.model";

import {
  BIRTHDAY_CARD_THEMES,
  BIRTHDAY_MESSAGES,
  MAX_CARD_MESSAGE,
  type BirthdayCardNameMode,
  type BirthdayCardTheme,
} from "@/server/models/birthday-card-options.model";

export {
  BIRTHDAY_CARD_THEMES,
  BIRTHDAY_MESSAGES,
  MAX_CARD_MESSAGE,
  type BirthdayCardNameMode,
  type BirthdayCardTheme,
};
const MAX_NAME = 80;
const DEFAULT_BRAND = "#1E4FBF";

/** "MARIA JULIA DE ARAUJO" → "Maria" ou "Maria Araujo". */
export function cardDisplayName(name: string, mode: BirthdayCardNameMode): string {
  const parts = titleCasePt(name.trim()).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Você";
  if (mode === "first" || parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

/**
 * Texto do cartão: sem emoji (a imagem não depende de baixar ícones de fora),
 * sem a marcação do WhatsApp, numa linha só e dentro do limite.
 */
export function cleanCardMessage(raw: string | null | undefined): string {
  const text = (raw ?? "")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]/gu, "")
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([!?.,;:])/g, "$1")
    .trim();
  if (text.length < 2) return BIRTHDAY_MESSAGES[0].text;
  if (text.length <= MAX_CARD_MESSAGE) return text;
  const cut = text.slice(0, MAX_CARD_MESSAGE - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 1)).replace(/[\s.,;:!?]+$/, "")}…`;
}

export type CardPalette = {
  background: string;
  backgroundEnd: string;
  ink: string;
  soft: string;
  accent: string;
  confettiA: string;
  confettiB: string;
};

const isHex = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

export function cardPalette(theme: BirthdayCardTheme, brandHex: string): CardPalette {
  const brand = isHex(brandHex) ? brandHex : DEFAULT_BRAND;
  const brandIsDark = brandForeground(brand) === "#ffffff";

  if (theme === "claro") {
    const accent = brandIsDark ? brand : mixHex(brand, "#000000", 0.5);
    return {
      background: "#fbf8f3",
      backgroundEnd: "#f1eadf",
      ink: "#1c1917",
      soft: "#57534e",
      accent,
      confettiA: accent,
      confettiB: "#d9a441",
    };
  }
  if (theme === "noite") {
    return {
      background: "#12141a",
      backgroundEnd: "#1d2230",
      ink: "#f6f1e7",
      soft: "#bdb7aa",
      accent: "#e3b964",
      confettiA: "#e3b964",
      confettiB: brandIsDark ? mixHex(brand, "#ffffff", 0.45) : brand,
    };
  }
  const ink = brandForeground(brand);
  return {
    background: brand,
    backgroundEnd: mixHex(brand, "#000000", brandIsDark ? 0.38 : 0.12),
    ink,
    soft: mixHex(ink, brand, 0.22),
    accent: brandIsDark ? "#f4d58d" : mixHex(brand, "#000000", 0.62),
    confettiA: brandIsDark ? "#f4d58d" : mixHex(brand, "#000000", 0.62),
    confettiB: brandIsDark ? "#ffffff" : mixHex(brand, "#000000", 0.35),
  };
}

export type BirthdayCardParams = {
  name: string;
  mode: BirthdayCardNameMode;
  theme: BirthdayCardTheme;
  /** Idade a mostrar (null = não mostrar). */
  age: number | null;
  message: string;
};

export function parseCardParams(search: URLSearchParams): BirthdayCardParams {
  const theme = search.get("theme");
  const age = Number.parseInt(search.get("age") ?? "", 10);
  const showAge = search.get("showAge") === "true" && Number.isInteger(age) && age >= 14 && age <= 110;
  return {
    name: (search.get("name") ?? "").trim().slice(0, MAX_NAME),
    mode: search.get("mode") === "full" ? "full" : "first",
    theme: BIRTHDAY_CARD_THEMES.some((t) => t.id === theme) ? (theme as BirthdayCardTheme) : "marca",
    age: showAge ? age : null,
    message: cleanCardMessage(search.get("message")),
  };
}

/** Tamanho da letra do nome para caber em até duas linhas no cartão 1080×1080. */
export function nameFontSize(displayName: string): number {
  const longest = Math.max(...displayName.split(" ").map((w) => w.length));
  if (displayName.length <= 8) return 176;
  if (displayName.length <= 13 && longest <= 9) return 148;
  if (longest <= 10) return 128;
  if (longest <= 13) return 104;
  return 84;
}
