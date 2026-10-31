import { describe, expect, it } from "vitest";

import { titleCasePt } from "@/server/models/text.model";

describe("titleCasePt — nomes de pessoas", () => {
  it("capitaliza cada parte e deixa as ligações em minúsculo", () => {
    expect(titleCasePt("Gabriel ribeiro martins")).toBe("Gabriel Ribeiro Martins");
    expect(titleCasePt("MARIA DA SILVA")).toBe("Maria da Silva");
    expect(titleCasePt("joão de souza e silva")).toBe("João de Souza e Silva");
  });
  it("sigla em maiúsculo vira nome (ANA → Ana)", () => {
    expect(titleCasePt("ANA LIMA")).toBe("Ana Lima");
  });
  it("hífen, apóstrofo e acentos", () => {
    expect(titleCasePt("maria-clara d'ávila")).toBe("Maria-Clara D'Ávila");
  });
  it("espaços repetidos e vazio", () => {
    expect(titleCasePt("  pedro   alves ")).toBe("Pedro Alves");
    expect(titleCasePt("")).toBe("");
  });
});

describe("titleCasePt — títulos de vaga", () => {
  const opt = { keepAcronyms: true };
  it("'De' vira 'de' e a primeira palavra fica maiúscula", () => {
    expect(titleCasePt("Consultor De Vendas", opt)).toBe("Consultor de Vendas");
    expect(titleCasePt("de vendas", opt)).toBe("De Vendas");
  });
  it("mantém siglas e palavras com maiúscula no meio", () => {
    expect(titleCasePt("analista de TI sênior", opt)).toBe("Analista de TI Sênior");
    expect(titleCasePt("Gerente iFood", opt)).toBe("Gerente iFood");
  });
});
