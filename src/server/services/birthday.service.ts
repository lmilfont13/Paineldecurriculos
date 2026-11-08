import "server-only";

import {
  buildCompanyBirthdays,
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

  // Mapeia e resolve a data de nascimento (campo ou extração inteligente do currículo)
  const mapped = rows.map((r) => {
    const effectiveBirth = r.birthDate ?? extractBirthDateFromText(r.resumeText);
    return {
      id: r.id,
      candidateId: r.candidateId,
      name: r.name,
      email: r.email,
      phone: r.phone,
      photoUrl: r.photoUrl,
      birthDate: effectiveBirth,
      jobTitle: jobLabel(r.job.title, r.job.code),
      jobCode: r.job.code,
    };
  }).filter((c) => Boolean(c.birthDate));

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
