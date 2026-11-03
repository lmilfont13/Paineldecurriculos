import { describe, expect, it } from "vitest";

import {
  averageScore,
  evaluationInputSchema,
  readCriteria,
  showInterviewEvaluation,
  suggestedCriteria,
} from "@/server/models/interview-evaluation.model";

describe("ficha de avaliação da entrevista", () => {
  it("sugere os critérios da vaga primeiro, depois os de comportamento, sem repetir", () => {
    expect(suggestedCriteria(["Vendas", "comunicação"])).toEqual([
      "Vendas",
      "comunicação",
      "Experiência na função",
      "Postura e atendimento",
      "Disponibilidade e logística",
    ]);
    expect(suggestedCriteria(null)).toHaveLength(4);
  });

  it("média ignora critério sem nota", () => {
    expect(
      averageScore([
        { name: "A", score: 5, note: "" },
        { name: "B", score: 4, note: "" },
        { name: "C", score: null, note: "" },
      ])
    ).toBe(4.5);
    expect(averageScore([{ name: "A", score: null, note: "" }])).toBeNull();
  });

  it("lê JSON gravado com tolerância", () => {
    expect(readCriteria([{ name: "A", score: 9 }, { name: "" }, null, { name: "B", score: 3, note: "ok" }])).toEqual([
      { name: "A", score: null, note: "" },
      { name: "B", score: 3, note: "ok" },
    ]);
    expect(readCriteria("x")).toEqual([]);
  });

  it("valida nota de 1 a 5 e recomendação conhecida", () => {
    const ok = evaluationInputSchema.safeParse({
      criteria: [{ name: "Comunicação", score: 4, note: "" }],
      recommendation: "YES",
      summary: "",
    });
    expect(ok.success).toBe(true);
    expect(evaluationInputSchema.safeParse({ criteria: [{ name: "X", score: 6, note: "" }], recommendation: null }).success).toBe(false);
    expect(evaluationInputSchema.safeParse({ criteria: [], recommendation: null }).success).toBe(false);
    expect(evaluationInputSchema.safeParse({ criteria: [{ name: "X", score: 3 }], recommendation: "TALVEZ" }).success).toBe(false);
  });

  it("aparece só quando há entrevista ou avaliação", () => {
    expect(showInterviewEvaluation({ status: "PENDING", interviewAt: null, hasEvaluations: false })).toBe(false);
    expect(showInterviewEvaluation({ status: "REJECTED", interviewAt: null, hasEvaluations: false })).toBe(false);
    expect(showInterviewEvaluation({ status: "INTERVIEW", interviewAt: null, hasEvaluations: false })).toBe(true);
    expect(showInterviewEvaluation({ status: "REJECTED", interviewAt: new Date(), hasEvaluations: false })).toBe(true);
    expect(showInterviewEvaluation({ status: "PENDING", interviewAt: null, hasEvaluations: true })).toBe(true);
  });
});
