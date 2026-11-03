import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { createApplication, findJobById } = vi.hoisted(() => ({
  createApplication: vi.fn(),
  findJobById: vi.fn(async () => ({ id: "j1", companyId: "co1", status: "OPEN", title: "Vaga" })),
}));

vi.mock("@/server/repositories/job.repository", () => ({ findJobById }));
vi.mock("@/server/repositories/application.repository", async (orig) => ({
  ...(await orig<object>()),
  findApplicationByCandidateAndJob: vi.fn(async () => null),
  createApplication,
}));
vi.mock("@/server/services/form.service", () => ({
  findFieldsForJob: vi.fn(async () => []),
}));

import { CONSENT_REQUIRED_MESSAGE, CONSENT_VERSION } from "@/server/models/consent.model";
import { submitApplication } from "@/server/services/application.service";

const base = { jobId: "j1", name: "Maria", phone: "85999991234", isPcd: false, answers: {} };
const candidate = { id: "c1", email: "m@x.com", resumeUrl: "c1/cv.pdf", birthDate: null } as never;

beforeEach(() => {
  createApplication.mockReset();
  findJobById.mockClear();
});

describe("consentimento LGPD na candidatura", () => {
  it("recusa sem o aceite, antes de ler a vaga ou gravar qualquer dado", async () => {
    for (const consent of [undefined, false]) {
      const result = await submitApplication("co1", candidate, { ...base, consent } as never, null);
      expect(result).toEqual({ ok: false, error: CONSENT_REQUIRED_MESSAGE });
    }
    expect(findJobById).not.toHaveBeenCalled();
    expect(createApplication).not.toHaveBeenCalled();
  });

  it("com o aceite, grava a data e a versão do texto aceito", async () => {
    // Interrompe logo depois de gravar: só interessa o que foi salvo.
    createApplication.mockRejectedValue(new Error("parou-aqui"));
    const before = Date.now();
    await expect(
      submitApplication("co1", candidate, { ...base, consent: true } as never, null)
    ).rejects.toThrow("parou-aqui");
    expect(createApplication).toHaveBeenCalledTimes(1);
    const saved = createApplication.mock.calls[0][0];
    expect(saved.consentVersion).toBe(CONSENT_VERSION);
    expect(saved.consentAt).toBeInstanceOf(Date);
    expect(saved.consentAt.getTime()).toBeGreaterThanOrEqual(before);
  });
});
