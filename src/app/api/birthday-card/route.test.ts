import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const session = vi.fn();
vi.mock("@/server/services/auth.service", () => ({
  getSessionUser: () => session(),
  isManager: (u: { role: string; companyId: string | null }) => u.role === "MANAGER" && u.companyId !== null,
}));
const company = vi.fn();
vi.mock("@/server/services/company.service", () => ({
  getCompanyById: (...a: unknown[]) => company(...a),
}));

import { GET } from "./route";

const PNG = [0x89, 0x50, 0x4e, 0x47];
const get = (query: string) => GET(new NextRequest(`http://localhost:3000/api/birthday-card?${query}`));

beforeEach(() => {
  session.mockReset();
  company.mockReset();
  session.mockResolvedValue({ id: "u1", role: "MANAGER", companyId: "co1" });
  company.mockResolvedValue({ name: "Tarhget", primaryColor: "#811201", logoUrl: null });
});

describe("GET /api/birthday-card", () => {
  it("recusa quem não é gestor logado (era aberta: qualquer um gerava imagem com texto livre)", async () => {
    session.mockResolvedValue(null);
    const res = await get("name=Ana");
    expect(res.status).toBe(401);
    expect(company).not.toHaveBeenCalled();
  });

  it("gera PNG com a empresa da sessão, ignorando empresa vinda no pedido", async () => {
    const res = await get("name=Maria+Julia+de+Araujo&company=Outra&theme=marca");
    expect(res.status).toBe(200);
    expect(company).toHaveBeenCalledWith("co1");
    expect(res.headers.get("content-type")).toContain("image/png");
    expect(res.headers.get("cache-control")).toContain("private");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 4)]).toEqual(PNG);
    expect(bytes.byteLength).toBeGreaterThan(5000);
  });

  it("desenha os três temas, com e sem idade, com acento e nome comprido", async () => {
    for (const theme of ["marca", "claro", "noite"]) {
      for (const extra of ["", "&showAge=true&age=30&mode=full"]) {
        const res = await get(`name=${encodeURIComponent("Conceição Albuquerque Vasconcelos")}&theme=${theme}${extra}`);
        expect(res.status).toBe(200);
        expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(5000);
      }
    }
  });

  it("mensagem colada do WhatsApp (emoji, asteriscos, quebras) não quebra a imagem", async () => {
    const msg = "Olá, Maria! 🎉🎂\n\nA equipe da *Trade* deseja um *Feliz Aniversário*! ✨🎈";
    const res = await get(`name=Maria&message=${encodeURIComponent(msg)}`);
    expect(res.status).toBe(200);
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(5000);
  });

  it("logo fora do ar não derruba o cartão", async () => {
    company.mockResolvedValue({ name: "Tarhget", primaryColor: "#811201", logoUrl: "https://127.0.0.1:1/logo.png" });
    const res = await get("name=Ana");
    expect(res.status).toBe(200);
  });
});
