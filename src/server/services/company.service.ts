import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  toPublicCompany,
  type CareersPageInput,
  type PublicCompany,
} from "@/server/models/company.model";
import {
  findActiveCompanies,
  findCompanyById,
  findCompanyBySlug,
  findFirstActiveCompany,
  updateCompany,
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

/** Lista de empresas ativas para o seletor público da tela de login. */
export function listPublicCompanies() {
  return findActiveCompanies();
}

/** Slug da empresa padrão (raiz do site aponta para a página dela). */
export async function getDefaultCompanySlug(): Promise<string | null> {
  const company = await findFirstActiveCompany();
  return company?.slug ?? null;
}

/**
 * O dono edita a própria vitrine (Configurações). O companyId vem sempre da
 * sessão (regra 1); slug, e-mail e status da conta ficam fora do alcance.
 */
export async function updateCareersPage(
  companyId: string,
  input: CareersPageInput & { logoUrl?: string; logoFullUrl?: string }
) {
  return updateCompany(companyId, {
    name: input.name,
    heroTitle: input.heroTitle,
    heroSubtitle: input.heroSubtitle,
    aboutText: input.aboutText || null,
    primaryColor: input.primaryColor,
    ...(input.logoUrl ? { logoUrl: input.logoUrl } : {}),
    ...(input.logoFullUrl ? { logoFullUrl: input.logoFullUrl } : {}),
  });
}

const LOGO_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
]);
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/** Sobe um logo para o bucket público e retorna a URL. */
export async function uploadCompanyLogo(
  file: File
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!LOGO_MIMES.has(file.type)) {
    return { ok: false, error: "Logo: use PNG, JPG, SVG ou WebP." };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { ok: false, error: "Logo: máximo de 2 MB." };
  }
  const ext = file.type === "image/svg+xml" ? "svg" : file.type.split("/")[1];
  const path = `${crypto.randomUUID()}.${ext}`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from("logos")
    .upload(path, file, { contentType: file.type });
  if (error) return { ok: false, error: "Falha ao enviar o logo." };
  const { data } = supabase.storage.from("logos").getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

