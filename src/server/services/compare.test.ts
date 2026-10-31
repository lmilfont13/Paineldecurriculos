import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { geminiGenerate, getCompanyApplication } = vi.hoisted(() => ({
  geminiGenerate: vi.fn(),
  getCompanyApplication: vi.fn(),
}));
vi.mock("@/lib/gemini", () => ({ geminiGenerate }));
vi.mock("@/server/services/application.service", () => ({ getCompanyApplication }));

import { suggestComparison } from "@/server/services/compare.service";

const app = (id: string, name: string, aiScore: number | null, met: "sim" | "não" = "sim") => ({
  id,
  name,
  status: "PENDING",
  aiScore,
  aiReasoning: `Leitura de ${name}`,
  aiProfile: "Vendedor",
  aiArea: null,
  aiLevel: "Pleno",
  aiChecklist: [{ criterion: "Vendas", met, evidence: "5 anos" }],
  resumeText: `${name} escreveu seu currículo. contato ${name.toLowerCase()}@mail.com`,
  job: { title: "Consultor de Vendas", code: "1123", requirements: "• Vendas", aiCriteria: ["Vendas"], aiMinScore: 70 },
});

const aiAnswer = JSON.stringify({
  recomendado: "C2",
  confianca: "alta",
  resumo: "C2 é a melhor escolha.",
  motivos: ["Mais experiência"],
  por_candidato: [
    { candidato: "C1", pontos_fortes: ["Disponível"], pontos_atencao: ["Menos experiência"], por_que_nao: "Menos aderente" },
    { candidato: "C2", pontos_fortes: ["Experiência"], pontos_atencao: [] },
  ],
  confirmar_na_entrevista: "Horários.",
});

beforeEach(() => {
  geminiGenerate.mockReset();
  getCompanyApplication.mockReset();
  getCompanyApplication.mockImplementation(async (_co: string, id: string) =>
    ({ a1: app("a1", "Ana", 70, "não"), a2: app("a2", "Bruno", 90), x: null })[id] ?? null
  );
});

describe("suggestComparison", () => {
  it("pede a escolha à IA e devolve a recomendação com os nomes reais e os motivos", async () => {
    geminiGenerate.mockResolvedValue(aiAnswer);
    const r = await suggestComparison("co1", ["a1", "a2"]);
    expect(r).toMatchObject({ ok: true, source: "ia", recommendedId: "a2", confidence: "alta" });
    if (!r.ok) throw new Error("esperava ok");
    expect(r.reasons).toEqual(["Mais experiência"]);
    expect(r.candidates.find((c) => c.id === "a1")).toMatchObject({ name: "Ana", whyNot: "Menos aderente" });
  });

  it("não envia nome nem e-mail dos candidatos à IA", async () => {
    geminiGenerate.mockResolvedValue(aiAnswer);
    await suggestComparison("co1", ["a1", "a2"]);
    const sent = JSON.stringify(geminiGenerate.mock.calls[0][0]);
    expect(sent).not.toMatch(/Ana|Bruno|ana@mail|bruno@mail/);
  });

  it("se a IA falhar, ainda sugere pelos números e diz que é cálculo", async () => {
    geminiGenerate.mockRejectedValue(new Error("429"));
    const r = await suggestComparison("co1", ["a1", "a2"]);
    expect(r).toMatchObject({ ok: true, source: "numeros", recommendedId: "a2" });
    if (!r.ok) throw new Error("esperava ok");
    expect(r.summary).toContain("Bruno");
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it("resposta ilegível da IA também cai para os números", async () => {
    geminiGenerate.mockResolvedValue("não é json");
    const r = await suggestComparison("co1", ["a1", "a2"]);
    expect(r).toMatchObject({ ok: true, source: "numeros" });
  });

  it("candidatura de outra empresa não entra; com menos de 2 válidas, recusa", async () => {
    const r = await suggestComparison("co1", ["a1", "x"]);
    expect(r.ok).toBe(false);
    expect(geminiGenerate).not.toHaveBeenCalled();
  });

  it("aceita no máximo 3 candidaturas", async () => {
    geminiGenerate.mockResolvedValue(aiAnswer);
    await suggestComparison("co1", ["a1", "a2", "a1", "a2", "a1"]);
    expect(getCompanyApplication.mock.calls.length).toBeLessThanOrEqual(3);
  });
});
