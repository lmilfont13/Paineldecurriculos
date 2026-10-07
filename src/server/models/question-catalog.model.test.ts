import { describe, expect, it } from "vitest";

import {
  QUESTION_CATALOG,
  findCatalogQuestion,
  suggestQuestions,
} from "@/server/models/question-catalog.model";

const PROMOTOR = `Promotor(a) de Vendas – Laticínios e Frios. Roteiro fixo: 5 lojas de
segunda a sexta e 2 aos sábados. Manipular, cortar e fatiar frios. Repor conforme
planograma. Ensino médio completo. 18 anos ou mais. Ambientes frios. Presencial.`;

describe("suggestQuestions", () => {
  it("recomenda as perguntas que combinam com a vaga de promotor", () => {
    const recommended = suggestQuestions(PROMOTOR, [])
      .filter((q) => q.recommended)
      .map((q) => q.id);
    for (const id of ["sabado", "ensino-medio", "maioridade", "frio", "sanitario", "promotor", "laticinios", "fatiamento", "planograma", "bairro", "roteiro"]) {
      expect(recommended).toContain(id);
    }
    expect(recommended).not.toContain("cnh");
    expect(recommended).not.toContain("viagem");
  });

  it("recomendadas vêm primeiro e nada se perde", () => {
    const list = suggestQuestions(PROMOTOR, []);
    const firstOther = list.findIndex((q) => !q.recommended);
    expect(list.slice(firstOther).every((q) => !q.recommended)).toBe(true);
    expect(list).toHaveLength(QUESTION_CATALOG.length);
  });

  it("esconde o que já é perguntado, ignorando acento e caixa", () => {
    const list = suggestQuestions(PROMOTOR, ["CONCLUIU O ENSINO MEDIO?"]);
    expect(list.find((q) => q.id === "ensino-medio")).toBeUndefined();
  });
});

describe("banco de perguntas", () => {
  it("não pergunta nada discriminatório", () => {
    const labels = QUESTION_CATALOG.map((q) => q.label.toLowerCase()).join(" | ");
    for (const banned of ["sexo", "gênero", "estado civil", "filhos", "religi", "foto", "cor ", "raça"]) {
      expect(labels).not.toContain(banned);
    }
  });

  it("ids únicos e dropdowns com opções", () => {
    expect(new Set(QUESTION_CATALOG.map((q) => q.id)).size).toBe(QUESTION_CATALOG.length);
    for (const q of QUESTION_CATALOG.filter((q) => q.type === "DROPDOWN")) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
    }
    expect(findCatalogQuestion("nada")).toBeNull();
  });
});
