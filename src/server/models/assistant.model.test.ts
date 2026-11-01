import { describe, expect, it } from "vitest";

import {
  buildAssistantPrompt,
  pickForAssistant,
  resolveLabels,
  type AssistantRow,
} from "@/server/models/assistant.model";

const row = (id: string, over: Partial<AssistantRow> = {}): AssistantRow => ({
  id,
  name: `Pessoa ${id}`,
  jobId: "j1",
  jobTitle: "Promotor de Vendas",
  status: "PENDING",
  aiScore: 70,
  aiReasoning: "Experiência em vendas.",
  aiProfile: "Vendedor",
  aiArea: "Vendas",
  aiLevel: "Pleno",
  neighborhood: "Messejana",
  city: "Fortaleza",
  availability: "Imediata",
  salaryExpectation: "R$ 1.800",
  ...over,
});

describe("pickForAssistant", () => {
  it("tira reprovados, ordena pela nota e respeita o limite", () => {
    const rows = [row("a", { aiScore: 50 }), row("b", { aiScore: 90 }), row("c", { status: "REJECTED", aiScore: 99 }), row("d", { aiScore: null })];
    expect(pickForAssistant(rows, 2).map((r) => r.id)).toEqual(["b", "a"]);
    expect(pickForAssistant(rows, 10).map((r) => r.id)).toEqual(["b", "a", "d"]);
  });
});

describe("buildAssistantPrompt", () => {
  const job = { title: "Consultor de Vendas", requirements: "Ensino médio", criteria: ["Vendas"], minScore: 70 };

  it("identifica por rótulo e não manda nome nem contato à IA", () => {
    const { prompt, labelToRef } = buildAssistantPrompt(job, [row("a", { aiReasoning: "Pessoa a, e-mail a@x.com, fala bem." })], "tem opção melhor?");
    expect(labelToRef).toEqual({ C1: { id: "a", name: "Pessoa a" } });
    expect(prompt).toContain("C1");
    expect(prompt).toContain("tem opção melhor?");
    expect(prompt).not.toContain("Pessoa a");
    expect(prompt).not.toContain("a@x.com");
  });
  it("diz de qual vaga é cada candidato", () => {
    const { prompt } = buildAssistantPrompt(job, [row("a", { jobId: "j2", jobTitle: "Auxiliar de Loja" })], "?");
    expect(prompt).toContain("Auxiliar de Loja");
  });
});

describe("resolveLabels", () => {
  const map = { C1: { id: "a", name: "Maria Souza" }, C12: { id: "b", name: "João Lima" } };

  it("troca o rótulo pelo nome e lista quem foi citado, sem repetir", () => {
    const out = resolveLabels("C12 é melhor que C1. C12 também tem disponibilidade.", map);
    expect(out.text).toBe("João Lima é melhor que Maria Souza. João Lima também tem disponibilidade.");
    expect(out.mentioned).toEqual([
      { id: "b", name: "João Lima" },
      { id: "a", name: "Maria Souza" },
    ]);
  });
  it("não mexe em rótulos desconhecidos nem em palavras parecidas", () => {
    expect(resolveLabels("C99 e CAIXA1", map).text).toBe("C99 e CAIXA1");
  });
});
