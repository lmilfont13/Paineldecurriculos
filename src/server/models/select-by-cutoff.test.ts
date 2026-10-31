import { describe, expect, it } from "vitest";

import { selectByCutoff, type CandidaturaRow } from "@/server/models/candidate-list.model";

const row = (id: string, aiScore: number | null, aiMinScore: number) =>
  ({ id, aiScore, aiMinScore }) as unknown as CandidaturaRow;

const rows = [
  row("acima-a", 90, 70),
  row("limite", 70, 70), // atende (>=)
  row("abaixo-a", 69, 70),
  row("abaixo-b", 40, 70),
  row("sem", null, 70),
  // outra vaga, corte diferente: 60 atende lá, mas não atenderia na de 70
  row("acima-b", 60, 50),
];

describe("selectByCutoff", () => {
  it("todos", () => {
    expect(selectByCutoff(rows, "ALL")).toHaveLength(6);
  });
  it("acima do corte: usa o corte da vaga de cada candidato (nota igual ao corte atende)", () => {
    expect(selectByCutoff(rows, "ABOVE").map((r) => r.id)).toEqual(["acima-a", "limite", "acima-b"]);
  });
  it("abaixo do corte: só quem tem nota e ficou abaixo", () => {
    expect(selectByCutoff(rows, "BELOW").map((r) => r.id)).toEqual(["abaixo-a", "abaixo-b"]);
  });
  it("sem análise", () => {
    expect(selectByCutoff(rows, "UNANALYZED").map((r) => r.id)).toEqual(["sem"]);
  });
});
