import { describe, expect, it } from "vitest";

import { effectiveAge, inAgeRange } from "@/server/models/age.model";

describe("effectiveAge", () => {
  const now = new Date("2026-11-01T12:00:00Z");

  it("usa a data de nascimento informada", () => {
    expect(effectiveAge(new Date("1990-03-12"), null, now)).toBe(36);
  });
  it("sem data, lê o currículo", () => {
    expect(effectiveAge(null, "Maria\nData de Nascimento: 12/03/1990\nExperiência", now)).toBe(36);
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
