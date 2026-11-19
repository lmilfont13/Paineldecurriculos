import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { applications, jobs } = vi.hoisted(() => ({ applications: vi.fn(), jobs: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { application: { findMany: applications }, job: { findMany: jobs } },
}));

import { findDashboardApplications } from "./application.repository";
import { findDashboardJobs } from "./job.repository";

beforeEach(() => vi.resetAllMocks());

describe("consultas leves do painel", () => {
  it("mantém o escopo da sessão e exclui demos, vagas fechadas e banco de talentos", async () => {
    const rows = [{ id: "a1" }];
    applications.mockResolvedValueOnce([]).mockResolvedValueOnce(rows);
    expect(await findDashboardApplications("tenant-a")).toBe(rows);
    const query = applications.mock.calls[1][0];
    expect(query.where).toEqual({ companyId: "tenant-a", isDemo: false, job: { isTalentPool: false, status: "OPEN" } });
    // O contrato de I/O não deve transferir textos grandes ou documentos sem uso.
    expect(Object.keys(query.select).sort()).toEqual([
      "id", "name", "status", "aiScore", "aiState", "createdAt", "updatedAt",
      "photoPath", "hasImpediment", "impedimentReason", "job",
    ].sort());
    expect(query.orderBy).toEqual([{ aiScore: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }]);
  });

  it("carrega a identidade das vagas sem descrições nem contagens de candidaturas", async () => {
    jobs.mockResolvedValue([]);
    await findDashboardJobs("tenant-b");
    expect(jobs).toHaveBeenCalledWith({
      where: { companyId: "tenant-b", isTalentPool: false },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, code: true, status: true },
    });
  });
});
