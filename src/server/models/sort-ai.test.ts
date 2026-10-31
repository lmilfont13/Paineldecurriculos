import { describe, expect, it } from "vitest";

import { aiRankInGroups, sortRows, type CandidaturaRow } from "@/server/models/candidate-list.model";

const row = (id: string, jobId: string, aiScore: number | null, aiIndex: number | null, aiMinScore = 70) =>
  ({ id, jobId, aiScore, aiIndex, aiMinScore, createdAt: "2026-10-30T12:00:00.000Z" }) as unknown as CandidaturaRow;

describe("sortRows por indicação da IA", () => {
  it("quem atende o corte vem antes; depois o índice; sem nota por último", () => {
    const rows = [
      row("abaixo", "j", 68, 80.8), // índice alto, mas abaixo do corte
      row("atende", "j", 72, 43.2),
      row("topo", "j", 90, 94),
      row("sem", "j", null, null),
    ];
    expect(sortRows(rows, "AI").map((r) => r.id)).toEqual(["topo", "atende", "abaixo", "sem"]);
  });
  it("empate de índice desempata pela nota", () => {
    const rows = [row("a", "j", 80, 85), row("b", "j", 90, 85)];
    expect(sortRows(rows, "AI").map((r) => r.id)).toEqual(["b", "a"]);
  });
  it("sem índice calculado usa a nota", () => {
    const rows = [row("a", "j", 75, null), row("b", "j", 95, null)];
    expect(sortRows(rows, "AI").map((r) => r.id)).toEqual(["b", "a"]);
  });
});

describe("aiRankInGroups", () => {
  it("numera 1º, 2º... dentro de cada vaga, na ordem recebida", () => {
    const rows = [row("a1", "A", 90, 90), row("b1", "B", 80, 80), row("a2", "A", 70, 70), row("b2", "B", 60, 60)];
    const ranks = aiRankInGroups(rows);
    expect(ranks.get("a1")).toBe(1);
    expect(ranks.get("a2")).toBe(2);
    expect(ranks.get("b1")).toBe(1);
    expect(ranks.get("b2")).toBe(2);
  });
  it("candidato sem nota não recebe posição", () => {
    const ranks = aiRankInGroups([row("a", "A", 90, 90), row("s", "A", null, null)]);
    expect(ranks.has("s")).toBe(false);
  });
});
