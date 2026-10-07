import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const runs: Record<string, unknown>[] = [];
const saved: unknown[] = [];
vi.mock("@/server/repositories/application.repository", () => ({
  createAgentRun: vi.fn(async () => ({ id: "run1" })),
  updateAgentRun: vi.fn(async (_id: string, data: Record<string, unknown>) => runs.push(data)),
  updateApplicationCareer: vi.fn(async (_id: string, data: unknown) => saved.push(data)),
}));
vi.mock("@/server/repositories/job.repository", () => ({
  findOpenJobsByCompanyId: vi.fn(async () => [
    { id: "jOwn", title: "Assistente Administrativo", aiCriteria: [], requirements: null },
    { id: "jPromotor", title: "Promotor de Vendas", aiCriteria: ["PDV"], requirements: null },
    { id: "jMotorista", title: "Motorista", aiCriteria: ["CNH"], requirements: null },
  ]),
}));
const app = { id: "a1", name: "Rafael", jobId: "jOwn", companyId: "co1" };
vi.mock("@/server/services/application.service", () => ({
  getCompanyApplication: vi.fn(async (co: string) => (co === "co1" ? app : null)),
}));
const career = vi.fn();
vi.mock("@/server/services/ai.service", () => ({ analyzeCareerProfile: (...a: unknown[]) => career(...a) }));
const scored: string[] = [];
vi.mock("@/server/services/talent.service", () => ({
  scoreStandby: vi.fn(async (_co: string, _app: string, job: { id: string }) => scored.push(job.id)),
}));

import { runCareerAnalysis } from "@/server/services/career.service";

const profile = {
  areas: [{ area: "Vendas e trade marketing", score: 85, why: "Promotor por 5 anos." }],
  roles: ["Promotor de vendas"],
  summary: "Bem aproveitado como promotor.",
  analyzedAt: "2026-10-07T00:00:00.000Z",
};

beforeEach(() => {
  runs.length = 0;
  saved.length = 0;
  scored.length = 0;
  career.mockReset();
});

describe("runCareerAnalysis", () => {
  it("salva o perfil, compara com vagas abertas parecidas (menos a original) e registra na sala", async () => {
    career.mockResolvedValue(profile);
    const result = await runCareerAnalysis("co1", "a1");
    expect(result).toMatchObject({ ok: true, jobsCompared: 2 });
    expect(saved).toEqual([profile]);
    expect(scored[0]).toBe("jPromotor");
    expect(scored).not.toContain("jOwn");
    expect(runs.at(-1)).toMatchObject({ status: "SUCCEEDED", summary: "Perfil de Rafael: Vendas e trade marketing (85)" });
  });

  it("sem material não salva e avisa", async () => {
    career.mockResolvedValue(null);
    const result = await runCareerAnalysis("co1", "a1");
    expect(result.ok).toBe(false);
    expect(saved).toEqual([]);
  });

  it("erro da IA vira execução com falha, sem lançar", async () => {
    career.mockRejectedValue(new Error("Groq 500"));
    const result = await runCareerAnalysis("co1", "a1");
    expect(result.ok).toBe(false);
    expect(runs.at(-1)).toMatchObject({ status: "FAILED", error: "Groq 500" });
  });

  it("candidato de outra empresa não roda (regra 1)", async () => {
    expect((await runCareerAnalysis("co2", "a1")).ok).toBe(false);
    expect(career).not.toHaveBeenCalled();
  });
});
