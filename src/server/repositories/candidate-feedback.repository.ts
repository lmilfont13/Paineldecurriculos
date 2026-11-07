import "server-only";

import { prisma } from "@/lib/prisma";
import type { CandidateFeedbackRecord } from "@/server/models/candidate-feedback.model";

export const CANDIDATE_FEEDBACK_KEY = "__candidate_feedback_store__";
const MAX_STORED_FEEDBACKS = 250;

/**
 * Lê a lista de feedbacks gravados para a empresa.
 */
export async function findCandidateFeedbacksRaw(
  companyId: string
): Promise<CandidateFeedbackRecord[]> {
  try {
    const row = await prisma.messageTemplate.findUnique({
      where: { companyId_subjectKey: { companyId, subjectKey: CANDIDATE_FEEDBACK_KEY } },
      select: { body: true },
    });
    if (!row?.body) return [];
    const parsed = JSON.parse(row.body);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Adiciona um novo feedback de candidato na lista persistida da empresa.
 */
export async function saveCandidateFeedbackRaw(
  companyId: string,
  record: CandidateFeedbackRecord
): Promise<CandidateFeedbackRecord[]> {
  const current = await findCandidateFeedbacksRaw(companyId);
  const updated = [...current, record].slice(-MAX_STORED_FEEDBACKS);

  const json = JSON.stringify(updated);
  await prisma.messageTemplate.upsert({
    where: { companyId_subjectKey: { companyId, subjectKey: CANDIDATE_FEEDBACK_KEY } },
    create: {
      companyId,
      subject: "Feedback e Satisfação dos Candidatos",
      subjectKey: CANDIDATE_FEEDBACK_KEY,
      body: json,
      useCount: updated.length,
    },
    update: {
      body: json,
      useCount: updated.length,
    },
  });

  return updated;
}
