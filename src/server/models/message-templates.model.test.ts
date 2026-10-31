import { describe, expect, it } from "vitest";

import { rejectionMessage } from "@/server/models/message-templates.model";

describe("rejectionMessage", () => {
  const text = rejectionMessage("Maria Souza", "Loja X", "Consultor de Vendas");

  it("começa pelo primeiro nome e cita a vaga e a empresa", () => {
    expect(text.startsWith("Maria,")).toBe(true);
    expect(text).toContain("Consultor de Vendas");
    expect(text).toContain("Loja X");
  });
  it("é respeitosa e não dá motivo nem promete retorno", () => {
    expect(text).toMatch(/não vamos seguir/i);
    expect(text).not.toMatch(/entraremos em contato|guardaremos|banco de talentos/i);
  });
});

import { fillTemplate, subjectKey, toTemplate } from "@/server/models/message-templates.model";

describe("modelos de recado salvos", () => {
  const ctx = { firstName: "Maria", companyName: "Loja X", jobTitle: "Consultor de Vendas" };

  it("grava com marcadores no lugar de nome, empresa e vaga", () => {
    expect(
      toTemplate("Maria, a Loja X gostou do seu perfil para Consultor de Vendas.", ctx)
    ).toBe("{nome}, a {empresa} gostou do seu perfil para {vaga}.");
  });
  it("serve para outro candidato", () => {
    const saved = "{nome}, a {empresa} gostou do seu perfil para {vaga}.";
    expect(
      fillTemplate(saved, { firstName: "João", companyName: "Loja Y", jobTitle: "Caixa" })
    ).toBe("João, a Loja Y gostou do seu perfil para Caixa.");
  });
  it("nome vazio ou de 1 letra não vira marcador", () => {
    expect(toTemplate("A casa é de Ana.", { ...ctx, firstName: "A" })).toBe("A casa é de Ana.");
    expect(toTemplate("Oi", { ...ctx, firstName: "" })).toBe("Oi");
  });
  it("subjectKey ignora caixa, espaços e acentos", () => {
    expect(subjectKey("  Informações   Pendentes ")).toBe(subjectKey("informacoes pendentes"));
    expect(subjectKey("Teste")).not.toBe(subjectKey("Teste técnico"));
  });
});
