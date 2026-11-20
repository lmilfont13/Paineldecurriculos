import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  findTalentPoolJob: vi.fn(),
  findShowcaseAskTargets: vi.fn(),
  markShowcaseAsked: vi.fn(),
  sendBulkMessage: vi.fn(),
}));
vi.mock("@/server/repositories/job.repository", () => ({ findTalentPoolJob: m.findTalentPoolJob }));
vi.mock("@/server/repositories/application.repository", () => ({
  findShowcaseAskTargets: m.findShowcaseAskTargets,
  markShowcaseAsked: m.markShowcaseAsked,
  findShowcaseHires: vi.fn(),
  updateShowcaseConsent: vi.fn(),
  updateShowcaseHidden: vi.fn(),
}));
vi.mock("@/server/services/bulk-message.service", () => ({ sendBulkMessage: m.sendBulkMessage }));

import { askShowcaseConsent } from "@/server/services/showcase.service";

beforeEach(() => Object.values(m).forEach((f) => f.mockReset()));

describe("pedido de autorização da vitrine", () => {
  it("manda só para quem ainda não foi perguntado e marca como perguntado", async () => {
    m.findTalentPoolJob.mockResolvedValue({ id: "pool" });
    m.findShowcaseAskTargets.mockResolvedValue([{ id: "a1" }, { id: "a2" }]);
    m.sendBulkMessage.mockResolvedValue({ ok: true, total: 2 });

    expect(await askShowcaseConsent("c1")).toEqual({ ok: true, sent: 2 });
    expect(m.findShowcaseAskTargets).toHaveBeenCalledWith("c1", "pool");
    expect(m.sendBulkMessage.mock.calls[0][0]).toBe("c1");
    expect(m.sendBulkMessage.mock.calls[0][1]).toEqual(["a1", "a2"]);
    expect(m.markShowcaseAsked).toHaveBeenCalledWith("c1", ["a1", "a2"]);
  });

  it("não envia nem marca quando não há ninguém", async () => {
    m.findTalentPoolJob.mockResolvedValue(null);
    m.findShowcaseAskTargets.mockResolvedValue([]);
    expect((await askShowcaseConsent("c1")).ok).toBe(false);
    expect(m.sendBulkMessage).not.toHaveBeenCalled();
    expect(m.markShowcaseAsked).not.toHaveBeenCalled();
  });

  it("não marca como perguntado se o envio falhar", async () => {
    m.findTalentPoolJob.mockResolvedValue(null);
    m.findShowcaseAskTargets.mockResolvedValue([{ id: "a1" }]);
    m.sendBulkMessage.mockResolvedValue({ ok: false, error: "x" });
    expect((await askShowcaseConsent("c1")).ok).toBe(false);
    expect(m.markShowcaseAsked).not.toHaveBeenCalled();
  });
});
