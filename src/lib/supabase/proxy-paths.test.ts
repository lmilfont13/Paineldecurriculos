import { describe, expect, it } from "vitest";

import { hasSupabaseSessionCookie, isProtectedPath } from "./proxy-paths";

describe("isProtectedPath", () => {
  it("cobre todas as áreas do gestor e do admin", () => {
    for (const p of [
      "/painel",
      "/vagas",
      "/vagas/nova",
      "/candidaturas/abc",
      "/talentos",
      "/talentos/pasta1",
      "/buscar-cvs",
      "/aniversariantes",
      "/relatorio-geral",
      "/suporte-ao-vivo",
      "/configuracoes/formulario",
      "/agentes",
      "/auditoria",
      "/admin/empresas",
    ]) {
      expect(isProtectedPath(p), p).toBe(true);
    }
  });

  it("não confunde rotas públicas do candidato", () => {
    for (const p of ["/", "/login", "/technova/vagas", "/technova/vagas/abc/candidatar", "/talentosa", "/api/inngest"]) {
      expect(isProtectedPath(p), p).toBe(false);
    }
  });
});

describe("hasSupabaseSessionCookie", () => {
  it("reconhece o cookie de sessão, inteiro ou em pedaços", () => {
    expect(hasSupabaseSessionCookie(["sb-xbjvwotigqkemjhdyqol-auth-token"])).toBe(true);
    expect(hasSupabaseSessionCookie(["outro", "sb-abc-auth-token.0", "sb-abc-auth-token.1"])).toBe(true);
  });

  it("ignora visitante sem sessão e cookies parecidos", () => {
    expect(hasSupabaseSessionCookie([])).toBe(false);
    expect(hasSupabaseSessionCookie(["triagem_origem", "sb-abc-auth-token-code-verifier"])).toBe(false);
  });
});
