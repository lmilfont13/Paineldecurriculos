"use server";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/server/controllers/guards";
import { careersPageSchema, emailSettingsSchema } from "@/server/models/company.model";
import { createAuditLog } from "@/server/repositories/audit.repository";
import { emailSenderStatus } from "@/server/services/email.service";
import {
  getCompanyById,
  updateCareersPage,
  updateEmailSettings,
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
  try {
    await createAuditLog({
      companyId: user.companyId,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "CONFIGURACOES_ATUALIZADAS",
      entityType: "EMPRESA",
      metadata: {
        campos: Object.keys(parsed.data),
        logoAlterada: !!(mark.url || full.url),
      },
    });
  } catch { /* auditoria nunca bloqueia a ação principal */ }
  // A marca aparece em todas as telas (públicas e do painel).
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Dados da tela "E-mails do sistema": respostas, remetente e se o envio está em modo de teste. */
export async function getEmailSettingsAction() {
  const user = await requireManager();
  const company = await getCompanyById(user.companyId);
  if (!company) return null;
  const status = emailSenderStatus(company.senderEmail);
  return {
    email: company.email,
    senderEmail: company.senderEmail ?? "",
    effectiveSender: status.address,
    sandbox: status.sandbox,
  };
}

/** Configurações · E-mails do sistema (respostas dos candidatos e remetente). */
export async function updateEmailSettingsAction(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const user = await requireManager();
  const parsed = emailSettingsSchema.safeParse({
    email: formData.get("email") ?? "",
    senderEmail: formData.get("senderEmail") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  await updateEmailSettings(user.companyId, parsed.data);
  try {
    await createAuditLog({
      companyId: user.companyId,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "CONFIGURACOES_ATUALIZADAS",
      entityType: "EMPRESA",
      metadata: { campos: ["email", "senderEmail"] },
    });
  } catch { /* auditoria nunca bloqueia a ação principal */ }
  revalidatePath("/configuracoes/usuarios");
  return { ok: true };
}
