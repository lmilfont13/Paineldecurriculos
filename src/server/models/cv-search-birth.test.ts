import { describe, it, expect } from "vitest";
import { filterCandidates, type CandidateCvCard } from "./cv-search.model";
import { extractBirthDateFromText, extractAgeFromText, extractNeighborhoodFromText, normalizeText } from "./cv-search.model";

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
  it("lê idade com data entre parênteses", () => {
    const d = extractBirthDateFromText("Daniel, 34 anos (07/08/1992)");
    expect(d?.getUTCFullYear()).toBe(1992);
    expect(d?.getUTCMonth()).toBe(7);
  });
  it("lê idade escrita", () => {
    expect(extractAgeFromText("Idade: 34 anos")).toBe(34);
  });
});



describe("bairro", () => {
  it("extrai bairro do endereço", () => {
    expect(extractNeighborhoodFromText("Endereço: Rua A, 10 - Bairro: José Walter, Fortaleza")).toBe("José Walter");
  });
  it("compara sem acento", () => {
    expect(normalizeText("José  Walter")).toBe(normalizeText("jose walter"));
  });
});


describe("empresa anterior", () => {
  const base = { minScore: null, onlyWithPhoto: false, onlyWithPdf: false, keyword: "", selectedAreas: [], selectedLevels: [], selectedJobId: "", selectedStatus: "" } as never;
  it("filtra por empresa no historico, sem acento", () => {
    const list = [{ id: "1", name: "A", resumeText: "Atuei no Assaí Atacadista 2019-2022" }, { id: "2", name: "B", resumeText: "Trabalhei na Pague Menos" }] as unknown as CandidateCvCard[];
    const r = filterCandidates(list, { ...(base as object), previousCompany: "assai" } as never);
    expect(r.map((x) => x.id)).toEqual(["1"]);
    const r2 = filterCandidates(list, { ...(base as object), previousCompany: "assai, pague menos" } as never);
    expect(r2).toHaveLength(2);
  });
});

