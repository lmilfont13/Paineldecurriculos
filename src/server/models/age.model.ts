import { extractAgeFromText, extractBirthDateFromText } from "@/server/models/cv-search.model";

/**
 * Idade para o gestor conferir na tela. Nunca entra na nota nem vai para a IA
 * (regra 3): é só informação e filtro de exibição.
 */

function ageOn(birth: Date, now: Date): number | null {
  if (isNaN(birth.getTime())) return null;
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 14 && age <= 100 ? age : null;
}

/** Idade pela data de nascimento informada; sem ela, pelo que o currículo diz. */
export function effectiveAge(
  birthDate: Date | null | undefined,
  resumeText: string | null | undefined,
  now: Date = new Date()
): number | null {
  const birth = birthDate ?? extractBirthDateFromText(resumeText);
  const fromDate = birth ? ageOn(birth, now) : null;
  return fromDate ?? extractAgeFromText(resumeText);
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
