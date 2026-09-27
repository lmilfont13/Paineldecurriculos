"use server";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/server/controllers/guards";
import { careersPageSchema } from "@/server/models/company.model";
import {
  updateCareersPage,
  uploadCompanyLogo,
} from "@/server/services/company.service";

export type SettingsState = { error: string } | { ok: true } | null;

async function uploadIfPresent(
  file: FormDataEntryValue | null
): Promise<{ url?: string; error?: string }> {
  if (!(file instanceof File) || file.size === 0) return {};
  const result = await uploadCompanyLogo(file);
  return result.ok ? { url: result.url } : { error: result.error };
}

/** Configurações · Página de carreiras, editada pelo próprio dono. */
export async function updateCareersPageAction(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const user = await requireManager();
  const parsed = careersPageSchema.safeParse({
    name: formData.get("name"),
    heroTitle: formData.get("heroTitle"),
    heroSubtitle: formData.get("heroSubtitle"),
    aboutText: formData.get("aboutText") ?? "",
    primaryColor: formData.get("primaryColor"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const [mark, full] = await Promise.all([
    uploadIfPresent(formData.get("logoFile")),
    uploadIfPresent(formData.get("logoFullFile")),
  ]);
  if (mark.error || full.error) return { error: mark.error ?? full.error! };

  await updateCareersPage(user.companyId, {
    ...parsed.data,
    logoUrl: mark.url,
    logoFullUrl: full.url,
  });
  // A marca aparece em todas as telas (públicas e do painel).
  revalidatePath("/", "layout");
  return { ok: true };
}
