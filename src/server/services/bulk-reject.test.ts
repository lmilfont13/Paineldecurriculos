import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getCompanyApplication, setApplicationStatus, sendBulkMessage } = vi.hoisted(() => ({
  getCompanyApplication: vi.fn(),
  setApplicationStatus: vi.fn(async () => ({ id: "x" })),
  sendBulkMessage: vi.fn(async (_c: string, ids: string[]) => ({
    ok: true, total: ids.length, notified: ids.length, emailed: ids.length,
    noChannel: 0, skipped: 0, whatsapp: [], noPhone: 0,
  })),
}));
vi.mock("@/server/services/application.service", () => ({ getCompanyApplication, setApplicationStatus }));
vi.mock("@/server/services/bulk-message.service", () => ({ MAX_BULK_RECIPIENTS: 300, sendBulkMessage }));

import { rejectPendingWithMessage } from "@/server/services/bulk-reject.service";

const apps: Record<string, { jobId: string; status: string }> = {
  a: { jobId: "j1", status: "PENDING" },
  b: { jobId: "j1", status: "PENDING" },
  c: { jobId: "j1", status: "SHORTLISTED" }, // já passou: não pode ser reprovado aqui
  d: { jobId: "j2", status: "PENDING" }, // outra vaga
};
const base = { jobId: "j1", subject: "Retorno", template: "Obrigado, {nome}!", channels: ["email", "system"] as never };

beforeEach(() => {
  vi.clearAllMocks();
  getCompanyApplication.mockImplementation(async (_co: string, id: string) =>
    apps[id] ? { id, ...apps[id] } : null
  );
});

describe("reprovação em massa com mensagem", () => {
  it("só reprova quem ainda está na triagem desta vaga, sem o aviso automático", async () => {
    const result = await rejectPendingWithMessage("co1", { ...base, applicationIds: ["a", "b", "c", "d", "zz"] });
    expect(result).toMatchObject({ ok: true, rejected: 2, rejectedIds: ["a", "b"], skipped: 3 });
    expect(setApplicationStatus).toHaveBeenCalledTimes(2);
    for (const call of setApplicationStatus.mock.calls) {
      expect(call).toEqual(["co1", expect.any(String), "REJECTED", { communicate: false }]);
    }
    // Mensagem escolhida vai só para quem foi reprovado.
    expect(sendBulkMessage).toHaveBeenCalledWith("co1", ["a", "b"], "Retorno", "Obrigado, {nome}!", ["email", "system"]);
  });

  it("mensagem vazia ou sem canal: recusa antes de mexer em qualquer etapa", async () => {
    for (const bad of [{ template: " " }, { channels: [] as never }, { applicationIds: [] as string[] }]) {
      const result = await rejectPendingWithMessage("co1", { ...base, applicationIds: ["a"], ...bad });
      expect(result.ok).toBe(false);
    }
    expect(getCompanyApplication).not.toHaveBeenCalled();
    expect(setApplicationStatus).not.toHaveBeenCalled();
    expect(sendBulkMessage).not.toHaveBeenCalled();
  });

  it("ninguém elegível: não envia mensagem", async () => {
    const result = await rejectPendingWithMessage("co1", { ...base, applicationIds: ["c"] });
    expect(result).toMatchObject({ ok: true, rejected: 0, skipped: 1, message: null });
    expect(sendBulkMessage).not.toHaveBeenCalled();
  });
});
