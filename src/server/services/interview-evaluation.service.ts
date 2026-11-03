import "server-only";

import {
  averageScore,
  evaluationInputSchema,
  isRecommendation,
  readCriteria,
  type EvaluationCriterion,
  type Recommendation,
} from "@/server/models/interview-evaluation.model";
import {
  findInterviewEvaluations,
  upsertInterviewEvaluation,
} from "@/server/repositories/interview-evaluation.repository";
import { getCompanyApplication } from "@/server/services/application.service";

export type InterviewEvaluationView = {
  id: string;
  evaluatorId: string;
  evaluatorName: string | null;
  evaluatorEmail: string;
  criteria: EvaluationCriterion[];
  recommendation: Recommendation | null;
  summary: string;
  average: number | null;
  updatedAt: string;
};

function toView(row: Awaited<ReturnType<typeof findInterviewEvaluations>>[number]): InterviewEvaluationView {
  const criteria = readCriteria(row.criteria);
  return {
    id: row.id,
    evaluatorId: row.evaluatorId,
    evaluatorName: row.evaluatorName,
    evaluatorEmail: row.evaluatorEmail,
    criteria,
    recommendation: isRecommendation(row.recommendation) ? row.recommendation : null,
    summary: row.summary ?? "",
    average: averageScore(criteria),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listInterviewEvaluations(companyId: string, applicationId: string) {
  return (await findInterviewEvaluations(companyId, applicationId)).map(toView);
}

/**
 * Salva a ficha de quem está logado (uma por avaliador, editável). Só para
 * candidatura da empresa (regra 1). Não muda etapa nem passa pela IA.
 */
export async function saveInterviewEvaluation(
  companyId: string,
  evaluator: { id: string; email: string; name: string | null },
  applicationId: string,
  raw: unknown
): Promise<{ ok: true; evaluation: InterviewEvaluationView } | { ok: false; error: string }> {
  const parsed = evaluationInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const application = await getCompanyApplication(companyId, applicationId);
  if (!application) return { ok: false, error: "Candidatura não encontrada." };

  const { criteria, recommendation, summary } = parsed.data;
  if (!criteria.some((c) => c.score !== null) && !recommendation && !summary.trim()) {
    return { ok: false, error: "Dê ao menos uma nota, uma recomendação ou um comentário." };
  }
  const row = await upsertInterviewEvaluation({
    companyId,
    applicationId,
    evaluatorId: evaluator.id,
    evaluatorName: evaluator.name,
    evaluatorEmail: evaluator.email,
    criteria: criteria.map((c) => ({ name: c.name.trim(), score: c.score, note: c.note.trim() })),
    recommendation,
    summary: summary.trim() || null,
  });
  return { ok: true, evaluation: toView(row) };
}
