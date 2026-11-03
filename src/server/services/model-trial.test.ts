import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { currentModelOption, findRecentAnalyzedApplications, loadApplicationMaterial, scoreMaterialWithModel } = vi.hoisted(() => ({
  currentModelOption: vi.fn(async () => "claude-sonnet-5-5"),
  findRecentAnalyzedApplications: vi.fn(async () => [
    { id: "a", name: "ANA SOUZA", job: { title: "Vaga", aiMinScore: 60, aiCriteria: [], requirements: null } },
    { id: "b", name: "bruno lima", job: { title: "Vaga", aiMinScore: 60, aiCriteria: [], requirements: null } },
    { id: "c", name: "Sem Material", job: { title: "Vaga", aiMinScore: 60, aiCriteria: [], requirements: null } },
  ]),
  loadApplicationMaterial: vi.fn(async (id: string) => (id === "c" ? null : `cv de ${id}`)),
  scoreMaterialWithModel: vi.fn(async (_job: unknown, material: string, model: string) => ({
    score: (material.endsWith("a") ? 80 : 30) + (model === "claude-haiku-5-5" ? -5 : 0),
    reasoning: model,
  })),
}));
vi.mock("@/lib/gemini", () => ({ currentModelOption }));
vi.mock("@/server/repositories/application.repository", () => ({ findRecentAnalyzedApplications }));
vi.mock("@/server/services/ai.service", () => ({ loadApplicationMaterial, scoreMaterialWithModel }));

import { runModelTrial } from "@/server/services/model-trial.service";

beforeEach(() => vi.clearAllMocks());

describe("teste de modelo de IA", () => {
  it("roda o modelo atual e o testado no mesmo currículo, cada nota no candidato certo", async () => {
    const r = await runModelTrial("co1", "claude-haiku-5-5");
    if (!r.ok) throw new Error(r.error);
    expect(findRecentAnalyzedApplications).toHaveBeenCalledWith("co1", 10);
    expect(r.referenceModel).toBe("claude-sonnet-5-5");
    expect(r.rows.map((x) => [x.applicationId, x.name, x.reference, x.candidate])).toEqual([
      ["a", "Ana Souza", { score: 80, reasoning: "claude-sonnet-5-5" }, { score: 75, reasoning: "claude-haiku-5-5" }],
      ["b", "Bruno Lima", { score: 30, reasoning: "claude-sonnet-5-5" }, { score: 25, reasoning: "claude-haiku-5-5" }],
    ]);
    expect(r.summary.sameDecision).toBe(2);
  });

  it("falha de um modelo não derruba o teste", async () => {
    scoreMaterialWithModel.mockRejectedValueOnce(new Error("Claude 529: overloaded"));
    const r = await runModelTrial("co1", "claude-haiku-5-5");
    if (!r.ok) throw new Error(r.error);
    expect(r.rows[0].reference).toEqual({ error: "Claude 529: overloaded" });
  });

  it("recusa modelo fora da lista ou igual ao atual", async () => {
    expect((await runModelTrial("co1", "gpt-qualquer")).ok).toBe(false);
    expect((await runModelTrial("co1", "claude-sonnet-5-5")).ok).toBe(false);
    expect(scoreMaterialWithModel).not.toHaveBeenCalled();
  });
});
