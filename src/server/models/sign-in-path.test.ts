import { describe, expect, it } from "vitest";

import { signInPath } from "@/server/models/candidate.model";

describe("signInPath", () => {
  it("leva para a aba Entrar (quem tem conta) e guarda para onde voltar", () => {
    expect(signInPath("technova", "/technova/minhas-candidaturas/abc123")).toBe(
      "/technova/entrar?next=%2Ftechnova%2Fminhas-candidaturas%2Fabc123&modo=entrar"
    );
  });
  it("funciona para qualquer empresa e destino", () => {
    expect(signInPath("loja-x", "/loja-x/notificacoes")).toBe("/loja-x/entrar?next=%2Floja-x%2Fnotificacoes&modo=entrar");
  });
});
