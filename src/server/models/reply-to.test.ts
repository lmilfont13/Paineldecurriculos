import { describe, expect, it } from "vitest";

import { replyToEmail } from "@/server/models/company.model";

describe("replyToEmail", () => {
  it("o e-mail da empresa vence o do usuário gestor", () => {
    expect(replyToEmail("vanessa.freitas@tarhgetfortaleza.com.br", "ana@technova.com")).toBe(
      "vanessa.freitas@tarhgetfortaleza.com.br"
    );
  });
  it("ignora espaços", () => {
    expect(replyToEmail("  contato@empresa.com.br ", null)).toBe("contato@empresa.com.br");
  });
  it("e-mail da empresa vazio ou inválido cai para o do gestor", () => {
    expect(replyToEmail("", "gestor@empresa.com")).toBe("gestor@empresa.com");
    expect(replyToEmail("isso-nao-e-email", "gestor@empresa.com")).toBe("gestor@empresa.com");
  });
  it("sem nenhum dos dois, não há endereço de resposta", () => {
    expect(replyToEmail(null, null)).toBeNull();
    expect(replyToEmail("x", undefined)).toBeNull();
  });
});
