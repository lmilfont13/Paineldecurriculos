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

import { toPdfSafeText } from "@/server/models/text.model";

describe("toPdfSafeText", () => {
  it("troca símbolos que a fonte do PDF não tem (marcadores de lista de currículo) por espaço", () => {
    expect(toPdfSafeText("HASKELL  Promotora")).toBe("HASKELL Promotora");
    expect(toPdfSafeText("Cargo → Vendedor ✓")).toBe("Cargo Vendedor");
  });
  it("mantém acentos, travessão, aspas e bullet", () => {
    const ok = "Promoção – “vendas” • atendimento — São Paulo ç";
    expect(toPdfSafeText(ok)).toBe(ok);
  });
  it("não deixa espaços repetidos", () => {
    expect(toPdfSafeText("a    b")).toBe("a b");
  });
});

import { removeNulChars } from "@/server/models/text.model";

describe("removeNulChars", () => {
  it("tira o caractere nulo, que o Postgres não aceita em texto", () => {
    expect(removeNulChars("Maria\u0000 Souza\u0000")).toBe("Maria Souza");
  });
  it("limpa dentro de listas e objetos (checklist guardado como JSON)", () => {
    const input = [{ criterion: "Vendas", met: "sim", evidence: "5 anos\u0000 em loja" }];
    expect(removeNulChars(input)).toEqual([{ criterion: "Vendas", met: "sim", evidence: "5 anos em loja" }]);
  });
  it("não mexe em números, booleanos, null nem em texto normal", () => {
    expect(removeNulChars({ a: 1, b: true, c: null, d: "ok" })).toEqual({ a: 1, b: true, c: null, d: "ok" });
  });
});

describe("removeNulChars preserva tipos especiais", () => {
  it("datas e instâncias de classe passam intactas", () => {
    const d = new Date("2026-10-31T12:00:00Z");
    class Marker {}
    const m = new Marker();
    expect(removeNulChars(d)).toBe(d);
    expect(removeNulChars(m)).toBe(m);
  });
});
