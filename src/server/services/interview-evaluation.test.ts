import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getCompanyApplication, upsertInterviewEvaluation } = vi.hoisted(() => ({
  getCompanyApplication: vi.fn(async () => ({ id: "a1" })),
  upsertInterviewEvaluation: vi.fn(async (d: Record<string, unknown>) => ({
    id: "e1", ...d, updatedAt: new Date("2026-11-03T12:00:00Z"),
  })),
}));
vi.mock("@/server/services/application.service", () => ({ getCompanyApplication }));
vi.mock("@/server/repositories/interview-evaluation.repository", () => ({
  upsertInterviewEvaluation,
  findInterviewEvaluations: vi.fn(async () => []),
}));

import { saveInterviewEvaluation } from "@/server/services/interview-evaluation.service";

const me = { id: "u1", email: "gestor@x.com", name: "Gestor" };
const input = {
  criteria: [
    { name: " Comunicação ", score: 5, note: " clara " },
    { name: "Vendas", score: 3, note: "" },
  ],
  recommendation: "YES",
  summary: "  Boa conversa. ",
};

beforeEach(() => vi.clearAllMocks());

describe("salvar ficha de avaliação", () => {
  it("grava a ficha do avaliador logado, limpa os textos e calcula a média", async () => {
    const r = await saveInterviewEvaluation("co1", me, "a1", input);
    expect(getCompanyApplication).toHaveBeenCalledWith("co1", "a1");
    expect(upsertInterviewEvaluation).toHaveBeenCalledWith({
      companyId: "co1",
      applicationId: "a1",
      evaluatorId: "u1",
      evaluatorName: "Gestor",
      evaluatorEmail: "gestor@x.com",
      criteria: [
        { name: "Comunicação", score: 5, note: "clara" },
        { name: "Vendas", score: 3, note: "" },
      ],
      recommendation: "YES",
      summary: "Boa conversa.",
    });
    expect(r).toMatchObject({ ok: true, evaluation: { average: 4, recommendation: "YES" } });
  });

  it("candidatura de outra empresa: não grava", async () => {
    getCompanyApplication.mockResolvedValueOnce(null as never);
    expect(await saveInterviewEvaluation("co2", me, "a1", input)).toEqual({ ok: false, error: "Candidatura não encontrada." });
    expect(upsertInterviewEvaluation).not.toHaveBeenCalled();
  });

  it("ficha vazia ou nota fora de 1–5: recusa", async () => {
    const empty = { criteria: [{ name: "A", score: null, note: "" }], recommendation: null, summary: "" };
    expect((await saveInterviewEvaluation("co1", me, "a1", empty)).ok).toBe(false);
    expect((await saveInterviewEvaluation("co1", me, "a1", { ...input, criteria: [{ name: "A", score: 7, note: "" }] })).ok).toBe(false);
    expect(upsertInterviewEvaluation).not.toHaveBeenCalled();
  });
});
