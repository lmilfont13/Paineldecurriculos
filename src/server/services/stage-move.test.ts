import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getCompanyApplication, setApplicationStatus, sendBulkMessage } = vi.hoisted(() => ({
  getCompanyApplication: vi.fn(async () => ({ id: "a1", status: "SHORTLISTED" })),
  setApplicationStatus: vi.fn(async () => ({ id: "a1" })),
  sendBulkMessage: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/server/services/application.service", () => ({ getCompanyApplication, setApplicationStatus }));
vi.mock("@/server/services/bulk-message.service", () => ({ sendBulkMessage }));

import { moveApplication } from "@/server/services/stage-move.service";

beforeEach(() => vi.clearAllMocks());

describe("mover com escolha do aviso", () => {
  it("padrão: muda a etapa com o aviso automático (o da prévia)", async () => {
    await expect(moveApplication("co1", "a1", "INTERVIEW", { mode: "standard" })).resolves.toEqual({ ok: true, notice: "standard" });
    expect(setApplicationStatus).toHaveBeenCalledWith("co1", "a1", "INTERVIEW", { communicate: true });
    expect(sendBulkMessage).not.toHaveBeenCalled();
  });

  it("editada: sem o aviso automático e com a mensagem do gestor — uma só", async () => {
    await moveApplication("co1", "a1", "APPROVED", { mode: "custom", subject: "Parabéns", text: "Oi {nome}!" });
    expect(setApplicationStatus).toHaveBeenCalledWith("co1", "a1", "APPROVED", { communicate: false });
    expect(sendBulkMessage).toHaveBeenCalledWith("co1", ["a1"], "Parabéns", "Oi {nome}!", ["email", "system"]);
  });

  it("sem avisar: só muda a etapa", async () => {
    await moveApplication("co1", "a1", "REJECTED", { mode: "silent" });
    expect(setApplicationStatus).toHaveBeenCalledWith("co1", "a1", "REJECTED", { communicate: false });
    expect(sendBulkMessage).not.toHaveBeenCalled();
  });

  it("editada vazia: recusa antes de mexer na etapa; outra empresa: não acha", async () => {
    expect((await moveApplication("co1", "a1", "APPROVED", { mode: "custom", subject: "", text: " " })).ok).toBe(false);
    expect(setApplicationStatus).not.toHaveBeenCalled();
    getCompanyApplication.mockResolvedValueOnce(null as never);
    expect(await moveApplication("co2", "a1", "APPROVED", { mode: "standard" })).toEqual({
      ok: false,
      error: "Candidatura não encontrada.",
    });
    expect(setApplicationStatus).not.toHaveBeenCalled();
  });
});
