import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: (fn: () => unknown) => fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const apps: Record<string, { companyId: string; name: string; resumeUrl: string | null; job: { title: string } }> = {
  a1: { companyId: "co1", name: "Ana", resumeUrl: "co1/job1/cand1/x.pdf", job: { title: "Vaga" } },
  a2: { companyId: "co1", name: "Bia", resumeUrl: "profile/cand2/y.pdf", job: { title: "Vaga" } },
  a3: { companyId: "co2", name: "Outro tenant", resumeUrl: "co2/job9/c/z.pdf", job: { title: "Vaga" } },
  a4: { companyId: "co1", name: "Marina", resumeUrl: "demo/curriculo-candidato-ficticio.pdf", job: { title: "Vaga" } },
};
const deletedIds: string[] = [];
const removed: string[][] = [];

vi.mock("@/server/repositories/application.repository", () => ({
  findApplicationById: vi.fn(async (id: string) => apps[id] ?? null),
  deleteApplication: vi.fn(async (id: string) => { deletedIds.push(id); }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: { from: () => ({ remove: async (paths: string[]) => { removed.push(paths); } }) },
  }),
}));

import { deleteCompanyApplications } from "@/server/services/application.service";

beforeEach(() => {
  deletedIds.length = 0;
  removed.length = 0;
});

describe("deleteCompanyApplications", () => {
  it("só exclui candidaturas da empresa da sessão (regra 1)", async () => {
    const { deleted } = await deleteCompanyApplications("co1", ["a1", "a3", "nao-existe"]);
    expect(deleted.map((d) => d.id)).toEqual(["a1"]);
    expect(deletedIds).toEqual(["a1"]);
  });

  it("apaga o PDF da vaga, mas preserva o do perfil e o da demonstração", async () => {
    await deleteCompanyApplications("co1", ["a1", "a2", "a4"]);
    await new Promise((r) => setTimeout(r, 0));
    expect(deletedIds).toEqual(["a1", "a2", "a4"]);
    expect(removed).toEqual([["co1/job1/cand1/x.pdf"]]);
  });
});
