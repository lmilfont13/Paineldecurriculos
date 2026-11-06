import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    job: {
      findMany: vi.fn(),
    },
    application: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { searchGlobal } from "./search.service";

describe("search service (command palette)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna vagas recentes quando a busca é vazia", async () => {
    (prisma.job.findMany as any).mockResolvedValue([
      { id: "j1", title: "Vendedor", code: "VD-01", status: "OPEN", _count: { applications: 3 } },
    ]);

    const res = await searchGlobal("comp_1", "");
    expect(res.candidates).toEqual([]);
    expect(res.jobs).toHaveLength(1);
    expect(res.jobs[0].title).toBe("Vendedor");
    expect(prisma.application.findMany).not.toHaveBeenCalled();
  });

  it("busca candidatos e vagas quando há termo de busca", async () => {
    (prisma.application.findMany as any).mockResolvedValue([
      {
        id: "a1",
        name: "Carlos Silva",
        email: "carlos@example.com",
        status: "PENDING",
        aiScore: 92,
        job: { id: "j1", title: "Vendedor" },
      },
    ]);
    (prisma.job.findMany as any).mockResolvedValue([
      { id: "j1", title: "Vendedor Interno", code: "VD-02", status: "OPEN", _count: { applications: 1 } },
    ]);

    const res = await searchGlobal("comp_1", "Carlos");
    expect(res.candidates).toHaveLength(1);
    expect(res.candidates[0].name).toBe("Carlos Silva");
    expect(res.jobs).toHaveLength(1);
    expect(res.jobs[0].title).toBe("Vendedor Interno");
  });
});

