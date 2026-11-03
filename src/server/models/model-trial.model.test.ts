import { describe, expect, it } from "vitest";

import { summarizeTrial, type TrialRow } from "@/server/models/model-trial.model";

const row = (id: string, ref: number | null, cand: number | null, min = 60): TrialRow => ({
  applicationId: id,
  name: id,
  jobTitle: "Vaga",
  minScore: min,
  reference: ref === null ? { error: "x" } : { score: ref, reasoning: "" },
  candidate: cand === null ? { error: "x" } : { score: cand, reasoning: "" },
});

describe("veredito do teste de modelo", () => {
  it("mesma decisão em todos e notas próximas: dá conta", () => {
    const s = summarizeTrial([row("a", 80, 75), row("b", 40, 45), row("c", 90, 88), row("d", 30, 35), row("e", 70, 72)]);
    expect(s).toMatchObject({ compared: 5, sameDecision: 5, meanAbsDiff: 3.8, verdict: "SUFFICIENT", flagged: [] });
  });

  it("decisão diferente longe da linha de corte em 1 de 5: com ressalvas, caso destacado", () => {
    const s = summarizeTrial([row("a", 80, 75), row("b", 75, 50), row("c", 90, 88), row("d", 30, 35), row("e", 70, 72)]);
    expect(s).toMatchObject({ sameDecision: 4, borderline: 0, verdict: "REVIEW", flagged: ["b"] });
  });

  it("divergência colada na nota mínima não pesa contra, mas fica destacada", () => {
    const s = summarizeTrial([row("a", 92, 90), row("b", 65, 55), row("c", 52, 60), row("d", 30, 28), row("e", 40, 45)]);
    expect(s).toMatchObject({ sameDecision: 3, borderline: 2, verdict: "SUFFICIENT", flagged: ["b", "c"] });
  });

  it("muita discordância: não recomenda", () => {
    const s = summarizeTrial([row("a", 80, 40), row("b", 30, 85), row("c", 90, 50), row("d", 30, 35), row("e", 70, 72)]);
    expect(s.verdict).toBe("INSUFFICIENT");
    expect(s.flagged).toEqual(["a", "b", "c"]);
  });

  it("diferença grande sem mudar a decisão também é destacada", () => {
    expect(summarizeTrial([row("a", 95, 70)]).flagged).toEqual(["a"]);
  });

  it("menos de 5 comparações ou erros do modelo em teste", () => {
    expect(summarizeTrial([row("a", 80, 80), row("b", 40, 40)]).verdict).toBe("INCONCLUSIVE");
    const s = summarizeTrial([row("a", 80, null), row("b", 40, 40), row("c", 90, 90), row("d", 30, 30), row("e", 70, 70), row("f", 20, 20)]);
    expect(s.candidateErrors).toBe(1);
    expect(s.compared).toBe(5);
  });
});

import { explainAiError } from "@/server/models/model-trial.model";

describe("explicação do erro da IA", () => {
  it("traduz os erros comuns em motivo e ação", () => {
    expect(explainAiError("ANTHROPIC_API_KEY não configurada").reason).toMatch(/não está configurada/);
    expect(explainAiError('Claude 401: {"type":"authentication_error","message":"invalid x-api-key"}').reason).toMatch(/recusada/);
    expect(explainAiError('Claude 400: {"message":"Your credit balance is too low"}').reason).toMatch(/sem crédito/);
    expect(explainAiError('Claude 404: {"type":"not_found_error","message":"model: claude-haiku-5-5"}').reason).toMatch(/não está disponível/);
    expect(explainAiError("Claude 529: overloaded").reason).toMatch(/sobrecarregada/);
    expect(explainAiError("Score inválido retornado pela IA: oi").reason).toMatch(/fora do formato/);
  });
});
