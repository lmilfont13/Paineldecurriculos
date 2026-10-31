import "server-only";

import { geminiGenerate } from "@/lib/gemini";
import { readChecklist } from "@/server/models/ai.model";
import {
  buildComparisonPrompt,
  computedRecommendation,
  parseComparison,
  type ComparisonCandidate,
} from "@/server/models/comparison.model";
import { criteriaCoverage, decisionIndex } from "@/server/models/report.model";
import { getCompanyApplication } from "@/server/services/application.service";

export type ComparisonOutcome =
  | {
      ok: true;
      /** "ia": escolha e motivos da IA. "numeros": a IA não respondeu, a sugestão é só pelos números. */
      source: "ia" | "numeros";
      recommendedId: string | null;
      confidence: "alta" | "media" | "baixa";
      summary: string;
      reasons: string[];
      checkNext: string;
      candidates: { id: string; name: string; strengths: string[]; concerns: string[]; whyNot: string }[];
    }
  | { ok: false; error: string };

const MAX_COMPARED = 3;
const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/**
 * Sugere qual dos 2 ou 3 candidatos escolher e por quê. A IA só sugere (não muda
 * nota nem etapa) e não recebe nome nem contatos. Se ela falhar, a tela ainda
 * recebe uma sugestão calculada dos números.
 */
export async function suggestComparison(
  companyId: string,
  applicationIds: string[]
): Promise<ComparisonOutcome> {
  const ids = [...new Set(applicationIds)].slice(0, MAX_COMPARED);
  const candidates: (ComparisonCandidate & { name: string })[] = [];
  // Sequencial: o banco usa uma conexão só.
  for (const id of ids) {
    const a = await getCompanyApplication(companyId, id);
    if (!a) continue;
    candidates.push({
      id: a.id,
      name: a.name,
      status: a.status,
      aiScore: a.aiScore,
      aiReasoning: a.aiReasoning,
      aiProfile: a.aiProfile,
      aiArea: a.aiArea,
      aiLevel: a.aiLevel,
      aiChecklist: a.aiChecklist,
      resumeText: a.resumeText,
      jobTitle: a.job.title,
      jobCode: a.job.code,
      jobRequirements: a.job.requirements,
      jobCriteria: a.job.aiCriteria,
      aiMinScore: a.job.aiMinScore,
    });
  }
  if (candidates.length < 2) {
    return { ok: false, error: "Escolha pelo menos 2 candidatos da sua empresa para comparar." };
  }

  const names = new Map(candidates.map((c) => [c.id, c.name]));
  const { system, prompt, labelToId } = buildComparisonPrompt(candidates);

  try {
    const raw = await geminiGenerate({ system, prompt, maxTokens: 1400, json: true });
    const parsed = parseComparison(raw, labelToId);
    if (parsed) {
      return {
        ok: true,
        source: "ia",
        recommendedId: parsed.recommendedId,
        confidence: parsed.confidence,
        summary: parsed.summary,
        reasons: parsed.reasons,
        checkNext: parsed.checkNext,
        candidates: candidates.map((c) => {
          const p = parsed.perCandidate.find((x) => x.id === c.id);
          return {
            id: c.id,
            name: c.name,
            strengths: p?.strengths ?? [],
            concerns: p?.concerns ?? [],
            whyNot: p?.whyNot ?? "",
          };
        }),
      };
    }
  } catch {
    // cai para a sugestão pelos números
  }

  const { recommendedId, margin } = computedRecommendation(candidates);
  const winner = candidates.find((c) => c.id === recommendedId);
  const reasons: string[] = [];
  if (winner) {
    const coverage = criteriaCoverage(readChecklist(winner.aiChecklist));
    reasons.push(`Nota da triagem ${winner.aiScore} (corte da vaga: ${winner.aiMinScore}).`);
    if (coverage !== null) reasons.push(`Cobre ${fmt(coverage)}% dos critérios da vaga.`);
    const index = decisionIndex(winner.aiScore, coverage);
    if (index !== null) reasons.push(`Índice de decisão ${fmt(index)}${margin !== null ? `, ${fmt(margin)} ponto(s) à frente do segundo` : ""}.`);
  }
  return {
    ok: true,
    source: "numeros",
    recommendedId,
    confidence: margin !== null && margin >= 10 ? "media" : "baixa",
    summary: winner
      ? `${winner.name} lidera pelos números. A IA não respondeu agora, então esta sugestão é só um cálculo.`
      : "Ainda não há candidatos com nota para comparar.",
    reasons,
    checkNext: "Confirme na entrevista os pontos que a triagem não conseguiu avaliar.",
    candidates: candidates.map((c) => ({ id: c.id, name: names.get(c.id) ?? c.name, strengths: [], concerns: [], whyNot: "" })),
  };
}
