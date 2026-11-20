import "server-only";

import { findTalentPoolJob } from "@/server/repositories/job.repository";
import {
  findShowcaseHires,
  updateShowcaseConsent,
  updateShowcaseHidden,
} from "@/server/repositories/application.repository";
import { toPublicHires, type PublicHire } from "@/server/models/showcase.model";

/**
 * Vitrine de contratados da página pública. Fica de fora a vaga oculta do
 * banco de talentos (não é uma vaga de verdade) e quem não autorizou.
 */
export async function listPublicHires(companyId: string): Promise<PublicHire[]> {
  const talentPool = await findTalentPoolJob(companyId);
  const rows = await findShowcaseHires(companyId, talentPool?.id ?? null);
  return toPublicHires(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      jobTitle: row.job.title,
      jobLocation: row.job.location,
      approvedAt: row.statusEvents[0]?.createdAt ?? row.updatedAt,
    }))
  );
}

/** Candidato aprovado decide se aparece. Retorna false se não for a candidatura dele ou não estiver aprovada. */
export async function setShowcaseConsent(
  candidateId: string,
  applicationId: string,
  consent: boolean
): Promise<boolean> {
  const { count } = await updateShowcaseConsent(candidateId, applicationId, consent);
  return count > 0;
}

/** Gestor oculta (ou volta a mostrar) alguém da vitrine — sempre na empresa da sessão (regra 1). */
export async function setShowcaseHidden(
  companyId: string,
  applicationId: string,
  hidden: boolean
): Promise<boolean> {
  const { count } = await updateShowcaseHidden(companyId, applicationId, hidden);
  return count > 0;
}
