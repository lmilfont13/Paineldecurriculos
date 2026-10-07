import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const jobs: Record<string, { id: string; companyId: string; title: string }> = {
  j1: { id: "j1", companyId: "co1", title: "Promotor" },
  j2: { id: "j2", companyId: "co2", title: "Outro tenant" },
};
const appIdsByJob: Record<string, string[]> = {
  j1: Array.from({ length: 150 }, (_, i) => `a${i}`),
};
const deletedJobs: string[] = [];
const deleteCalls: string[][] = [];

vi.mock("@/server/repositories/job.repository", () => ({
  findJobById: vi.fn(async (id: string) => jobs[id] ?? null),
  deleteJob: vi.fn(async (id: string) => { deletedJobs.push(id); }),
}));
vi.mock("@/server/repositories/application.repository", () => ({
  findApplicationIdsByJob: vi.fn(async (_co: string, jobId: string) => appIdsByJob[jobId] ?? []),
}));
vi.mock("@/server/services/application.service", () => ({
  deleteCompanyApplications: vi.fn(async (_co: string, ids: string[]) => {
    deleteCalls.push(ids);
    return { deleted: ids.map((id) => ({ id, name: "", jobTitle: "" })) };
  }),
}));

import { deleteCompanyJob } from "@/server/services/job.service";

beforeEach(() => {
  deletedJobs.length = 0;
  deleteCalls.length = 0;
});

describe("deleteCompanyJob", () => {
  it("apaga as candidaturas em lotes (com currículos) e depois a vaga", async () => {
    const result = await deleteCompanyJob("co1", "j1");
    expect(result).toEqual({ title: "Promotor", deletedApplications: 150 });
    expect(deleteCalls.map((c) => c.length)).toEqual([100, 50]);
    expect(deletedJobs).toEqual(["j1"]);
  });

  it("não exclui vaga de outra empresa (regra 1)", async () => {
    expect(await deleteCompanyJob("co1", "j2")).toBeNull();
    expect(await deleteCompanyJob("co1", "nao-existe")).toBeNull();
    expect(deletedJobs).toEqual([]);
    expect(deleteCalls).toEqual([]);
  });
});
