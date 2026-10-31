import { describe, expect, it } from "vitest";

import {
  dedupeCandidatesByPerson,
  type CandidateCvCard,
} from "@/server/models/cv-search.model";

const card = (
  id: string,
  email: string,
  aiScore: number | null,
  createdAt = "2026-10-01T10:00:00.000Z"
) => ({ id, email, aiScore, createdAt }) as CandidateCvCard;

describe("dedupeCandidatesByPerson", () => {
  it("mostra a pessoa uma vez, com a candidatura de maior nota", () => {
    const out = dedupeCandidatesByPerson([
      card("a", "gabriel@x.com", 70),
      card("b", "gabriel@x.com", 85),
    ]);
    expect(out.map((c) => c.id)).toEqual(["b"]);
  });
  it("e-mail com caixa ou espaço diferente é a mesma pessoa", () => {
    const out = dedupeCandidatesByPerson([
      card("a", " Gabriel@X.com", 50),
      card("b", "gabriel@x.com ", 50, "2026-10-05T10:00:00.000Z"),
    ]);
    expect(out.map((c) => c.id)).toEqual(["b"]); // empate: a mais recente
  });
  it("nota vence candidatura ainda sem análise", () => {
    const out = dedupeCandidatesByPerson([
      card("a", "m@x.com", null, "2026-10-09T10:00:00.000Z"),
      card("b", "m@x.com", 40),
    ]);
    expect(out.map((c) => c.id)).toEqual(["b"]);
  });
  it("pessoas diferentes continuam todas, na ordem de chegada", () => {
    const out = dedupeCandidatesByPerson([
      card("a", "a@x.com", 10),
      card("b", "b@x.com", 90),
      card("c", "a@x.com", 20),
    ]);
    expect(out.map((c) => c.id)).toEqual(["c", "b"]);
  });
  it("conta excluída (e-mail sem @) não junta pessoas diferentes", () => {
    const out = dedupeCandidatesByPerson([
      card("a", "conta-excluida", 10),
      card("b", "conta-excluida", 20),
    ]);
    expect(out).toHaveLength(2);
  });
});
