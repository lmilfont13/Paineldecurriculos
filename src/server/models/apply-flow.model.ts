import { domesticPhoneError, formatPhone } from "@/lib/phone";
import {
  CLT_AWARENESS_REQUIRED_MESSAGE,
  TEMPORARY_JOB_AWARENESS_REQUIRED_MESSAGE,
} from "./consent.model";
import type { CandidateProfile } from "./candidate.model";
import { parseInstagram } from "./instagram.model";

/** Só oferece o atalho quando há candidatura anterior e perfil reutilizável. */
export function canReuseApplicationProfile(
  candidate: Pick<CandidateProfile, "name" | "phone" | "resumeUrl" | "instagram">,
  hasPreviousApplication: boolean,
): boolean {
  return hasPreviousApplication && Boolean(candidate.resumeUrl) &&
    candidate.name.trim().length >= 2 && !domesticPhoneError(formatPhone(candidate.phone), { mobile: true }) &&
    !("error" in parseInstagram(candidate.instagram ?? ""));
}

/** Não pula perguntas configuradas, mesmo quando o perfil é reutilizado. */
export function nextApplyStep(step: number, reuseProfile: boolean, hasCoreQuestions: boolean): number {
  if (step === 0 && reuseProfile && !hasCoreQuestions) return 2;
  return Math.min(step + 1, 3);
}

export function previousApplyStep(step: number, reuseProfile: boolean, hasCoreQuestions: boolean): number {
  if (step === 2 && reuseProfile && !hasCoreQuestions) return 0;
  return Math.max(step - 1, 0);
}

/** Reutilizar o currículo não equivale a aceitar as condições desta vaga. */
export function applicationAwarenessError(cltAware: boolean, isTemporary: boolean, temporaryAware: boolean): string | null {
  if (!cltAware) return CLT_AWARENESS_REQUIRED_MESSAGE;
  if (isTemporary && !temporaryAware) return TEMPORARY_JOB_AWARENESS_REQUIRED_MESSAGE;
  return null;
}
