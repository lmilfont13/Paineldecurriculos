import "server-only";

import { prisma } from "@/lib/prisma";

export const CANDIDATE_AI_RADAR_KEY = "__candidate_ai_radar__";
export const WHATSAPP_TEMPLATES_KEY = "__feature_whatsapp_templates__";
export const COMMAND_PALETTE_KEY = "__feature_command_palette__";
export const CANDIDATE_TIMELINE_KEY = "__feature_candidate_timeline__";
export const UNDO_ACTION_KEY = "__feature_undo_action__";
export const DYNAMIC_OG_KEY = "__feature_dynamic_og__";
export const SOUND_NOTIFICATIONS_KEY = "__feature_sound_notifications__";

/**
 * Lê se uma determinada feature flag está habilitada para a empresa.
 * Se ainda não foi configurada, utiliza defaultValue (padrão: true).
 */
export async function findCompanyFeatureEnabled(
  companyId: string,
  featureKey: string,
  defaultValue = true
): Promise<boolean> {
  const row = await prisma.messageTemplate.findUnique({
    where: { companyId_subjectKey: { companyId, subjectKey: featureKey } },
    select: { body: true },
  });
  if (!row) return defaultValue;
  return row.body === "true" || row.body === "1";
}

/**
 * Salva a preferência de uma feature flag para a empresa.
 */
export async function saveCompanyFeatureEnabled(
  companyId: string,
  featureKey: string,
  subjectTitle: string,
  enabled: boolean
): Promise<void> {
  const val = enabled ? "true" : "false";
  await prisma.messageTemplate.upsert({
    where: { companyId_subjectKey: { companyId, subjectKey: featureKey } },
    create: {
      companyId,
      subject: subjectTitle,
      subjectKey: featureKey,
      body: val,
    },
    update: {
      body: val,
    },
  });
}

/** Lê se o radar / central de IA está habilitado para a área do candidato. */
export function findCandidateAiRadarEnabled(companyId: string): Promise<boolean> {
  return findCompanyFeatureEnabled(companyId, CANDIDATE_AI_RADAR_KEY, true);
}

/** Salva preferência da central de IA na área do candidato. */
export function saveCandidateAiRadarEnabled(companyId: string, enabled: boolean): Promise<void> {
  return saveCompanyFeatureEnabled(companyId, CANDIDATE_AI_RADAR_KEY, "Central de IA na Área do Candidato", enabled);
}

/** Lê se os templates de WhatsApp rápidos com 1 clique estão habilitados. */
export function findWhatsappTemplatesEnabled(companyId: string): Promise<boolean> {
  return findCompanyFeatureEnabled(companyId, WHATSAPP_TEMPLATES_KEY, true);
}

/** Salva preferência dos templates rápidos de WhatsApp. */
export function saveWhatsappTemplatesEnabled(companyId: string, enabled: boolean): Promise<void> {
  return saveCompanyFeatureEnabled(companyId, WHATSAPP_TEMPLATES_KEY, "Templates de WhatsApp com 1 Clique", enabled);
}

/** Lê se o Command Palette (Ctrl+K) está habilitado. */
export function findCommandPaletteEnabled(companyId: string): Promise<boolean> {
  return findCompanyFeatureEnabled(companyId, COMMAND_PALETTE_KEY, true);
}

/** Salva preferência do Command Palette (Ctrl+K). */
export function saveCommandPaletteEnabled(companyId: string, enabled: boolean): Promise<void> {
  return saveCompanyFeatureEnabled(companyId, COMMAND_PALETTE_KEY, "Command Palette (Ctrl+K)", enabled);
}

/** Lê se a linha do tempo do candidato está habilitada. */
export function findCandidateTimelineEnabled(companyId: string): Promise<boolean> {
  return findCompanyFeatureEnabled(companyId, CANDIDATE_TIMELINE_KEY, true);
}

/** Salva preferência da linha do tempo do candidato. */
export function saveCandidateTimelineEnabled(companyId: string, enabled: boolean): Promise<void> {
  return saveCompanyFeatureEnabled(companyId, CANDIDATE_TIMELINE_KEY, "Linha do Tempo no Portal do Candidato", enabled);
}

/** Lê se o botão de desfazer (Undo) no funil está habilitado. */
export function findUndoActionEnabled(companyId: string): Promise<boolean> {
  return findCompanyFeatureEnabled(companyId, UNDO_ACTION_KEY, true);
}

/** Salva preferência do botão de desfazer no funil. */
export function saveUndoActionEnabled(companyId: string, enabled: boolean): Promise<void> {
  return saveCompanyFeatureEnabled(companyId, UNDO_ACTION_KEY, "Ação de Desfazer (Undo) no Funil", enabled);
}

/** Lê se cards sociais dinâmicos estão habilitados. */
export function findDynamicOgEnabled(companyId: string): Promise<boolean> {
  return findCompanyFeatureEnabled(companyId, DYNAMIC_OG_KEY, true);
}

/** Salva preferência de cards sociais dinâmicos. */
export function saveDynamicOgEnabled(companyId: string, enabled: boolean): Promise<void> {
  return saveCompanyFeatureEnabled(companyId, DYNAMIC_OG_KEY, "Cards Sociais Dinâmicos (Open Graph)", enabled);
}

/** Lê se notificações sonoras de novas candidaturas estão habilitadas. */
export function findSoundNotificationsEnabled(companyId: string): Promise<boolean> {
  return findCompanyFeatureEnabled(companyId, SOUND_NOTIFICATIONS_KEY, true);
}

/** Salva preferência de notificações sonoras. */
export function saveSoundNotificationsEnabled(companyId: string, enabled: boolean): Promise<void> {
  return saveCompanyFeatureEnabled(companyId, SOUND_NOTIFICATIONS_KEY, "Notificações Sonoras para o Gestor", enabled);
}



