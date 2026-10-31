import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { createUser, resetPasswordForEmail, findUserByEmail, prismaCreateManagerUser } = vi.hoisted(() => ({
  createUser: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  findUserByEmail: vi.fn(),
  prismaCreateManagerUser: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { createUser }, resetPasswordForEmail } }),
}));
vi.mock("@/server/repositories/user.repository", () => ({
  findUserByEmail,
  prismaCreateManagerUser,
  deleteUserById: vi.fn(),
  findUsersByCompany: vi.fn(),
}));

import { inviteManager } from "@/server/services/user.service";

beforeEach(() => {
  createUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  resetPasswordForEmail.mockReset().mockResolvedValue({ error: null });
  findUserByEmail.mockReset().mockResolvedValue(null);
  prismaCreateManagerUser.mockReset().mockResolvedValue({});
});

describe("inviteManager", () => {
  it("cria o acesso e ENVIA o e-mail para a pessoa definir a senha", async () => {
    const r = await inviteManager("co1", { name: "Vanessa Freitas", email: " Vanessa.Freitas@Empresa.com.br " });
    expect(r).toEqual({ ok: true });
    expect(prismaCreateManagerUser).toHaveBeenCalledWith({
      email: "vanessa.freitas@empresa.com.br",
      name: "Vanessa Freitas",
      companyId: "co1",
    });
    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      "vanessa.freitas@empresa.com.br",
      expect.objectContaining({ redirectTo: expect.stringContaining("/redefinir-senha") })
    );
  });

  it("se o e-mail não puder ser enviado, avisa e diz o que fazer, sem fingir que deu certo", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { message: "rate limit" } });
    const r = await inviteManager("co1", { name: "Maria", email: "maria@empresa.com.br" });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/Esqueci minha senha/);
  });

  it("e-mail que já tem acesso não é convidado de novo", async () => {
    findUserByEmail.mockResolvedValue({ id: "x" });
    const r = await inviteManager("co1", { name: "Maria", email: "maria@empresa.com.br" });
    expect(r.ok).toBe(false);
    expect(createUser).not.toHaveBeenCalled();
  });
});
