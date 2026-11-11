import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const session = vi.fn();
vi.mock("@/server/services/auth.service", () => ({
  getSessionUser: () => session(),
  isManager: (u: { role: string; companyId: string | null }) => u.role === "MANAGER" && u.companyId !== null,
}));

const exportFn = vi.fn<(...args: unknown[]) => Promise<{ fileName: string; buffer: Buffer }>>(async () => ({ fileName: "cadastrados-acme-2026-11-11.xlsx", buffer: Buffer.from("xlsx") }));
vi.mock("@/server/services/candidate-export.service", () => ({
  exportCompanyCandidates: (...a: unknown[]) => exportFn(...a),
}));

import { GET } from "./route";

beforeEach(() => {
  session.mockReset();
  exportFn.mockClear();
});

describe("GET /api/export/cadastrados", () => {
  it("recusa visitante, candidato e admin sem empresa: nada é lido", async () => {
    for (const user of [null, { id: "a", role: "ADMIN", companyId: null }]) {
      session.mockResolvedValue(user);
      expect((await GET()).status).toBe(401);
    }
    expect(exportFn).not.toHaveBeenCalled();
  });

  it("gestor baixa só a própria empresa (companyId da sessão), sem cache", async () => {
    session.mockResolvedValue({ id: "u1", email: "g@x.com", name: "G", role: "MANAGER", companyId: "co1" });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(exportFn.mock.calls[0][0]).toBe("co1");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="cadastrados-acme-2026-11-11.xlsx"');
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml");
  });
});
