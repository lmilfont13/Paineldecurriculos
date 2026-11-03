import { describe, expect, it } from "vitest";

import { parseScoreResponse } from "@/server/models/ai.model";

describe("leitura da nota da IA", () => {
  it("JSON completo, com ou sem texto em volta", () => {
    expect(parseScoreResponse('{"score": 72, "reasoning": "Boa experiência."}')).toEqual({ score: 72, reasoning: "Boa experiência." });
    expect(parseScoreResponse('Aqui está:\n```json\n{"score": 40, "reasoning": "Pouca vivência."}\n```')).toEqual({ score: 40, reasoning: "Pouca vivência." });
  });

  it("JSON cortado no meio da justificativa (caso real do Haiku): aproveita a nota", () => {
    const raw = '{"score": 55, "reasoning": "Possui cerca de 13 anos de experiência em vendas e atendimento no varejo e atacado, além de conhec';
    expect(parseScoreResponse(raw)).toEqual({
      score: 55,
      reasoning: "Possui cerca de 13 anos de experiência em vendas e atendimento no varejo e atacado, além de conhec…",
    });
  });

  it("sem nota válida continua sendo erro", () => {
    expect(() => parseScoreResponse('{"reasoning": "sem nota"}')).toThrow(/Score inválido/);
    expect(() => parseScoreResponse('{"score": 140, "reasoning": "x"}')).toThrow(/Score inválido/);
    expect(() => parseScoreResponse("não sei")).toThrow(/Score inválido/);
  });
});
