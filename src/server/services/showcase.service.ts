import "server-only";

import { findTalentPoolJob } from "@/server/repositories/job.repository";
import {
  findShowcaseAskTargets,
  findShowcaseHires,
  markShowcaseAsked,
  updateShowcaseConsent,
  updateShowcaseHidden,
} from "@/server/repositories/application.repository";
import {
  SHOWCASE_ASK_SUBJECT,
  SHOWCASE_ASK_TEXT,
  toPublicHires,
  type PublicHire,
} from "@/server/models/showcase.model";
import { sendBulkMessage } from "@/server/services/bulk-message.service";

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

async function askTargets(companyId: string): Promise<string[]> {
  const talentPool = await findTalentPoolJob(companyId);
  return (await findShowcaseAskTargets(companyId, talentPool?.id ?? null)).map((r) => r.id);
}

/** Quantos aprovados ainda não foram perguntados (o painel mostra o botão só se houver). */
export async function countShowcasePending(companyId: string): Promise<number> {
  return (await askTargets(companyId)).length;
}

/**
 * Pede a autorização aos aprovados que ainda não responderam: aviso no site +
 * e-mail, com o link da candidatura. Cada pessoa recebe uma vez só.
 */
export async function askShowcaseConsent(
  companyId: string
): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
  const ids = await askTargets(companyId);
  if (ids.length === 0) return { ok: false, error: "Ninguém aguardando o pedido." };
  const result = await sendBulkMessage(companyId, ids, SHOWCASE_ASK_SUBJECT, SHOWCASE_ASK_TEXT);
  if (!result.ok) return result;
  await markShowcaseAsked(companyId, ids);
  return { ok: true, sent: result.total };
}
