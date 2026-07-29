import "server-only";

import {
  toPublicCompany,
  type PublicCompany,
} from "@/server/models/company.model";
import {
  findCompanyById,
  findCompanyBySlug,
  findFirstActiveCompany,
} from "@/server/repositories/company.repository";

/**
 * Resolve o tenant do fluxo público pelo slug.
 * Empresa inexistente ou desativada → null (a rota responde 404).
 */
export async function getPublicCompanyBySlug(
  slug: string
): Promise<PublicCompany | null> {
  const company = await findCompanyBySlug(slug);
  if (!company || !company.isActive) return null;
  return toPublicCompany(company);
}

/** Empresa do gestor logado (uso interno — dados completos). */
export function getCompanyById(id: string) {
  return findCompanyById(id);
}

/** Slug da empresa padrão (raiz do site aponta para a página dela). */
export async function getDefaultCompanySlug(): Promise<string | null> {
  const company = await findFirstActiveCompany();
  return company?.slug ?? null;
}
