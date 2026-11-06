import "server-only";

import {
  findCandidateAiRadarEnabled,
  saveCandidateAiRadarEnabled,
} from "@/server/repositories/company-feature.repository";

export function isCandidateAiRadarEnabled(companyId: string): Promise<boolean> {
  return findCandidateAiRadarEnabled(companyId);
}

export function setCandidateAiRadarEnabled(companyId: string, enabled: boolean): Promise<void> {
  return saveCandidateAiRadarEnabled(companyId, enabled);
}
