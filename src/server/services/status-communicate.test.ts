import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { trySendEvent, runInBackground, updateApplicationStatus, createStatusEvent, findApplicationById } =
  vi.hoisted(() => ({
    trySendEvent: vi.fn(async () => true),
    runInBackground: vi.fn(),
    updateApplicationStatus: vi.fn(async () => ({ id: "a1", status: "REJECTED" })),
    createStatusEvent: vi.fn(async () => ({})),
    findApplicationById: vi.fn(async () => ({ id: "a1", status: "PENDING", companyId: "co1" })),
  }));

vi.mock("@/lib/inngest", () => ({ trySendEvent, inngestConfigured: true }));
vi.mock("@/lib/background", () => ({ runInBackground }));
vi.mock("@/server/repositories/application.repository", async (orig) => ({
  ...(await orig<object>()),
  updateApplicationStatus,
  findApplicationById,
  createStatusEvent,
}));

import * as service from "@/server/services/application.service";

beforeEach(() => vi.clearAllMocks());

describe("setApplicationStatus: aviso automático da etapa", () => {
  it("por padrão, avisa o candidato da mudança", async () => {
    await service.setApplicationStatus("co1", "a1", "REJECTED");
    expect(trySendEvent).toHaveBeenCalledWith({
      name: "application/status-changed",
      data: { applicationId: "a1", status: "REJECTED" },
    });
  });

  it("communicate=false: muda a etapa e registra o histórico, sem aviso automático", async () => {
    await service.setApplicationStatus("co1", "a1", "REJECTED", { communicate: false });
    expect(updateApplicationStatus).toHaveBeenCalledWith("a1", "REJECTED");
    expect(createStatusEvent).toHaveBeenCalledWith(
      expect.objectContaining({ applicationId: "a1", from: "PENDING", to: "REJECTED", actor: "gestor" })
    );
    expect(trySendEvent).not.toHaveBeenCalled();
    expect(runInBackground).not.toHaveBeenCalled();
  });
});
