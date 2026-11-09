import "server-only";

import {
  buildCompanyBirthdays,
  extractAgeFromResume,
  getNowInBrazil,
  type CompanyBirthdaysData,
  type RawCandidateForBirthday,
} from "@/server/models/birthday.model";
import { findApplicationsForBirthdays } from "@/server/repositories/birthday.repository";
import { getCompanyById } from "@/server/services/company.service";
import { withPhotoUrls } from "@/server/services/resume-photo.service";
import { extractBirthDateFromText, cleanDigits, cleanEmail, cleanName } from "@/server/models/cv-search.model";
import { jobLabel } from "@/server/models/candidate-list.model";

/**
 * Carrega a central de aniversariantes da empresa, deduplicando por pessoa
 * para que cada colaborador/candidato apareça apenas uma vez.
 */
export async function getCompanyBirthdays(companyId: string): Promise<CompanyBirthdaysData | null> {
  const company = await getCompanyById(companyId);
  if (!company) return null;

  const raw = await findApplicationsForBirthdays(companyId);
  const rows = await withPhotoUrls(raw);
  const nowBr = getNowInBrazil();
  const currentYear = nowBr.year;

  const isSuspiciousBirthYear = (d: Date | null | undefined): boolean => {
    if (!d || isNaN(d.getTime())) return true;
    const y = d.getUTCFullYear();
    return y > currentYear - 14 || y < 1920;
  };

  // Mapeia e resolve a data de nascimento (campo ou extração inteligente do currículo)
  const mapped = rows
    .map((r) => {
      let effectiveBirth = r.birthDate;

      // Se não tem birthDate ou se o ano gravado for suspeito (ex: 2026),
      // tenta extrair data completa com ano válido diretamente do texto do currículo
      if (isSuspiciousBirthYear(effectiveBirth)) {
        const fromText = extractBirthDateFromText(r.resumeText);
        if (fromText && !isSuspiciousBirthYear(fromText)) {
          effectiveBirth = fromText;
        }
      }

      // Se ainda assim o ano for suspeito, mas temos o dia e mês e a idade informada no currículo (ex: 23 anos)
      if (effectiveBirth && isSuspiciousBirthYear(effectiveBirth)) {
        const ageFromCv = extractAgeFromResume(r.resumeText);
        if (ageFromCv) {
          const inferredYear = currentYear - ageFromCv;
          const bDay = effectiveBirth.getUTCDate();
          const bMonth = effectiveBirth.getUTCMonth();
          effectiveBirth = new Date(Date.UTC(inferredYear, bMonth, bDay, 12));
        }
      }

      // Se não tinha data nenhuma, mas tem menção a dia/mês no currículo (ex: "Nasc: 09/11") e idade
      if (!effectiveBirth && r.resumeText) {
        const matchDayMonth = r.resumeText.match(
          /(?:data\s*(?:de)?\s*nasc(?:imento|\.)?|nascimento|nasc\.?|anivers[aá]rio)\s*[:\-–]?\s*(\d{1,2})[\/.\-](\d{1,2})/i
        );
        if (matchDayMonth) {
          const d = Number(matchDayMonth[1]);
          const m = Number(matchDayMonth[2]);
          if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
            const ageFromCv = extractAgeFromResume(r.resumeText);
            const inferredYear = ageFromCv ? currentYear - ageFromCv : 2000;
            effectiveBirth = new Date(Date.UTC(inferredYear, m - 1, d, 12));
          }
        }
      }

      return {
        id: r.id,
        candidateId: r.candidateId,
        name: r.name,
        email: r.email,
        phone: r.phone,
        photoUrl: r.photoUrl,
        birthDate: effectiveBirth,
        resumeText: r.resumeText,
        jobTitle: jobLabel(r.job.title, r.job.code),
        jobCode: r.job.code,
      };
    })
    .filter((c) => Boolean(c.birthDate));

  // Deduplicação inteligente de pessoas físicas (mesmo CPF, candidateId, e-mail, telefone ou nome)
  const seenKeys = new Set<string>();
  const deduplicated: RawCandidateForBirthday[] = [];

  for (const c of mapped) {
    const keys: string[] = [];
    if (c.candidateId) keys.push(`cand:${c.candidateId}`);
    const email = cleanEmail(c.email);
    if (email) keys.push(`email:${email}`);
    const phone = cleanDigits(c.phone);
    if (phone.length >= 10) keys.push(`phone:${phone.slice(-10)}`);
    const name = cleanName(c.name);
    if (name) keys.push(`name:${name}`);

    const hasSeen = keys.some((k) => seenKeys.has(k));
    if (hasSeen) continue;

    for (const k of keys) seenKeys.add(k);
    deduplicated.push(c);
  }

  return buildCompanyBirthdays(deduplicated, company.name);
}
