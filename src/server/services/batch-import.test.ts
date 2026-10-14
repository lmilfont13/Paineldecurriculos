import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: (fn: () => unknown) => fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/inngest", () => ({ trySendEvent: vi.fn(async () => true), inngestConfigured: true }));

const PREFIX = "co1/j1/lote/";
const PATH = `${PREFIX}11111111-2222-3333-4444-555555555555.pdf`;
let resumeText = "";
const contact = vi.fn();
vi.mock("@/server/services/ai.service", () => ({
  readResumeText: vi.fn(async () => resumeText),
  extractResumeContact: (...a: unknown[]) => contact(...a),
  runTriageWithTracking: vi.fn(),
}));
vi.mock("@/server/services/resume-storage.service", () => ({
  verifyUploadedResume: vi.fn(async () => ({ ok: true })),
  createResumeUploadTarget: vi.fn(async (prefix: string) => ({ path: `${prefix}x.pdf`, token: "t" })),
  RESUMES_BUCKET: "resumes",
}));
const candidates: Record<string, { id: string; email: string; name: string; authId: null; phone: null; resumeUrl: null }> = {};
vi.mock("@/server/repositories/candidate.repository", () => ({
  findCandidateByEmail: vi.fn(async (e: string) => candidates[e] ?? null),
  createCandidate: vi.fn(async (d: { email: string; name: string }) => {
    candidates[d.email] = { id: `c-${d.email}`, authId: null, phone: null, resumeUrl: null, ...d };
    return candidates[d.email];
  }),
}));
vi.mock("@/server/repositories/user.repository", () => ({
  findUserByEmail: vi.fn(async () => null),
  findManagerByCompanyId: vi.fn(),
}));
vi.mock("@/server/repositories/job.repository", () => ({
  findJobById: vi.fn(async (id: string) => (id === "j1" ? { id: "j1", companyId: "co1", title: "Promotor" } : null)),
}));
const apps: Record<string, unknown>[] = [];
vi.mock("@/server/repositories/application.repository", () => ({
  findApplicationByCandidateAndJob: vi.fn(async (cid: string) => apps.find((a) => a.candidateId === cid) ?? null),
  createApplication: vi.fn(async (d: Record<string, unknown>) => {
    const a = { id: `a${apps.length + 1}`, ...d };
    apps.push(a);
    return a;
  }),
  createStatusEvent: vi.fn(async () => {}),
}));

import { importBatchResume, requestBatchResumeUploads } from "@/server/services/application.service";

beforeEach(() => {
  apps.length = 0;
  for (const k of Object.keys(candidates)) delete candidates[k];
  contact.mockReset();
});

describe("lote de currículos", () => {
  it("lê contato do PDF, pré-cadastra com o currículo e manda para a IA", async () => {
    resumeText = "JOANA SOUSA LIMA Promotora joana.lima@gmail.com · (85) 97777-6666 Experiência em supermercados por 4 anos.";
    contact.mockResolvedValue({ name: "Joana Sousa Lima", email: "outro@x.com", phone: null });
    const r = await importBatchResume("co1", "j1", PATH, "cv.pdf");
    expect(r).toMatchObject({ status: "created", name: "Joana Sousa Lima", email: "joana.lima@gmail.com", phone: "(85) 97777-6666" });
    expect(apps[0]).toMatchObject({ preRegistered: true, resumeUrl: PATH, aiState: "WAITING" });
    // O e-mail achado no texto vale mais que o da IA

    const again = await importBatchResume("co1", "j1", PATH, "cv.pdf");
    expect(again).toMatchObject({ status: "exists" });
  });

  it("sem e-mail no PDF pede para digitar; com o e-mail digitado, cadastra", async () => {
    resumeText = "Carlos Alberto Nunes\nRepositor com 3 anos de experiência em atacarejo e câmara fria.";
    contact.mockResolvedValue({ name: "Carlos Alberto Nunes", email: null, phone: null });
    expect(await importBatchResume("co1", "j1", PATH, "carlos.pdf")).toEqual({
      status: "needs_email",
      name: "Carlos Alberto Nunes",
    });
    expect(await importBatchResume("co1", "j1", PATH, "carlos.pdf", "carlos@x.com")).toMatchObject({
      status: "created",
      email: "carlos@x.com",
    });
  });

  it("recusa arquivo fora da pasta do lote e vaga de outra empresa (regra 1)", async () => {
    expect(await importBatchResume("co1", "j1", "co2/j9/lote/x.pdf", "x.pdf")).toMatchObject({ status: "skipped" });
    expect(await importBatchResume("co2", "j1", PATH, "x.pdf")).toMatchObject({ status: "skipped" });
    expect(await requestBatchResumeUploads("co2", "j1", 3)).toBeNull();
    expect((await requestBatchResumeUploads("co1", "j1", 99))?.length).toBe(30);
  });
});
