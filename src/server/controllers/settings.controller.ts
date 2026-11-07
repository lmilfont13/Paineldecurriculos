"use server";

import { runModelTrial, type ModelTrialResult } from "@/server/services/model-trial.service";
import { getSessionUser, isAdmin, isManager } from "@/server/services/auth.service";
import { isPrimaryCompanyAdmin } from "@/server/services/user.service";
import {
  setActiveRadioStation,
  type RadioStationConfig,
  getActiveRadioPlaylist,
  setActiveRadioPlaylist,
  getMusicCatalog,
} from "@/server/services/message-template.service";
import type { RadioTrack } from "@/server/models/radio.model";
import { isCandidateAiRadarEnabled, setCandidateAiRadarEnabled } from "@/server/services/company-feature.service";
import { revalidatePath } from "next/cache";

import { AI_MODEL_OPTIONS, parseAiModelChoice } from "@/server/models/ai-model.model";
import { requireManager } from "@/server/controllers/guards";
import { careersPageSchema, emailSettingsSchema } from "@/server/models/company.model";
import { createAuditLog } from "@/server/repositories/audit.repository";
import type { EmailOutcome } from "@/server/models/communication.model";
import { emailSenderStatus, sendTestEmail } from "@/server/services/email.service";
import {
  getCompanyById,
  updateCareersPage,
  updateAiModel,
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

export type TestEmailResult =
  | { ok: true; outcome: EmailOutcome; to: string }
  | { error: string };

/** Envia um e-mail de teste ao e-mail da empresa, com o remetente configurado. */
export async function sendTestEmailAction(): Promise<TestEmailResult> {
  const user = await requireManager();
  const company = await getCompanyById(user.companyId);
  if (!company) return { error: "Empresa não encontrada." };
  const outcome = await sendTestEmail(
    {
      name: company.name,
      slug: company.slug,
      primaryColor: company.primaryColor,
      logoUrl: company.logoUrl,
      senderEmail: company.senderEmail,
    },
    company.email
  );
  return { ok: true, outcome, to: company.email };
}

/** Configurações · IA: o modelo escolhido e quais estão disponíveis neste servidor. */
export async function getAiSettingsAction() {
  const user = await requireManager();
  const company = await getCompanyById(user.companyId);
  if (!company) return null;
  const claudeReady = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  return {
    current: parseAiModelChoice(company.aiModel) ?? "",
    options: AI_MODEL_OPTIONS.map((o) => ({
      ...o,
      available: o.provider === "groq" ? Boolean(process.env.GROQ_API_KEY?.trim()) : claudeReady,
    })),
  };
}

/** Configurações · IA: salva o modelo que analisa os candidatos da empresa. */
export async function updateAiModelAction(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const user = await requireManager();
  const raw = String(formData.get("aiModel") ?? "");
  const choice = parseAiModelChoice(raw);
  if (raw && !choice) return { error: "Modelo inválido." };
  await updateAiModel(user.companyId, choice);
  try {
    await createAuditLog({
      companyId: user.companyId,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "CONFIGURACOES_ATUALIZADAS",
      entityType: "EMPRESA",
      metadata: { campos: ["aiModel"], aiModel: choice },
    });
  } catch { /* auditoria nunca bloqueia a ação principal */ }
  revalidatePath("/configuracoes/ia");
  return { ok: true };
}

/**
 * Teste de modelo de IA: compara o modelo atual com outro nos últimos
 * candidatos da empresa, sem gravar nada. Só gestor (empresa da sessão).
 */
export async function runModelTrialAction(candidateModel: string): Promise<ModelTrialResult> {
  const user = await requireManager();
  return runModelTrial(user.companyId, String(candidateModel ?? ""));
}

/** Define a rádio ativa: permitido apenas para o Admin da plataforma ou Admin principal da empresa. */
export async function saveRadioStationAction(station: RadioStationConfig): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  if (!user) return { ok: false };
  if (isAdmin(user)) {
    const res = await setActiveRadioStation(null, station);
    revalidatePath("/", "layout");
    return res;
  }
  if (isManager(user)) {
    const res = await setActiveRadioStation(user.companyId, station);
    revalidatePath("/", "layout");
    return res;
  }
  return { ok: false };
}

/** Lê o catálogo de músicas disponíveis (da pasta local e padrão). */
export async function getMusicCatalogAction(): Promise<RadioTrack[]> {
  return getMusicCatalog();
}

/** Lê a playlist / fila ativa da Rádio Tarhget. */
export async function getRadioPlaylistAction(): Promise<RadioTrack[]> {
  const user = await getSessionUser();
  const companyId = user && !isAdmin(user) ? user.companyId : null;
  return getActiveRadioPlaylist(companyId);
}

/** Salva a playlist / fila personalizada da Rádio Tarhget. */
export async function saveRadioPlaylistAction(tracks: RadioTrack[]): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  if (!user) return { ok: false };
  if (isAdmin(user)) {
    const res = await setActiveRadioPlaylist(null, tracks);
    revalidatePath("/", "layout");
    return res;
  }
  if (isManager(user)) {
    const res = await setActiveRadioPlaylist(user.companyId, tracks);
    revalidatePath("/", "layout");
    return res;
  }
  return { ok: false };
}


/** Configurações · Lê se a central de IA na área do candidato está ativada. */
export async function getCandidateAiRadarAction(): Promise<boolean> {
  const user = await requireManager();
  return isCandidateAiRadarEnabled(user.companyId);
}

/** Configurações · Alterna a exibição da central de IA na área do candidato (gestor). */
export async function toggleCandidateAiRadarAction(enabled: boolean): Promise<{ ok: boolean }> {
  const user = await requireManager();
  await setCandidateAiRadarEnabled(user.companyId, enabled);
  try {
    await createAuditLog({
      companyId: user.companyId,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "CONFIGURACOES_ATUALIZADAS",
      entityType: "EMPRESA",
      metadata: { campo: "candidateAiRadarEnabled", enabled },
    });
  } catch {}
  revalidatePath("/configuracoes/ia");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Super Admin · Alterna a exibição da central de IA para qualquer empresa. */
export async function toggleCompanyCandidateAiRadarAction(
  companyId: string,
  enabled: boolean
): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  if (!user || (!isAdmin(user) && user.companyId !== companyId)) {
    return { ok: false };
  }
  await setCandidateAiRadarEnabled(companyId, enabled);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Super Admin · Alterna templates de WhatsApp rápidos para qualquer empresa. */
export async function toggleCompanyWhatsappTemplatesAction(
  companyId: string,
  enabled: boolean
): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  if (!user || (!isAdmin(user) && user.companyId !== companyId)) {
    return { ok: false };
  }
  const { setWhatsappTemplatesEnabled } = await import("@/server/services/company-feature.service");
  await setWhatsappTemplatesEnabled(companyId, enabled);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Super Admin · Alterna Command Palette (Ctrl+K) para qualquer empresa. */
export async function toggleCompanyCommandPaletteAction(
  companyId: string,
  enabled: boolean
): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  if (!user || (!isAdmin(user) && user.companyId !== companyId)) {
    return { ok: false };
  }
  const { setCommandPaletteEnabled } = await import("@/server/services/company-feature.service");
  await setCommandPaletteEnabled(companyId, enabled);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Super Admin · Alterna Linha do Tempo no Portal do Candidato. */
export async function toggleCompanyCandidateTimelineAction(
  companyId: string,
  enabled: boolean
): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  if (!user || (!isAdmin(user) && user.companyId !== companyId)) {
    return { ok: false };
  }
  const { setCandidateTimelineEnabled } = await import("@/server/services/company-feature.service");
  await setCandidateTimelineEnabled(companyId, enabled);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Super Admin · Alterna Ação de Desfazer (Undo) no Funil. */
export async function toggleCompanyUndoActionAction(
  companyId: string,
  enabled: boolean
): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  if (!user || (!isAdmin(user) && user.companyId !== companyId)) {
    return { ok: false };
  }
  const { setUndoActionEnabled } = await import("@/server/services/company-feature.service");
  await setUndoActionEnabled(companyId, enabled);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Super Admin · Alterna Cards Sociais Dinâmicos (Open Graph). */
export async function toggleCompanyDynamicOgAction(
  companyId: string,
  enabled: boolean
): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  if (!user || (!isAdmin(user) && user.companyId !== companyId)) {
    return { ok: false };
  }
  const { setDynamicOgEnabled } = await import("@/server/services/company-feature.service");
  await setDynamicOgEnabled(companyId, enabled);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Super Admin · Alterna Notificações Sonoras para o Gestor. */
export async function toggleCompanySoundNotificationsAction(
  companyId: string,
  enabled: boolean
): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  if (!user || (!isAdmin(user) && user.companyId !== companyId)) {
    return { ok: false };
  }
  const { setSoundNotificationsEnabled } = await import("@/server/services/company-feature.service");
  await setSoundNotificationsEnabled(companyId, enabled);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Super Admin · Alterna Spots e Vinhetas da Target na Rádio. */
export async function toggleCompanyTargetRadioSpotsAction(
  companyId: string,
  enabled: boolean
): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  if (!user || (!isAdmin(user) && user.companyId !== companyId)) {
    return { ok: false };
  }
  const { setTargetRadioSpotsEnabled } = await import("@/server/services/company-feature.service");
  await setTargetRadioSpotsEnabled(companyId, enabled);
  revalidatePath("/", "layout");
  return { ok: true };
}


