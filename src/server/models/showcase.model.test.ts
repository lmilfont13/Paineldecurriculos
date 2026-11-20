import { describe, expect, it } from "vitest";

import { displayName, hireMonth, toPublicHires } from "@/server/models/showcase.model";

const row = (over: Partial<Parameters<typeof toPublicHires>[0][number]> = {}) => ({
  id: "a1",
  name: "maria  DA silva",
  jobTitle: "Promotor (a) de Merchandising - (Quixadá - CE)",
  jobLocation: "Quixadá, CE",
  approvedAt: new Date("2026-11-10T15:00:00Z"),
  ...over,
});

describe("vitrine de contratados", () => {
  it("arruma o nome", () => {
    expect(displayName("  JOÃO  dos SANTOS ")).toBe("João dos Santos");
  });

  it("mostra mês e ano curtos", () => {
    expect(hireMonth(new Date("2026-11-10T15:00:00Z"))).toBe("nov/2026");
  });

  it("monta nome, vaga sem a cidade, cidade e mês", () => {
    expect(toPublicHires([row()])).toEqual([
      { id: "a1", name: "Maria da Silva", role: "Promotor(a) de Merchandising", city: "Quixadá", month: "nov/2026" },
    ]);
  });

  it("deixa de fora conta excluída e ordena da contratação mais recente", () => {
    const list = toPublicHires([
      row({ id: "old", approvedAt: new Date("2026-09-01T12:00:00Z") }),
      row({ id: "gone", name: "Candidato(a) — conta excluída" }),
      row({ id: "new", approvedAt: new Date("2026-11-15T12:00:00Z") }),
    ]);
    expect(list.map((h) => h.id)).toEqual(["new", "old"]);
  });

  it("respeita o limite", () => {
    const rows = Array.from({ length: 20 }, (_, i) => row({ id: String(i) }));
    expect(toPublicHires(rows, 5)).toHaveLength(5);
  });
});
