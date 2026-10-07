import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/background", () => ({ runInBackground: vi.fn() }));

const pool = [
  { id: "a1", name: "Ana", phone: null, jobId: "jPromotor", aiProfile: "Motorista e entregador", aiArea: "Logística", aiLevel: "Pleno", folderNames: ["Logística · Motorista"] },
  { id: "a2", name: "Bia", phone: null, jobId: "jAdm", aiProfile: "Promotor de vendas", aiArea: "Vendas", aiLevel: "Júnior", folderNames: ["Vendas · Promotor"] },
];
const matches: Record<string, unknown>[] = [];
vi.mock("@/server/repositories/talent.repository", () => ({
  findStandbyPool: vi.fn(async () => pool),
  upsertTalentMatch: vi.fn(async (data: Record<string, unknown>) => matches.push(data)),
  findTalentMatchesForApplication: vi.fn(),
  findTalentMatchesForJob: vi.fn(),
  addTalentFolderItem: vi.fn(),
  createTalentFolder: vi.fn(),
  deleteTalentFolder: vi.fn(),
  findFolderIdsForApplication: vi.fn(),
  findTalentFolder: vi.fn(),
  findTalentFolders: vi.fn(),
  removeTalentFolderItem: vi.fn(),
  renameTalentFolder: vi.fn(),
}));
const jobs = {
  jMotorista: { id: "jMotorista", companyId: "co1", title: "Motorista Entregador", aiCriteria: ["Entregas", "CNH"], requirements: null, status: "OPEN" },
  jPromotor: { id: "jPromotor", companyId: "co1", title: "Promotor de Vendas", aiCriteria: ["PDV"], requirements: null, status: "OPEN" },
  jOutra: { id: "jOutra", companyId: "co2", title: "Motorista", aiCriteria: [], requirements: null, status: "OPEN" },
};
vi.mock("@/server/repositories/job.repository", () => ({
  findJobById: vi.fn(async (id: keyof typeof jobs) => jobs[id] ?? null),
  findOpenJobsByCompanyId: vi.fn(async () => [jobs.jMotorista, jobs.jPromotor]),
}));
const score = vi.fn();
vi.mock("@/server/services/ai.service", () => ({
  scoreApplicationAgainstJob: (...a: unknown[]) => score(...a),
}));
vi.mock("@/server/services/application.service", () => ({ getCompanyApplication: vi.fn() }));
vi.mock("@/server/services/resume-photo.service", () => ({ withPhotoUrls: vi.fn() }));

import { analyzeStandbyForApplication, analyzeStandbyForJob } from "@/server/services/talent.service";

beforeEach(() => {
  matches.length = 0;
  score.mockReset();
});

describe("stand-by", () => {
  it("candidato guardado é conferido com as vagas abertas, menos a dele", async () => {
    score.mockResolvedValue({ score: 82, reasoning: "Experiência com entregas." });
    const n = await analyzeStandbyForApplication("co1", "a1");
    expect(n).toBe(1);
    expect(score.mock.calls.map((c) => (c[1] as { title: string }).title)).toEqual(["Motorista Entregador"]);
    expect(matches.at(-1)).toMatchObject({ applicationId: "a1", jobId: "jMotorista", state: "DONE", score: 82 });
  });

  it("vaga publicada confere o banco, sem quem já se inscreveu nela", async () => {
    score.mockResolvedValue({ score: 40, reasoning: "Pouca aderência." });
    await analyzeStandbyForJob("co1", "jPromotor");
    expect(score.mock.calls.map((c) => c[0])).toEqual(["a2"]);
  });

  it("vaga de outra empresa não roda (regra 1)", async () => {
    expect(await analyzeStandbyForJob("co1", "jOutra")).toBe(0);
    expect(score).not.toHaveBeenCalled();
  });

  it("sem material ou erro da IA ficam registrados sem derrubar a fila", async () => {
    score.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("Groq 500"));
    await analyzeStandbyForJob("co1", "jMotorista");
    const finals = matches.filter((m) => m.state !== "PROCESSING").map((m) => m.state);
    expect(finals).toEqual(["NO_RESUME", "FAILED"]);
  });
});
