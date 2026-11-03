import { describe, expect, it } from "vitest";

import {
  filterCandidates,
  matchesName,
  type CandidateCvCard,
  type CvSearchFilters,
} from "@/server/models/cv-search.model";

const card = (id: string, name: string, resumeText = "") =>
  ({ id, name, email: `${id}@x.com`, job: { title: "Vaga" }, resumeText }) as CandidateCvCard;

const filters = (over: Partial<CvSearchFilters>): CvSearchFilters => ({
  keyword: "",
  selectedAreas: [],
  selectedLevels: [],
  selectedJobId: "",
  selectedStatus: "",
  minScore: null,
  onlyWithPhoto: false,
  onlyWithPdf: false,
  ...over,
});

describe("matchesName", () => {
  it("ignora acento, maiúscula e a ordem das palavras", () => {
    expect(matchesName("Marília Arcanjo Fernandes", "marilia")).toBe(true);
    expect(matchesName("João Alves", "JOAO")).toBe(true);
    expect(matchesName("Joana Darc Rocha Costa", "cos joa")).toBe(true);
    expect(matchesName("Maria D'Ávila", "avila")).toBe(true);
  });

  it("cada termo precisa ser o começo de uma palavra do nome", () => {
    expect(matchesName("Fernanda Costa", "ana")).toBe(false);
    expect(matchesName("Ana Paula Ramos", "ana")).toBe(true);
    expect(matchesName("Joana Costa", "joana silva")).toBe(false);
    expect(matchesName("Qualquer Um", "   ")).toBe(true);
  });
});

describe("filterCandidates", () => {
  const people = [
    card("1", "Ana Paula Ramos"),
    card("2", "Fernanda Costa", "Trabalhei uma semana na loja"),
    card("3", "João Alves", "Experiência em promoção de vendas"),
  ];

  it("busca por nome só olha o nome", () => {
    expect(filterCandidates(people, filters({ nameQuery: "ana" })).map((c) => c.id)).toEqual(["1"]);
  });

  it("palavra-chave no currículo também ignora acento", () => {
    expect(filterCandidates(people, filters({ keyword: "promocao" })).map((c) => c.id)).toEqual(["3"]);
    expect(filterCandidates(people, filters({ keyword: "joao" })).map((c) => c.id)).toEqual(["3"]);
  });
});

import { looksLikeCompanyName } from "@/server/models/cv-search.model";

describe("looksLikeCompanyName", () => {
  it("descarta mês e frase de atividade", () => {
    for (const bad of ["Agosto", "agosto 2019", "Ago.", "ATENTA ÀS NORMAS DA EMPRESA", "Responsável pelo caixa", "2019"]) {
      expect(looksLikeCompanyName(bad), bad).toBe(false);
    }
  });

  it("mantém nomes de empresa de verdade", () => {
    for (const ok of ["Fribal", "Aer Serviços", "AMAZONAS IMPORTAÇÕES E REPRESENTAÇÕES", "Atento Brasil S/A", "Bunge", "Canaã", "Pague Menos"]) {
      expect(looksLikeCompanyName(ok), ok).toBe(true);
    }
  });
});

import { extractCompaniesFromText } from "@/server/models/cv-search.model";

describe("extractCompaniesFromText", () => {
  it("corta no próximo rótulo quando vem tudo na mesma linha", () => {
    const found = extractCompaniesFromText(
      "Experiência profissional\nEmpresa: Atento Brasil S/A Função: Atendente\nEmpresa: Bunge Cargo: Promotor"
    );
    expect(found).toEqual(expect.arrayContaining(["Atento Brasil S/A", "Bunge"]));
    expect(found.some((f) => /fun[cç][aã]o|cargo/i.test(f))).toBe(false);
  });
});

import { computeNeighborhoodFacets } from "@/server/models/cv-search.model";

describe("computeNeighborhoodFacets", () => {
  it("padroniza a caixa e junta variações", () => {
    const facets = computeNeighborhoodFacets([
      { neighborhood: "JARDIM DAS OLIVEIRAS" },
      { neighborhood: "jardim das oliveiras" },
    ] as never);
    expect(facets).toEqual([{ key: "Jardim das Oliveiras", label: "Jardim das Oliveiras", count: 2 }]);
  });
});
