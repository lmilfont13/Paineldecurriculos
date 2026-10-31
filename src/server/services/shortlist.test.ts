import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { geminiGenerate, getCompanyJob, findApplicationsForShortlist } = vi.hoisted(() => ({
  geminiGenerate: vi.fn(),
  getCompanyJob: vi.fn(),
  findApplicationsForShortlist: vi.fn(),
}));
vi.mock("@/lib/gemini", () => ({ geminiGenerate }));
vi.mock("@/server/services/job.service", () => ({ getCompanyJob }));
vi.mock("@/server/repositories/application.repository", () => ({ findApplicationsForShortlist }));

import { analyzeJobShortlist } from "@/server/services/shortlist.service";

const app = (id: string, name: string, aiScore: number, status = "PENDING") => ({
  id,
  name,
  status,
  aiScore,
  aiReasoning: null,
  aiProfile: "Vendedor",
  aiArea: null,
  aiLevel: null,
  aiChecklist: null,
  resumeText: `Currículo de ${name}, e-mail ${name.toLowerCase()}@mail.com`,
});

beforeEach(() => {
  geminiGenerate.mockReset();
  getCompanyJob.mockReset().mockResolvedValue({
    id: "j1",
    title: "Consultor de Vendas",
    requirements: "• Vendas",
    aiCriteria: ["Vendas"],
  });
  findApplicationsForShortlist.mockReset();
});

describe("analyzeJobShortlist", () => {
  it("compara os candidatos da vaga e devolve o ranking com os nomes", async () => {
    findApplicationsForShortlist.mockResolvedValue([app("a1", "Ana", 70), app("a2", "Bruno", 90)]);
    geminiGenerate.mockResolvedValue(
      JSON.stringify({ ranking: [{ candidato: "C1", motivo: "Mais forte." }, { candidato: "C2", motivo: "Boa base." }] })
    );
    const result = await analyzeJobShortlist("co1", "j1", 5);
    expect(result).toMatchObject({ ok: true, analyzed: 2, total: 2 });
    if (!result.ok) throw new Error("esperava ok");
    // C1 é o de maior nota (Bruno), pois a ordem enviada é por nota
    expect(result.picks.map((p) => [p.rank, p.name])).toEqual([[1, "Bruno"], [2, "Ana"]]);
  });

  it("não envia nome nem e-mail para a IA", async () => {
    findApplicationsForShortlist.mockResolvedValue([app("a1", "Ana", 70), app("a2", "Bruno", 90)]);
    geminiGenerate.mockResolvedValue(JSON.stringify({ ranking: [{ candidato: "C1", motivo: "x" }] }));
    await analyzeJobShortlist("co1", "j1", 3);
    const sent = JSON.stringify(geminiGenerate.mock.calls[0][0]);
    expect(sent).not.toMatch(/Ana|Bruno|@mail\.com/);
  });

  it("precisa de pelo menos 2 candidatos para comparar", async () => {
    findApplicationsForShortlist.mockResolvedValue([app("a1", "Ana", 70), app("r", "Reprovado", 99, "REJECTED")]);
    const result = await analyzeJobShortlist("co1", "j1", 3);
    expect(result.ok).toBe(false);
    expect(geminiGenerate).not.toHaveBeenCalled();
  });

  it("vaga de outra empresa não é analisada", async () => {
    getCompanyJob.mockResolvedValue(null);
    const result = await analyzeJobShortlist("co1", "j-outro", 3);
    expect(result.ok).toBe(false);
    expect(findApplicationsForShortlist).not.toHaveBeenCalled();
  });

  it("falha da IA ou resposta ilegível vira erro claro", async () => {
    findApplicationsForShortlist.mockResolvedValue([app("a1", "Ana", 70), app("a2", "Bruno", 90)]);
    geminiGenerate.mockRejectedValueOnce(new Error("429"));
    expect((await analyzeJobShortlist("co1", "j1", 3)).ok).toBe(false);
    geminiGenerate.mockResolvedValueOnce("sem json aqui");
    expect((await analyzeJobShortlist("co1", "j1", 3)).ok).toBe(false);
  });
});
