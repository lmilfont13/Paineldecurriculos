import "server-only";

import {
  findCandidateAiRadarEnabled,
  saveCandidateAiRadarEnabled,
  findWhatsappTemplatesEnabled,
  saveWhatsappTemplatesEnabled,
  findCommandPaletteEnabled,
  saveCommandPaletteEnabled,
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


