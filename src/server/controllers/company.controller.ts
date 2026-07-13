"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/server/controllers/guards";
import {
  createCompanySchema,
  updateCompanySchema,
} from "@/server/models/company.model";
import {
  createCompanyWithManager,
  resetManagerPassword,
  setCompanyActive,
  updateCompanyForAdmin,
  uploadCompanyLogo,
} from "@/server/services/company-admin.service";

/** A6 · Se veio arquivo de logo, sobe e devolve a URL pública. */
async function resolveLogoUrl(
  formData: FormData
): Promise<{ url?: string; error?: string }> {
  const file = formData.get("logoFile");
  if (!(file instanceof File) || file.size === 0) return {};
  const result = await uploadCompanyLogo(file);
  return result.ok ? { url: result.url } : { error: result.error };
}

export type CompanyFormState = { error: string } | null;

/** Wizard A2–A6 · Nova empresa. */
export async function createCompanyAction(
  _prev: CompanyFormState,
  formData: FormData
): Promise<CompanyFormState> {
  await requireAdmin();
  const parsed = createCompanySchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const logo = await resolveLogoUrl(formData);
  if (logo.error) return { error: logo.error };
  if (logo.url) parsed.data.logoUrl = logo.url;
  const result = await createCompanyWithManager(parsed.data);
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/empresas");
  redirect("/admin/empresas");
}

/** A7 · Editar empresa (abas). */
export async function updateCompanyAction(
  companyId: string,
  _prev: CompanyFormState,
  formData: FormData
): Promise<CompanyFormState> {
  await requireAdmin();
  const entries = Object.fromEntries(formData.entries());
  delete entries.logoFile; // arquivo tratado à parte
  const parsed = updateCompanySchema.safeParse(entries);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const logo = await resolveLogoUrl(formData);
  if (logo.error) return { error: logo.error };
  if (logo.url) parsed.data.logoUrl = logo.url;
  const result = await updateCompanyForAdmin(companyId, parsed.data);
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/empresas");
  revalidatePath(`/admin/empresas/${companyId}`);
  return null;
}

/** A7 · Redefine a senha do gestor do cliente (suporte). */
export async function resetManagerPasswordAction(
  companyId: string,
  _prev: CompanyFormState,
  formData: FormData
): Promise<CompanyFormState> {
  await requireAdmin();
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    return { error: "A senha temporária precisa de 8+ caracteres." };
  }
  const result = await resetManagerPassword(companyId, password);
  if (!result.ok) return { error: result.error };
  return null;
}

/** Ativar/suspender empresa (menu ⋯ da A1). */
export async function setCompanyActiveAction(
  companyId: string,
  isActive: boolean
): Promise<void> {
  await requireAdmin();
  await setCompanyActive(companyId, isActive);
  revalidatePath("/admin/empresas");
  revalidatePath(`/admin/empresas/${companyId}`);
}
