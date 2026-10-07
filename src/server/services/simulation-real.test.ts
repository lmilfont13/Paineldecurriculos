import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const background: (() => Promise<void>)[] = [];
vi.mock("@/lib/background", () => ({
  runInBackground: (_l: string, task: () => Promise<void>) => background.push(task),
}));

const aiUpdates: [string, Record<string, unknown>][] = [];
const findReal = vi.fn();
vi.mock("@/server/repositories/application.repository", () => ({
  countRealApplicationsByJob: vi.fn(async () => new Map([["j1", 12], ["j2", 2]])),
  findRealApplicationsForSimulation: (...a: unknown[]) => findReal(...a),
  updateApplicationAi: vi.fn(async (id: string, data: Record<string, unknown>) => {
    aiUpdates.push([id, data]);
  }),
  createAgentRun: vi.fn(async ({ applicationId }: { applicationId: string }) => ({ id: `run-${applicationId}` })),
  updateAgentRun: vi.fn(async () => {}),
  createApplication: vi.fn(),
  createStatusEvent: vi.fn(),
  findApplicationByCandidateAndJob: vi.fn(),
  findDemoApplicationIds: vi.fn(),
}));
vi.mock("@/server/repositories/job.repository", () => ({
  findJobsByCompanyId: vi.fn(async () => [
    { id: "j1", title: "Promotor" },
    { id: "j2", title: "Assistente" },
    { id: "j3", title: "Sem candidatos" },
  ]),
  findOpenJobsByCompanyId: vi.fn(),
  createJob: vi.fn(),
}));
vi.mock("@/server/repositories/candidate.repository", () => ({
  createCandidate: vi.fn(),
  findCandidateByEmail: vi.fn(),
}));
const triage = vi.fn(async () => {});
vi.mock("@/server/services/ai.service", () => ({
  runTriageWithTracking: (...a: unknown[]) => triage(...(a as [])),
}));
vi.mock("@/server/services/application.service", () => ({ deleteCompanyApplications: vi.fn() }));

import {
  getSimulationJobOptions,
  startRealTriageSimulation,
} from "@/server/services/simulation.service";

beforeEach(() => {
  background.length = 0;
  aiUpdates.length = 0;
  triage.mockClear();
  findReal.mockReset();
});

describe("sala com candidatos reais", () => {
  it("lista só vagas com candidatos reais, da maior para a menor", async () => {
    expect(await getSimulationJobOptions("co1")).toEqual({
      total: 14,
      jobs: [
        { id: "j1", title: "Promotor", count: 12 },
        { id: "j2", title: "Assistente", count: 2 },
      ],
    });
  });

  it("enfileira até 8 da vaga e só mexe nos campos da IA (regra 2)", async () => {
    findReal.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) => ({ id: `a${i}`, name: `Pessoa ${i}` }))
    );
    const result = await startRealTriageSimulation("co1", "j1");

    expect(findReal).toHaveBeenCalledWith("co1", "j1", 8);
    expect(result).toMatchObject({ jobTitle: "Promotor", capped: true });
    expect(result.candidates).toHaveLength(8);
    expect(aiUpdates.every(([, d]) => Object.keys(d).join() === "aiState")).toBe(true);

    await background[0]();
    expect(triage).toHaveBeenCalledTimes(8);
  });

  it("vaga de outra empresa (ou sem candidatos reais) não roda nada", async () => {
    const result = await startRealTriageSimulation("co1", "j-de-outra-empresa");
    expect(result.candidates).toEqual([]);
    expect(findReal).not.toHaveBeenCalled();
    expect(background).toHaveLength(0);
  });
});
