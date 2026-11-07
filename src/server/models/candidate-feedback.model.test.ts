import { describe, expect, it } from "vitest";
import {
  calculateSentimentSummary,
  candidateFeedbackInputSchema,
  type CandidateFeedbackRecord,
} from "./candidate-feedback.model";

describe("candidate-feedback.model", () => {
  it("valida schema de entrada com sucesso", () => {
    const valid = candidateFeedbackInputSchema.safeParse({
      slug: "acme",
      emoji: "love",
      comment: "Amei a experiência, muito rápido!",
      path: "/acme/vagas",
      candidateName: "Vanessa",
    });
    expect(valid.success).toBe(true);
  });

  it("rejeita emoji inválido", () => {
    const invalid = candidateFeedbackInputSchema.safeParse({
      slug: "acme",
      emoji: "angry",
    });
    expect(invalid.success).toBe(false);
  });

  it("calcula resumo vazio com valores padrão amigáveis", () => {
    const summary = calculateSentimentSummary([]);
    expect(summary.total).toBe(0);
    expect(summary.csatScore).toBe(100);
    expect(summary.satisfactionRate).toBe(100);
    expect(summary.counts.love).toBe(0);
    expect(summary.percentages.love).toBe(0);
  });

  it("calcula percentuais e CSAT ponderado corretamente", () => {
    const records: CandidateFeedbackRecord[] = [
      { id: "1", emoji: "love", createdAt: new Date().toISOString() }, // 100
      { id: "2", emoji: "love", createdAt: new Date().toISOString() }, // 100
      { id: "3", emoji: "happy", createdAt: new Date().toISOString() }, // 80
      { id: "4", emoji: "sad", comment: "Travou", createdAt: new Date().toISOString() }, // 0
    ];

    const summary = calculateSentimentSummary(records);
    expect(summary.total).toBe(4);
    expect(summary.counts.love).toBe(2);
    expect(summary.counts.happy).toBe(1);
    expect(summary.counts.sad).toBe(1);
    expect(summary.percentages.love).toBe(50);
    expect(summary.percentages.happy).toBe(25);
    expect(summary.percentages.sad).toBe(25);
    // (100 + 100 + 80 + 0) / 4 = 280 / 4 = 70
    expect(summary.csatScore).toBe(70);
    // (2 love + 1 happy) / 4 = 75%
    expect(summary.satisfactionRate).toBe(75);
    expect(summary.recentComments.length).toBe(1);
    expect(summary.recentComments[0]?.comment).toBe("Travou");
  });
});
