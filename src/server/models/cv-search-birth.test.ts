import { describe, it, expect } from "vitest";
import { extractBirthDateFromText, extractAgeFromText } from "./cv-search.model";

describe("extração de nascimento do currículo", () => {
  it("lê data numérica com rótulo", () => {
    const d = extractBirthDateFromText("Maria\nData de Nascimento: 12/03/1990\nExperiência 2015-2020");
    expect(d?.getUTCFullYear()).toBe(1990);
    expect(d?.getUTCMonth()).toBe(2);
  });
  it("lê data por extenso", () => {
    expect(extractBirthDateFromText("Nascido em 5 de março de 1988")?.getUTCFullYear()).toBe(1988);
  });
  it("ignora datas sem rótulo de nascimento", () => {
    expect(extractBirthDateFromText("Trabalhei de 01/02/2015 a 03/04/2018")).toBeNull();
  });
  it("lê DNS após estado civil", () => {
    const d = extractBirthDateFromText("Casada, DNS. 25/03/1986");
    expect(d?.getUTCFullYear()).toBe(1986);
    expect(d?.getUTCDate()).toBe(25);
    expect(extractBirthDateFromText("Solteiro, 10/05/1995")?.getUTCFullYear()).toBe(1995);
  });
  it("lê idade escrita", () => {
    expect(extractAgeFromText("Idade: 34 anos")).toBe(34);
  });
});

