import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const session = vi.fn();
vi.mock("@/server/services/auth.service", () => ({
  getSessionUser: () => session(),
  isManager: (u: { role: string; companyId: string | null }) => u.role === "MANAGER" && u.companyId !== null,
  isAdmin: (u: { role: string }) => u.role === "ADMIN",
}));

const generate = vi.fn(async () => ({ ok: true, base64: Buffer.from("img").toString("base64"), mimeType: "image/jpeg" }));
vi.mock("@/server/services/birthday-image.service", () => ({
  generateBirthdayAiImage: (...a: unknown[]) => generate(...(a as [])),
}));

import { GET } from "./route";

const request = () =>
  new Request("https://site.test/api/birthday-image?name=Ana&age=30&company=Acme") as never;

beforeEach(() => {
  session.mockReset();
  generate.mockClear();
});

describe("GET /api/birthday-image", () => {
  it("recusa visitante sem sessão e não chama a IA (custo e dados a terceiros)", async () => {
    session.mockResolvedValue(null);
    const res = await GET(request());
    expect(res.status).toBe(401);
    expect(generate).not.toHaveBeenCalled();
  });

  it("gera para gestor logado, sem cache público", async () => {
    session.mockResolvedValue({ id: "u1", role: "MANAGER", companyId: "co1" });
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(res.headers.get("Cache-Control")).toContain("private");
  });
});
