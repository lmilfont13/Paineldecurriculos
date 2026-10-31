import { describe, expect, it } from "vitest";

import { nextToTriage, type CandidaturaRow } from "@/server/models/candidate-list.model";

const row = (id: string, status: string, createdAt: string) =>
  ({ id, status, createdAt, aiScore: null, aiMinScore: 70 }) as unknown as CandidaturaRow;

describe("nextToTriage", () => {
  it("devolve quem espera há mais tempo na triagem", () => {
    const rows = [
      row("novo", "PENDING", "2026-10-31T12:00:00.000Z"),
      row("antigo", "PENDING", "2026-10-29T09:00:00.000Z"),
      row("meio", "PENDING", "2026-10-30T09:00:00.000Z"),
    ];
    expect(nextToTriage(rows)?.id).toBe("antigo");
  });
  it("ignora quem já foi decidido", () => {
    const rows = [
      row("entrevista", "INTERVIEW", "2026-10-20T09:00:00.000Z"),
      row("aprovado", "APPROVED", "2026-10-21T09:00:00.000Z"),
      row("fila", "PENDING", "2026-10-30T09:00:00.000Z"),
    ];
    expect(nextToTriage(rows)?.id).toBe("fila");
  });
  it("fila vazia devolve null", () => {
    expect(nextToTriage([row("a", "APPROVED", "2026-10-20T09:00:00.000Z")])).toBeNull();
    expect(nextToTriage([])).toBeNull();
  });
});
