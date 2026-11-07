import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  submitCandidateFeedback,
  getCandidateSentimentSummary,
} from "./candidate-feedback.service";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    company: {
      findFirst: vi.fn(async ({ where }) => {
        if (where.OR.some((w: any) => w.slug === "empresa-teste" || w.id === "empresa-teste")) {
          return { id: "comp_123" };
        }
        return null;
      }),
    },
  },
}));

vi.mock("@/server/repositories/candidate-feedback.repository", () => {
  let fakeFeedbacks: any[] = [];
  return {
    findCandidateFeedbacksRaw: vi.fn(async () => fakeFeedbacks),
    saveCandidateFeedbackRaw: vi.fn(async (_companyId: string, item: any) => {
      fakeFeedbacks = [...fakeFeedbacks, item];
      return fakeFeedbacks;
    }),
  };
});

describe("candidate-feedback.service", () => {
  it("salva feedback do candidato com sucesso e calcula métricas", async () => {
    const summary = await submitCandidateFeedback({
      slug: "empresa-teste",
      emoji: "love",
      comment: "Portal muito fluido!",
      candidateName: "Vanessa",
      path: "/empresa-teste/vagas",
    });

    expect(summary.total).toBeGreaterThanOrEqual(1);
    expect(summary.counts.love).toBeGreaterThanOrEqual(1);
    expect(summary.csatScore).toBe(100);
    expect(summary.recentComments.length).toBeGreaterThanOrEqual(1);
    expect(summary.recentComments[0]?.comment).toBe("Portal muito fluido!");
  });

  it("retorna resumo vazio para empresa inexistente sem lançar erro", async () => {
    const summary = await getCandidateSentimentSummary("inexistente");
    expect(summary.total).toBe(0);
    expect(summary.csatScore).toBe(100);
  });
});
