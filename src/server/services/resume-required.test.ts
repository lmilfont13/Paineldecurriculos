import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { createApplication } = vi.hoisted(() => ({ createApplication: vi.fn() }));

vi.mock("@/server/repositories/job.repository", () => ({
  findJobById: vi.fn(async () => ({ id: "j1", companyId: "co1", status: "OPEN", title: "Vaga" })),
}));
vi.mock("@/server/repositories/application.repository", async (orig) => ({
  ...(await orig<object>()),
  findApplicationByCandidateAndJob: vi.fn(async () => null),
  createApplication,
}));
vi.mock("@/server/services/form.service", () => ({
  findFieldsForJob: vi.fn(async () => []),
}));

import { submitApplication } from "@/server/services/application.service";

const input = { jobId: "j1", name: "Maria", phone: "85999991234", isPcd: false, answers: {} };
const candidate = (resumeUrl: string | null) =>
  ({ id: "c1", resumeUrl, birthDate: null }) as never;

beforeEach(() => createApplication.mockReset());

describe("currículo obrigatório na candidatura", () => {
  it("recusa quando não há currículo novo nem o do perfil", async () => {
    const result = await submitApplication("co1", candidate(null), input as never, null);
    expect(result).toEqual({
      ok: false,
      error: "Anexe seu currículo em PDF para se candidatar.",
    });
    expect(createApplication).not.toHaveBeenCalled();
  });
});
