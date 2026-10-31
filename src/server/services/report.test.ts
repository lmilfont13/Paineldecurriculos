import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { getCompanyJob, getCompanyById, findApplicationsForReport, analyzeJobShortlist } = vi.hoisted(() => ({
  getCompanyJob: vi.fn(),
  getCompanyById: vi.fn(),
  findApplicationsForReport: vi.fn(),
  analyzeJobShortlist: vi.fn(),
}));
vi.mock("@/server/services/job.service", () => ({ getCompanyJob }));
vi.mock("@/server/services/company.service", () => ({ getCompanyById }));
vi.mock("@/server/repositories/application.repository", () => ({ findApplicationsForReport }));
vi.mock("@/server/services/shortlist.service", () => ({ analyzeJobShortlist }));

import { REPORT_AI_TIMEOUT_MS, loadJobReportData } from "@/server/services/report.service";

const row = (over: Record<string, unknown>) => ({
  id: "a1",
  name: "Ana Souza",
  status: "PENDING",
  aiScore: 90,
  aiReasoning: "Leitura original da IA.",
  aiProfile: "Vendedora",
  aiArea: "Vendas",
  aiLevel: "Pleno",
  aiChecklist: [{ criterion: "Vendas", met: "sim", evidence: "5 anos em loja" }],
  salaryExpectation: "2200",
  availability: "IMMEDIATE",
  city: "Fortaleza",
  neighborhood: "Messejana",
  createdAt: new Date("2026-10-30T12:00:00Z"),
  ...over,
});

beforeEach(() => {
  getCompanyJob.mockReset().mockResolvedValue({
    id: "j1",
    title: "Promotor de Vendas",
    code: "1124",
    aiMinScore: 70,
    aiCriteria: ["Vendas"],
  });
  getCompanyById.mockReset().mockResolvedValue({ name: "TARHGET FORTALEZA", primaryColor: "#7a1f3d" });
  findApplicationsForReport.mockReset().mockResolvedValue([row({}), row({ id: "a2", name: "Bia Lima", aiScore: 60 })]);
  analyzeJobShortlist.mockReset();
});

describe("loadJobReportData", () => {
  it("mantém a avaliação como gravada e traduz a disponibilidade", async () => {
    analyzeJobShortlist.mockResolvedValue({ ok: false, error: "x" });
    const r = await loadJobReportData("co1", "j1", false);
    expect(r).not.toBeNull();
    const ana = r!.data.ranking[0];
    expect(ana.aiReasoning).toBe("Leitura original da IA.");
    expect(ana.criteria).toEqual([{ criterion: "Vendas", met: "sim", evidence: "5 anos em loja" }]);
    expect(ana.availability).toBe("Imediata");
    expect(r!.company).toEqual({ name: "TARHGET FORTALEZA", brand: "#7a1f3d" });
  });

  it("vaga de outra empresa não gera relatório", async () => {
    getCompanyJob.mockResolvedValue(null);
    expect(await loadJobReportData("co1", "outra", false)).toBeNull();
    expect(findApplicationsForReport).not.toHaveBeenCalled();
  });

  it("sem IA comparativa não chama a IA", async () => {
    await loadJobReportData("co1", "j1", false);
    expect(analyzeJobShortlist).not.toHaveBeenCalled();
  });

  it("com IA comparativa, anexa as notas dos melhores; se a IA falhar, o relatório sai sem elas", async () => {
    analyzeJobShortlist.mockResolvedValueOnce({
      ok: true,
      analyzed: 2,
      total: 2,
      picks: [{ applicationId: "a1", rank: 1, name: "Ana", aiScore: 90, status: "PENDING", reason: "Mais forte.", strengths: ["Vendas"], concerns: [] }],
    });
    const ok = await loadJobReportData("co1", "j1", true);
    expect(ok!.notes).toEqual({ a1: { reason: "Mais forte.", strengths: ["Vendas"], concerns: [] } });

    analyzeJobShortlist.mockRejectedValueOnce(new Error("429"));
    const fail = await loadJobReportData("co1", "j1", true);
    expect(fail!.notes).toBeNull();
    expect(fail!.data.ranking).toHaveLength(2);
  });
});

describe("loadJobReportData: a IA nunca trava o relatório", () => {
  it("se o comparativo da IA demorar demais, o relatório sai sem ele", async () => {
    vi.useFakeTimers();
    try {
      analyzeJobShortlist.mockReturnValue(new Promise(() => {})); // nunca responde
      const pending = loadJobReportData("co1", "j1", true);
      await vi.advanceTimersByTimeAsync(REPORT_AI_TIMEOUT_MS + 100);
      const report = await pending;
      expect(report!.notes).toBeNull();
      expect(report!.data.ranking).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("loadJobReportData: texto seguro para o PDF", () => {
  it("limpa símbolos da fonte de currículo na leitura da IA e nas evidências", async () => {
    findApplicationsForReport.mockResolvedValue([
      row({
        aiReasoning: "Experiência  sólida.",
        aiChecklist: [{ criterion: "Vendas", met: "sim", evidence: "HASKELL  Promotora" }],
      }),
    ]);
    const r = await loadJobReportData("co1", "j1", false);
    expect(r!.data.ranking[0].aiReasoning).toBe("Experiência sólida.");
    expect(r!.data.ranking[0].criteria[0].evidence).toBe("HASKELL Promotora");
  });
});
