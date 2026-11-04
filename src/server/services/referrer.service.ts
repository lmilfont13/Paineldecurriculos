/**
 * Regras de negócio de indicadores e atribuição de origem.
 * Camada de service: orquestra repositories, aplica regras, nunca importa Prisma.
 */

import type { ReferrerDTO, ReferrerInput } from "@/server/models/attribution.model";
import { nameToCode, referrerSchema } from "@/server/models/attribution.model";
import {
  countApplicationsByReferrer,
  countApplicationsBySource,
  countApplicationsBySourceCompany,
  countHiredByReferrer,
  createReferrer,
  deleteReferrer,
  findReferrerByCode,
  findReferrerById,
  findReferrersByCompany,
} from "@/server/repositories/referrer.repository";

// ── Indicadores (CRUD) ────────────────────────────────────────────

export async function listReferrers(companyId: string): Promise<ReferrerDTO[]> {
  const referrers = await findReferrersByCompany(companyId);
  if (referrers.length === 0) return [];

  const codes = referrers.map((r) => r.code);
  const [appCounts, hiredCounts] = await Promise.all([
    countApplicationsByReferrer(companyId, codes),
    countHiredByReferrer(companyId, codes),
  ]);

  return referrers.map((r) => ({
    ...r,
    applicationCount: appCounts[r.code] ?? 0,
    hiredCount: hiredCounts[r.code] ?? 0,
  }));
}

export async function addReferrer(
  companyId: string,
  input: ReferrerInput,
): Promise<ReferrerDTO> {
  const parsed = referrerSchema.parse(input);

  // Verifica duplicidade
  const existing = await findReferrerByCode(companyId, parsed.code);
  if (existing) {
    throw new Error(`Já existe um indicador com o código "${parsed.code}".`);
  }

  return createReferrer({ companyId, ...parsed });
}

/** Cria indicador gerando o código a partir do nome. */
export async function addReferrerByName(
  companyId: string,
  name: string,
): Promise<ReferrerDTO> {
  const code = nameToCode(name);
  if (!code) throw new Error("Nome inválido para gerar código.");
  return addReferrer(companyId, { name, code });
}

export async function removeReferrer(
  companyId: string,
  referrerId: string,
): Promise<void> {
  const referrer = await findReferrerById(referrerId);
  if (!referrer || referrer.companyId !== companyId) {
    throw new Error("Indicador não encontrado.");
  }
  await deleteReferrer(referrerId);
}

/** Valida se um código de indicação existe para essa empresa. */
export async function validateReferrerCode(
  companyId: string,
  code: string,
): Promise<boolean> {
  const referrer = await findReferrerByCode(companyId, code);
  return !!referrer;
}

// ── Relatórios de origem ───────────────────────────────────────────

export async function getSourceReport(companyId: string, jobId: string) {
  return countApplicationsBySource(companyId, jobId);
}

export async function getCompanySourceReport(companyId: string) {
  return countApplicationsBySourceCompany(companyId);
}
