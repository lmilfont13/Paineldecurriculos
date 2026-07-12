import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  CreateCompanyInput,
  UpdateCompanyInput,
} from "@/server/models/company.model";
import {
  countCompanies,
  createCompany,
  findAllCompaniesForAdmin,
  findCompanyById,
  findCompanyBySlug,
  updateCompany,
} from "@/server/repositories/company.repository";
import {
  findUserByEmail,
  prismaCreateManagerUser,
} from "@/server/repositories/user.repository";

export type AdminCompanyRow = {
  id: string;
  name: string;
  slug: string;
  managerEmail: string | null;
  jobCount: number;
  isActive: boolean;
  primaryColor: string;
};

export async function listCompaniesForAdmin(): Promise<AdminCompanyRow[]> {
  const companies = await findAllCompaniesForAdmin();
  return companies.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    managerEmail: c.users[0]?.email ?? null,
    jobCount: c._count.jobs,
    isActive: c.isActive,
    primaryColor: c.primaryColor,
  }));
}

export function countCompaniesForAdmin() {
  return countCompanies();
}

export function getCompanyForAdmin(id: string) {
  return findCompanyById(id);
}

/**
 * Wizard A2–A6: cria empresa + usuário gestor (Supabase Auth + tabela User).
 */
export async function createCompanyWithManager(
  input: CreateCompanyInput
): Promise<{ ok: true; companyId: string } | { ok: false; error: string }> {
  if (await findCompanyBySlug(input.slug)) {
    return { ok: false, error: `O slug "${input.slug}" já está em uso.` };
  }
  if (await findUserByEmail(input.managerEmail)) {
    return { ok: false, error: "Este e-mail de gestor já tem cadastro." };
  }

  const supabase = createAdminClient();
  const { error: authError } = await supabase.auth.admin.createUser({
    email: input.managerEmail,
    password: input.managerPassword,
    email_confirm: true,
  });
  if (authError && !/already|registered/i.test(authError.message)) {
    return { ok: false, error: `Auth: ${authError.message}` };
  }

  const company = await createCompany({
    name: input.name,
    slug: input.slug,
    email: input.email,
    cnpj: input.cnpj || null,
    sector: input.sector || null,
    website: input.website || null,
    primaryColor: input.primaryColor,
    secondaryColor: input.secondaryColor,
    logoUrl: input.logoUrl || null,
    heroTitle: input.heroTitle,
    heroSubtitle: input.heroSubtitle,
    aboutText: input.aboutText || null,
  });

  await prismaCreateManagerUser({
    email: input.managerEmail,
    name: input.managerName,
    companyId: company.id,
  });

  return { ok: true, companyId: company.id };
}

export async function updateCompanyForAdmin(
  id: string,
  input: UpdateCompanyInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const company = await findCompanyById(id);
  if (!company) return { ok: false, error: "Empresa não encontrada." };
  if (input.slug && input.slug !== company.slug) {
    if (await findCompanyBySlug(input.slug)) {
      return { ok: false, error: `O slug "${input.slug}" já está em uso.` };
    }
  }
  await updateCompany(id, {
    ...input,
    cnpj: input.cnpj !== undefined ? input.cnpj || null : undefined,
    sector: input.sector !== undefined ? input.sector || null : undefined,
    website: input.website !== undefined ? input.website || null : undefined,
    logoUrl: input.logoUrl !== undefined ? input.logoUrl || null : undefined,
    aboutText:
      input.aboutText !== undefined ? input.aboutText || null : undefined,
  });
  return { ok: true };
}

export async function setCompanyActive(id: string, isActive: boolean) {
  return updateCompany(id, { isActive });
}
