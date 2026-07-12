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
  setCompanyActive,
  updateCompanyForAdmin,
} from "@/server/services/company-admin.service";

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
  const parsed = updateCompanySchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const result = await updateCompanyForAdmin(companyId, parsed.data);
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/empresas");
  revalidatePath(`/admin/empresas/${companyId}`);
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
