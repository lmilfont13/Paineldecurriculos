import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStatus, JobStatus } from "@prisma/client";

vi.mock("server-only", () => ({}));
vi.mock("@/server/repositories/application.repository", () => ({
  findDashboardApplications: vi.fn(),
}));
vi.mock("@/server/repositories/job.repository", () => ({ findDashboardJobs: vi.fn() }));

import { findDashboardApplications } from "@/server/repositories/application.repository";
import { findDashboardJobs } from "@/server/repositories/job.repository";
import { getDashboard } from "./dashboard.service";

const now = new Date("2026-11-19T12:00:00Z");
const job = (id: string, status: JobStatus = "OPEN") => ({ id, title: id, code: null, status });
const application = (id: string, jobId: string, status: AppStatus, daysAgo = 0, aiScore: number | null = 80) => ({
  id, name: "ANA SILVA", status, aiScore, aiState: "DONE" as const,
  createdAt: new Date(now.getTime() - daysAgo * 86_400_000), updatedAt: now,
  photoPath: null, hasImpediment: false, impedimentReason: null,
  job: { id: jobId, title: jobId, code: null, aiMinScore: 70 },
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
afterEach(() => vi.useRealTimers());

// Contrato do painel: a redução da carga não pode mudar contagens nem prioridade.
describe("painel com projeções leves", () => {
  it("mantém o estado inicial sem vagas", async () => {
    vi.mocked(findDashboardApplications).mockResolvedValue([]);
    vi.mocked(findDashboardJobs).mockResolvedValue([]);
    const result = await getDashboard("tenant-a");
    expect(result.stats).toMatchObject({ totalJobs: 0, totalApplications: 0, waiting: 0, oldestWaitingAt: null });
    expect(result.priority).toEqual([]);
    expect(result.jobs).toEqual([]);
    expect(findDashboardApplications).toHaveBeenCalledWith("tenant-a");
    expect(findDashboardJobs).toHaveBeenCalledWith("tenant-a");
  });

  it("preserva prioridade por espera, desempate por nota e limite de cinco", async () => {
    const rows = Array.from({ length: 8 }, (_, i) => application(`a${i}`, "vaga", "PENDING", i));
    rows.push(application("mais-aderente", "vaga", "PENDING", 7, 99));
    rows.push(application("entrevista", "vaga", "INTERVIEW", 20));
    rows[0].hasImpediment = true;
    rows[0].impedimentReason = null;
    vi.mocked(findDashboardApplications).mockResolvedValue(rows);
    vi.mocked(findDashboardJobs).mockResolvedValue([job("vaga")]);
    const result = await getDashboard("tenant-a");
    expect(result.priority.map((a) => a.id)).toEqual(["mais-aderente", "a7", "a6", "a5", "a4"]);
    expect(result.stats.waiting).toBe(9);
    expect(result.stats.oldestWaitingAt).toEqual(rows[7].createdAt);
    expect(result.priority[0]).toMatchObject({ name: "Ana Silva", meetsMinimum: true, photoPath: null });
  });

  it("conta todos os status no total e mantém rascunhos, pausadas e vagas vazias", async () => {
    vi.mocked(findDashboardApplications).mockResolvedValue([
      application("1", "aberta", "PENDING"), application("2", "aberta", "INTERVIEW"),
      application("3", "aberta", "APPROVED"), application("4", "aberta", "REJECTED"),
      application("5", "aberta", "STANDBY"),
    ]);
    vi.mocked(findDashboardJobs).mockResolvedValue([
      job("aberta"), job("rascunho", "DRAFT"), job("pausada", "PAUSED"), job("fechada", "CLOSED"),
    ]);
    const result = await getDashboard("tenant-a");
    expect(result.stats).toMatchObject({ openJobs: 1, totalJobs: 4, totalApplications: 5, decided7d: 2, newApplications7d: 5 });
    expect(result.jobs.map((j) => j.id)).toEqual(["rascunho", "aberta", "pausada"]);
    expect(result.jobs[1]).toMatchObject({ total: 5, pending: 1, interview: 1, approved: 1, rejected: 1 });
    expect(result.jobs[0].total).toBe(0);
  });

  it("produz as mesmas contagens da implementação anterior em uma base maior", async () => {
    const statuses: AppStatus[] = ["PENDING", "INTERVIEW", "APPROVED", "REJECTED", "STANDBY"];
    const jobs = Array.from({ length: 100 }, (_, i) => job(`vaga-${i}`));
    const rows = Array.from({ length: 5000 }, (_, i) => application(`a${i}`, jobs[i % 100].id, statuses[Math.floor(i / 100) % statuses.length], i % 30));
    vi.mocked(findDashboardApplications).mockResolvedValue(rows);
    vi.mocked(findDashboardJobs).mockResolvedValue(jobs);
    const result = await getDashboard("tenant-b");
    for (const progress of result.jobs) {
      const previous = rows.filter((a) => a.job.id === progress.id);
      expect(progress).toMatchObject({
        total: previous.length,
        pending: previous.filter((a) => a.status === "PENDING").length,
        interview: previous.filter((a) => a.status === "INTERVIEW").length,
        approved: previous.filter((a) => a.status === "APPROVED").length,
        rejected: previous.filter((a) => a.status === "REJECTED").length,
      });
    }
  });
});
