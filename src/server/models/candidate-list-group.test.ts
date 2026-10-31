import { describe, expect, it } from "vitest";

import {
  groupRowsByJob,
  jobLabel,
  type CandidaturaRow,
} from "@/server/models/candidate-list.model";

const row = (id: string, jobId: string, jobTitle = "Promotor de Vendas", jobCode: string | null = null) =>
  ({ id, jobId, jobTitle, jobCode }) as CandidaturaRow;

describe("jobLabel", () => {
  it("junta cargo e código para diferenciar vagas iguais", () => {
    expect(jobLabel("Promotor de Vendas", "1123")).toBe("Promotor de Vendas #1123");
  });
  it("sem código mostra só o cargo", () => {
    expect(jobLabel("Promotor de Vendas", null)).toBe("Promotor de Vendas");
    expect(jobLabel("Promotor de Vendas", "  ")).toBe("Promotor de Vendas");
  });
});

describe("groupRowsByJob", () => {
  it("junta as candidaturas de cada vaga, mantendo a ordem dentro do grupo", () => {
    const rows = [row("a", "j1"), row("b", "j2"), row("c", "j1"), row("d", "j2")];
    expect(groupRowsByJob(rows).map((r) => r.id)).toEqual(["a", "c", "b", "d"]);
  });
  it("vagas com o mesmo cargo continuam separadas pelo id da vaga", () => {
    const rows = [row("a", "j1", "Promotor"), row("b", "j2", "Promotor"), row("c", "j1", "Promotor")];
    expect(groupRowsByJob(rows).map((r) => r.jobId)).toEqual(["j1", "j1", "j2"]);
  });
  it("lista vazia continua vazia", () => {
    expect(groupRowsByJob([])).toEqual([]);
  });
});
