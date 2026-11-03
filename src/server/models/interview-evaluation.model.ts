/**
 * Ficha de avaliação da entrevista: o que quem entrevistou achou, critério a
 * critério. Funções puras e schema (sem I/O).
 *
 * Interna: nunca aparece para o candidato, não vai para a IA e não muda a
 * etapa — a decisão continua manual (regras 2 e 3).
 */
import { z } from "zod";

/** Critérios de comportamento que valem para qualquer entrevista. */
export const DEFAULT_INTERVIEW_CRITERIA = [
  "Comunicação",
  "Experiência na função",
  "Postura e atendimento",
  "Disponibilidade e logística",
] as const;

export const MAX_CRITERIA = 10;
export const MAX_NOTE = 500;
export const MAX_SUMMARY = 2000;

export const RECOMMENDATIONS = ["STRONG_YES", "YES", "MAYBE", "NO"] as const;
export type Recommendation = (typeof RECOMMENDATIONS)[number];

export const recommendationLabels: Record<Recommendation, string> = {
  STRONG_YES: "Contrataria com certeza",
  YES: "Recomendo",
  MAYBE: "Tenho dúvidas",
  NO: "Não recomendo",
};

export const scoreLabels: Record<number, string> = {
  1: "Fraco",
  2: "Abaixo do esperado",
  3: "Atende",
  4: "Bom",
  5: "Excelente",
};

export type EvaluationCriterion = { name: string; score: number | null; note: string };

export const evaluationInputSchema = z.object({
  criteria: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Dê um nome ao critério.").max(80),
        score: z.number().int().min(1).max(5).nullable(),
        note: z.string().max(MAX_NOTE).default(""),
      })
    )
    .min(1, "Avalie pelo menos um critério.")
    .max(MAX_CRITERIA, `No máximo ${MAX_CRITERIA} critérios.`),
  recommendation: z.enum(RECOMMENDATIONS).nullable(),
  summary: z.string().max(MAX_SUMMARY).default(""),
});
export type EvaluationInput = z.infer<typeof evaluationInputSchema>;

/**
 * Critérios sugeridos para a ficha: os que a vaga pede (os mesmos que orientam
 * a IA na triagem) seguidos dos de comportamento, sem repetir.
 */
export function suggestedCriteria(jobCriteria: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...(jobCriteria ?? []), ...DEFAULT_INTERVIEW_CRITERIA]) {
    const name = raw.trim();
    const key = name.toLocaleLowerCase("pt-BR");
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= 8) break;
  }
  return out;
}

/** Lê os critérios gravados (JSON) com tolerância a dado antigo/mal formado. */
export function readCriteria(value: unknown): EvaluationCriterion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      const score = typeof o.score === "number" && o.score >= 1 && o.score <= 5 ? Math.round(o.score) : null;
      return { name: String(o.name ?? "").trim(), score, note: String(o.note ?? "") };
    })
    .filter((c) => c.name);
}

/** Média das notas dadas (ignora critérios sem nota). null se nenhum tem nota. */
export function averageScore(criteria: EvaluationCriterion[]): number | null {
  const scored = criteria.map((c) => c.score).filter((s): s is number => s !== null);
  if (scored.length === 0) return null;
  return Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10;
}

export function isRecommendation(value: unknown): value is Recommendation {
  return typeof value === "string" && (RECOMMENDATIONS as readonly string[]).includes(value);
}

/** A ficha faz sentido quando há (ou houve) entrevista — ou já existe avaliação. */
export function showInterviewEvaluation(params: {
  status: string;
  interviewAt: Date | string | null;
  hasEvaluations: boolean;
}): boolean {
  return (
    params.hasEvaluations ||
    Boolean(params.interviewAt) ||
    params.status === "INTERVIEW" ||
    params.status === "APPROVED"
  );
}
