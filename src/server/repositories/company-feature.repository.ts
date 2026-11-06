import "server-only";

import { prisma } from "@/lib/prisma";

export const CANDIDATE_AI_RADAR_KEY = "__candidate_ai_radar__";

/**
 * Lê se o radar / central de IA está habilitado para a área do candidato na empresa.
 * Se ainda não foi configurado, o padrão é true (habilitado).
 */
export async function findCandidateAiRadarEnabled(companyId: string): Promise<boolean> {
  const row = await prisma.messageTemplate.findUnique({
    where: { companyId_subjectKey: { companyId, subjectKey: CANDIDATE_AI_RADAR_KEY } },
    select: { body: true },
  });
  if (!row) return true; // padrão: ativado
  return row.body === "true" || row.body === "1";
}

/**
 * Salva a preferência de exibição da central de IA na área do candidato.
 */
export async function saveCandidateAiRadarEnabled(companyId: string, enabled: boolean): Promise<void> {
  const val = enabled ? "true" : "false";
  await prisma.messageTemplate.upsert({
    where: { companyId_subjectKey: { companyId, subjectKey: CANDIDATE_AI_RADAR_KEY } },
    create: {
      companyId,
      subject: "Central de IA na Área do Candidato",
      subjectKey: CANDIDATE_AI_RADAR_KEY,
      body: val,
    },
    update: {
      body: val,
    },
  });
}
