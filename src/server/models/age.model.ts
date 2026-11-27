import { extractAgeFromText, extractBirthDateFromText } from "@/server/models/cv-search.model";

/**
 * Idade para o gestor conferir na tela. Nunca entra na nota nem vai para a IA
 * (regra 3): é só informação e filtro de exibição.
 */

/**
 * Converte qualquer entrada de data (Date, string ISO, string brasileira DD/MM/AAAA) em Date válida.
 */
export function parseBirthDate(input: unknown): Date | null {
  if (!input) return null;
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (!s) return null;

  // Formato brasileiro: DD/MM/AAAA ou DD-MM-AAAA ou DD.MM.AAAA
  const brMatch = s.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})$/);
  if (brMatch) {
    const day = Number(brMatch[1]);
    const month = Number(brMatch[2]);
    let year = Number(brMatch[3]);
    if (year < 100) year += year > new Date().getFullYear() % 100 ? 1900 : 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      return isNaN(d.getTime()) ? null : d;
    }
  }

  // Formato ISO: YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      return isNaN(d.getTime()) ? null : d;
    }
  }

  // Tenta parse nativo
  const direct = new Date(s);
  return isNaN(direct.getTime()) ? null : direct;
}

/**
 * Calcula idade com precisão a partir de uma data de nascimento.
 * Trata tanto datas locais quanto datas em UTC meia-noite (padrão Prisma).
 */
export function ageOn(birth: Date, now: Date = new Date()): number | null {
  if (!birth || isNaN(birth.getTime())) return null;

  // Se gravada como meia-noite UTC (Prisma), extrai em UTC para evitar que fusos negativos (ex: UTC-3) percam 1 dia
  const isUtcMidnight = birth.getUTCHours() === 0 && birth.getUTCMinutes() === 0;
  const bYear = isUtcMidnight ? birth.getUTCFullYear() : birth.getFullYear();
  const bMonth = isUtcMidnight ? birth.getUTCMonth() : birth.getMonth();
  const bDay = isUtcMidnight ? birth.getUTCDate() : birth.getDate();

  let age = now.getFullYear() - bYear;
  const m = now.getMonth() - bMonth;
  if (m < 0 || (m === 0 && now.getDate() < bDay)) age--;
  return age >= 14 && age <= 100 ? age : null;
}

/**
 * Extrai data de nascimento preenchida em respostas do formulário (ex: campo "Data de Nascimento").
 */
export function extractBirthDateFromAnswers(
  answers?: Array<{ field?: { label: string } | null; value?: string | null }> | null
): Date | null {
  if (!answers || !Array.isArray(answers)) return null;
  for (const a of answers) {
    const label = a.field?.label?.toLowerCase() || "";
    if (label.includes("nasc") || label.includes("anivers") || label.includes("birth")) {
      const parsed = parseBirthDate(a.value);
      if (parsed) return parsed;
    }
  }
  return null;
}

/**
 * Idade do candidato calculada SEMPRE pela data de nascimento preenchida.
 * Se houver data de nascimento (no cadastro, perfil, respostas ou currículo), a idade
 * é SEMPRE calculada hoje dinamicamente, evitando idade desatualizada do currículo.
 */
export function effectiveAge(
  birthDate: Date | string | null | undefined,
  resumeText: string | null | undefined,
  now: Date = new Date(),
  answers?: Array<{ field?: { label: string } | null; value?: string | null }> | null,
  candidateBirthDate?: Date | string | null
): number | null {
  const birth =
    parseBirthDate(birthDate) ??
    parseBirthDate(candidateBirthDate) ??
    extractBirthDateFromAnswers(answers) ??
    extractBirthDateFromText(resumeText);

  // Se temos data de nascimento, a idade é SEMPRE calculada hoje dinamicamente!
  if (birth) {
    const calculated = ageOn(birth, now);
    if (calculated !== null) return calculated;
  }

  // Apenas se NENHUMA data de nascimento estiver disponível, tenta a idade estática escrita no texto
  return extractAgeFromText(resumeText);
}

export type AgeRange = {
  min?: number | null;
  max?: number | null;
  /** Esconde quem não tem idade conhecida quando há filtro. */
  hideUnknown?: boolean;
};

/** A pessoa entra no filtro de idade? Sem idade conhecida, aparece, a menos que o gestor peça o contrário. */
export function inAgeRange(age: number | null, range: AgeRange): boolean {
  const hasFilter = typeof range.min === "number" || typeof range.max === "number";
  if (age === null) return !(hasFilter && range.hideUnknown);
  if (typeof range.min === "number" && age < range.min) return false;
  if (typeof range.max === "number" && age > range.max) return false;
  return true;
}

/** "05/03/1990 (35 anos)" — sempre calcula a idade exata hoje a partir da data de nascimento. */
export function formatBirthDate(
  birthDate: Date | string | null | undefined,
  now: Date = new Date()
): string | null {
  const parsed = parseBirthDate(birthDate);
  if (!parsed || isNaN(parsed.getTime())) return null;

  const isUtcMidnight = parsed.getUTCHours() === 0 && parsed.getUTCMinutes() === 0;
  const day = isUtcMidnight ? parsed.getUTCDate() : parsed.getDate();
  const month = (isUtcMidnight ? parsed.getUTCMonth() : parsed.getMonth()) + 1;
  const year = isUtcMidnight ? parsed.getUTCFullYear() : parsed.getFullYear();

  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${pad(day)}/${pad(month)}/${year}`;
  const age = ageOn(parsed, now);

  return age === null ? dateStr : `${dateStr} (${age} anos)`;
}
