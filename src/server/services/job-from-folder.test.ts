import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

type Folder = {
  id: string;
  name: string;
  area: string | null;
  jobId: string | null;
  items: { application: Record<string, unknown> }[];
};
let folder: Folder | null;
const linked: [string, string][] = [];
vi.mock("@/server/repositories/talent.repository", () => ({
  findTalentFolder: vi.fn(async () => folder),
  setTalentFolderJob: vi.fn(async (id: string, jobId: string) => linked.push([id, jobId])),
  findTalentFolders: vi.fn(),
  findTalentFoldersByJob: vi.fn(),
  addTalentFolderItem: vi.fn(),
  createTalentFolder: vi.fn(),
  deleteTalentFolder: vi.fn(),
  findFolderIdsForApplication: vi.fn(),
  removeTalentFolderItem: vi.fn(),
  renameTalentFolder: vi.fn(),
}));
const jobs: Record<string, { id: string; companyId: string }> = {};
vi.mock("@/server/repositories/job.repository", () => ({
  findJobById: vi.fn(async (id: string) => jobs[id] ?? null),
}));
const created: Record<string, unknown>[] = [];
vi.mock("@/server/services/job.service", () => ({
  createCompanyJob: vi.fn(async (_co: string, input: Record<string, unknown>, publish: boolean) => {
    created.push({ ...input, publish });
    return { id: "novo" };
  }),
}));
vi.mock("@/server/services/application.service", () => ({ getCompanyApplication: vi.fn() }));
vi.mock("@/server/services/resume-photo.service", () => ({ withPhotoUrls: vi.fn() }));
const generate = vi.fn();
vi.mock("@/lib/gemini", () => ({
  AI_MODEL_ID: "groq:teste",
  geminiGenerate: (...a: unknown[]) => generate(...a),
}));

import { createJobFromFolder } from "@/server/services/talent.service";

const person = (name: string, location: string) => ({
  application: {
    name,
    aiProfile: "Motorista e entregador",
    aiLevel: "Pleno",
    job: { title: "Promotor", location, contract: "CLT", workMode: "ONSITE" },
  },
});

beforeEach(() => {
  linked.length = 0;
  created.length = 0;
  generate.mockReset();
  folder = {
    id: "f1",
    name: "Logística · Motorista e entregador",
    area: "Logística",
    jobId: null,
    items: [person("Ana Souza", "Fortaleza - CE"), person("Bruno Lima", "Fortaleza - CE"), person("Caio", "Eusébio")],
  };
});

describe("createJobFromFolder", () => {
  it("cria rascunho com o perfil da pasta, sem dados pessoais no prompt", async () => {
    generate.mockResolvedValue(
      '{"title":"Motorista Entregador","description":"Entregas na região metropolitana.","requirements":["CNH B"],"criteria":["Entregas","CNH","Rotas"],"minScore":65}'
    );
    const result = await createJobFromFolder("co1", "f1");

    expect(result).toEqual({ ok: true, jobId: "novo", existed: false });
    expect(created[0]).toMatchObject({
      title: "Motorista Entregador",
      location: "Fortaleza - CE",
      contract: "CLT",
      workMode: "ONSITE",
      aiMinScore: 65,
      publish: false,
    });
    expect(linked).toEqual([["f1", "novo"]]);
    const prompt = String(generate.mock.calls[0][0].prompt);
    expect(prompt).toContain("Motorista e entregador (3)");
    expect(prompt).not.toMatch(/Ana|Bruno|Caio/);
  });

  it("não duplica: devolve a vaga que a pasta já gerou", async () => {
    folder!.jobId = "j9";
    jobs.j9 = { id: "j9", companyId: "co1" };
    expect(await createJobFromFolder("co1", "f1")).toEqual({ ok: true, jobId: "j9", existed: true });
    expect(generate).not.toHaveBeenCalled();
  });

  it("pasta vazia ou de outra empresa não gera nada", async () => {
    folder!.items = [];
    expect((await createJobFromFolder("co1", "f1")).ok).toBe(false);
    folder = null;
    expect((await createJobFromFolder("co1", "f1")).ok).toBe(false);
    expect(created).toEqual([]);
  });
});
