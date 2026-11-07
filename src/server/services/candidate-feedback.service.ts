import "server-only";

import {
  calculateSentimentSummary,
  type CandidateFeedbackInput,
  type CandidateFeedbackRecord,
  type CandidateSentimentSummary,
} from "@/server/models/candidate-feedback.model";
import {
  findCandidateFeedbacksRaw,
  saveCandidateFeedbackRaw,
} from "@/server/repositories/candidate-feedback.repository";
import { prisma } from "@/lib/prisma";

async function resolveCompanyId(companyIdOrSlug: string): Promise<string | null> {
  const company = await prisma.company.findFirst({
    where: {
      OR: [{ id: companyIdOrSlug }, { slug: companyIdOrSlug }],
    },
    select: { id: true },
  });
  return company?.id ?? null;
}

/**
 * Registra um novo feedback enviado pelo candidato no portal
 */
export async function submitCandidateFeedback(
  input: CandidateFeedbackInput
): Promise<CandidateSentimentSummary> {
  const companyId = await resolveCompanyId(input.slug);
  if (!companyId) {
    throw new Error(`Empresa não encontrada para o slug: ${input.slug}`);
  }

  const record: CandidateFeedbackRecord = {
    id: `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    emoji: input.emoji,
    comment: input.comment?.trim() || undefined,
    path: input.path?.trim() || undefined,
    candidateName: input.candidateName?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  const updatedRecords = await saveCandidateFeedbackRaw(companyId, record);
  return calculateSentimentSummary(updatedRecords);
}

/**
 * Retorna o resumo consolidado de satisfação dos candidatos da empresa
 */
export async function getCandidateSentimentSummary(
  companyIdOrSlug: string
): Promise<CandidateSentimentSummary> {
  const companyId = await resolveCompanyId(companyIdOrSlug);
  if (!companyId) {
    return calculateSentimentSummary([]);
  }

  const records = await findCandidateFeedbacksRaw(companyId);
  return calculateSentimentSummary(records);
}
