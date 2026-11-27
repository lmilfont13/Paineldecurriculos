import { describe, expect, it } from "vitest";

import { effectiveAge, formatBirthDate, inAgeRange, parseBirthDate } from "@/server/models/age.model";

describe("effectiveAge", () => {
  const now = new Date("2026-11-01T12:00:00Z");

  it("usa a data de nascimento informada como Date", () => {
    expect(effectiveAge(new Date("1990-03-12"), null, now)).toBe(36);
  });

  it("usa a data de nascimento informada como string (formato brasileiro)", () => {
    expect(effectiveAge("08/09/1985", null, now)).toBe(41);
  });

  it("usa a data de nascimento informada como string ISO", () => {
    expect(effectiveAge("1985-09-08", null, now)).toBe(41);
  });

  it("sempre prioriza a data de nascimento preenchida sobre a idade desatualizada do currículo", () => {
    // Currículo antigo diz "Idade: 28 anos", mas data de nascimento preenchida é 08/09/1985 (41 anos hoje)
    expect(
      effectiveAge("08/09/1985", "Nome do Candidato\nIdade: 28 anos\nExperiência em vendas", now)
    ).toBe(41);
  });

  it("usa data de nascimento preenchida em respostas do formulário", () => {
    const answers = [
      { field: { label: "Data de Nascimento" }, value: "08/09/1985" },
      { field: { label: "Uniforme" }, value: "M" },
    ];
    expect(
      effectiveAge(null, "Currículo antigo\nIdade: 25 anos", now, answers)
    ).toBe(41);
  });

  it("sem data preenchida, calcula a idade a partir da data de nascimento encontrada no currículo", () => {
    expect(effectiveAge(null, "Maria\nData de Nascimento: 12/03/1990\nExperiência", now)).toBe(36);
  });

  it("sem nenhuma data de nascimento, usa como último recurso a idade estática escrita no texto", () => {
    expect(effectiveAge(null, "João\nIdade: 34 anos\nProfissional", now)).toBe(34);
  });

  it("sem nenhuma fonte, devolve null", () => {
    expect(effectiveAge(null, "Sem dados pessoais aqui.", now)).toBeNull();
    expect(effectiveAge(null, null, now)).toBeNull();
  });
});

describe("inAgeRange", () => {
  it("sem limites, mostra todos (inclusive sem idade)", () => {
    expect(inAgeRange(null, {})).toBe(true);
    expect(inAgeRange(30, {})).toBe(true);
  });
  it("respeita mínimo e máximo, inclusive nas pontas", () => {
    expect(inAgeRange(18, { min: 18, max: 30 })).toBe(true);
    expect(inAgeRange(30, { min: 18, max: 30 })).toBe(true);
    expect(inAgeRange(17, { min: 18, max: 30 })).toBe(false);
    expect(inAgeRange(31, { min: 18, max: 30 })).toBe(false);
  });
  it("aceita só um dos limites", () => {
    expect(inAgeRange(50, { min: 18 })).toBe(true);
    expect(inAgeRange(50, { max: 40 })).toBe(false);
  });
  it("sem idade conhecida: aparece por padrão e some se o gestor pedir", () => {
    expect(inAgeRange(null, { min: 18, max: 30 })).toBe(true);
    expect(inAgeRange(null, { min: 18, max: 30, hideUnknown: true })).toBe(false);
  });
});

describe("formatBirthDate", () => {
  it("mostra a data e a idade a partir de Date", () => {
    expect(formatBirthDate(new Date("1990-03-05T00:00:00Z"), new Date(2026, 10, 2))).toBe(
      "05/03/1990 (36 anos)"
    );
  });

  it("mostra a data e a idade a partir de string brasileira DD/MM/AAAA", () => {
    expect(formatBirthDate("08/09/1985", new Date(2026, 10, 2))).toBe(
      "08/09/1985 (41 anos)"
    );
  });

  it("mostra a data e a idade a partir de string ISO YYYY-MM-DD", () => {
    expect(formatBirthDate("1985-09-08", new Date(2026, 10, 2))).toBe(
      "08/09/1985 (41 anos)"
    );
  });

  it("sem data devolve null", () => {
    expect(formatBirthDate(null)).toBeNull();
  });
});
