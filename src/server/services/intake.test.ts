import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: (fn: () => unknown) => fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/inngest", () => ({ trySendEvent: vi.fn(async () => true), inngestConfigured: true }));

const candidates: Record<string, { id: string; email: string; name: string; authId: string | null; phone: string | null; resumeUrl: string | null }> = {
  "ja@x.com": { id: "c1", email: "ja@x.com", name: "Já Tem", authId: "auth1", phone: "85988887777", resumeUrl: "profile/c1/cv.pdf" },
};
const applications: Record<string, unknown>[] = [];
const events: Record<string, unknown>[] = [];

vi.mock("@/server/repositories/candidate.repository", () => ({
  findCandidateByEmail: vi.fn(async (email: string) => candidates[email] ?? null),
  createCandidate: vi.fn(async (data: { email: string; name: string }) => {
    const c = { id: `c-${data.email}`, authId: null, phone: null, resumeUrl: null, ...data };
    candidates[data.email] = c;
    return c;
  }),
}));
vi.mock("@/server/repositories/user.repository", () => ({
  findUserByEmail: vi.fn(async (email: string) => (email === "gestor@x.com" ? { id: "u1" } : null)),
  findManagerByCompanyId: vi.fn(),
}));
vi.mock("@/server/repositories/job.repository", () => ({
  findJobById: vi.fn(async (id: string) => (id === "j1" ? { id: "j1", companyId: "co1", title: "Promotor", status: "OPEN" } : null)),
}));
vi.mock("@/server/repositories/application.repository", () => ({
  findApplicationByCandidateAndJob: vi.fn(async (candidateId: string) =>
    applications.find((a) => a.candidateId === candidateId) ?? null
  ),
  createApplication: vi.fn(async (data: Record<string, unknown>) => {
    const app = { id: `a${applications.length + 1}`, ...data };
    applications.push(app);
    return app;
  }),
  createStatusEvent: vi.fn(async (e: Record<string, unknown>) => events.push(e)),
}));

import { preRegisterCandidates } from "@/server/services/application.service";

beforeEach(() => {
  applications.length = 0;
  events.length = 0;
});

describe("preRegisterCandidates", () => {
  it("cria candidatura incompleta só com o e-mail e pula equipe e repetidos", async () => {
    const result = await preRegisterCandidates("co1", "j1", [
      { email: "novo@x.com", name: "Novo Candidato", phone: null },
      { email: "gestor@x.com", name: "Gestor", phone: null },
      { email: "ja@x.com", name: "Outro Nome", phone: null },
    ]);
    expect(result?.created.map((c) => c.email)).toEqual(["novo@x.com", "ja@x.com"]);
    expect(result?.skipped).toEqual([{ email: "gestor@x.com", reason: "é e-mail de alguém da equipe" }]);

    const [novo, ja] = applications as Record<string, unknown>[];
    expect(novo).toMatchObject({ preRegistered: true, aiState: "NO_RESUME", resumeUrl: null, name: "Novo Candidato" });
    // Quem já tem conta mantém o nome dela e entra na análise com o currículo do perfil
    expect(ja).toMatchObject({ preRegistered: true, aiState: "WAITING", name: "Já Tem", resumeUrl: "profile/c1/cv.pdf" });
    expect(events.every((e) => e.actor === "gestor")).toBe(true);

    const again = await preRegisterCandidates("co1", "j1", [{ email: "novo@x.com", name: "x", phone: null }]);
    expect(again?.skipped).toEqual([{ email: "novo@x.com", reason: "já está nesta vaga" }]);
  });

  it("vaga de outra empresa não cadastra (regra 1)", async () => {
    expect(await preRegisterCandidates("co2", "j1", [{ email: "a@x.com", name: "A", phone: null }])).toBeNull();
    expect(applications).toEqual([]);
  });
});
