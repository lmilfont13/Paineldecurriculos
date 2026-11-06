import "server-only";

import {
  findCandidateAiRadarEnabled,
  saveCandidateAiRadarEnabled,
  findWhatsappTemplatesEnabled,
  saveWhatsappTemplatesEnabled,
  findCommandPaletteEnabled,
  saveCommandPaletteEnabled,
  findCandidateTimelineEnabled,
  saveCandidateTimelineEnabled,
  findUndoActionEnabled,
  saveUndoActionEnabled,
  findDynamicOgEnabled,
  saveDynamicOgEnabled,
  findSoundNotificationsEnabled,
  saveSoundNotificationsEnabled,
} from "@/server/repositories/company-feature.repository";

export function isCandidateAiRadarEnabled(companyId: string): Promise<boolean> {
  return findCandidateAiRadarEnabled(companyId);
}

export function setCandidateAiRadarEnabled(companyId: string, enabled: boolean): Promise<void> {
  return saveCandidateAiRadarEnabled(companyId, enabled);
}

export function isWhatsappTemplatesEnabled(companyId: string): Promise<boolean> {
  return findWhatsappTemplatesEnabled(companyId);
}

export function setWhatsappTemplatesEnabled(companyId: string, enabled: boolean): Promise<void> {
  return saveWhatsappTemplatesEnabled(companyId, enabled);
}

export function isCommandPaletteEnabled(companyId: string): Promise<boolean> {
  return findCommandPaletteEnabled(companyId);
}

export function setCommandPaletteEnabled(companyId: string, enabled: boolean): Promise<void> {
  return saveCommandPaletteEnabled(companyId, enabled);
}

export function isCandidateTimelineEnabled(companyId: string): Promise<boolean> {
  return findCandidateTimelineEnabled(companyId);
}

export function setCandidateTimelineEnabled(companyId: string, enabled: boolean): Promise<void> {
  return saveCandidateTimelineEnabled(companyId, enabled);
}

export function isUndoActionEnabled(companyId: string): Promise<boolean> {
  return findUndoActionEnabled(companyId);
}

export function setUndoActionEnabled(companyId: string, enabled: boolean): Promise<void> {
  return saveUndoActionEnabled(companyId, enabled);
}

export function isDynamicOgEnabled(companyId: string): Promise<boolean> {
  return findDynamicOgEnabled(companyId);
}

export function setDynamicOgEnabled(companyId: string, enabled: boolean): Promise<void> {
  return saveDynamicOgEnabled(companyId, enabled);
}

export function isSoundNotificationsEnabled(companyId: string): Promise<boolean> {
  return findSoundNotificationsEnabled(companyId);
}

export function setSoundNotificationsEnabled(companyId: string, enabled: boolean): Promise<void> {
  return saveSoundNotificationsEnabled(companyId, enabled);
}



