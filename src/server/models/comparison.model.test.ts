import { describe, expect, it } from "vitest";

import {
  buildComparisonPrompt,
  computedRecommendation,
  parseComparison,
  type ComparisonCandidate,
} from "@/server/models/comparison.model";

const cand = (over: Partial<ComparisonCandidate>): ComparisonCandidate => ({
  id: "a",
  name: "Maria Souza",
  status: "PENDING",
  aiScore: 80,
  aiReasoning: "Boa experiência.",
  aiProfile: "Vendedora",
  aiArea: null,
  aiLevel: "Pleno",
  aiChecklist: [{ criterion: "Vendas", met: "sim", evidence: "5 anos" }],
  resumeText: "Maria Souza maria@x.com (85) 98888-7777. Vendedora há 5 anos.",
  jobTitle: "Consultor de Vendas",
  jobCode: "1123",
  jobRequirements: "• Vendas",
  jobCriteria: ["Vendas"],
  aiMinScore: 70,
  ...over,
});

describe("buildComparisonPrompt", () => {
  const built = buildComparisonPrompt([
    cand({ id: "real-1" }),
    cand({ id: "real-2", name: "João Lima", aiScore: 60, resumeText: "João Lima joao@x.com. Caixa." }),
  ]);

  it("identifica por rótulo e não deixa vazar id, nome, e-mail ou telefone", () => {
    expect(built.prompt).toContain("C1");
    expect(built.prompt).toContain("C2");
    for (const leak of ["real-1", "real-2", "Maria", "Souza", "João", "Lima", "maria@x.com", "joao@x.com", "98888-7777"]) {
      expect(built.prompt).not.toContain(leak);
    }
    expect(built.system).toMatch(/ignore nome/i);
  });
  it("leva a vaga, o corte, as notas e o checklist", () => {
    expect(built.prompt).toContain("Consultor de Vendas");
    expect(built.prompt).toContain("1123");
    expect(built.prompt).toContain("70");
    expect(built.prompt).toContain("80");
    expect(built.prompt).toContain("Vendas = sim");
  });
  it("devolve o mapa rótulo → candidatura", () => {
    expect(built.labelToId).toEqual({ C1: "real-1", C2: "real-2" });
  });
});

describe("parseComparison", () => {
  const map = { C1: "id1", C2: "id2", C3: "id3" };
  const ok = {
    recomendado: "C2",
    confianca: "alta",
    resumo: "C2 cobre mais critérios.",
    motivos: ["Mais experiência", "Atende o corte"],
    por_candidato: [
      { candidato: "C1", pontos_fortes: ["Disponível"], pontos_atencao: ["Sem experiência"], por_que_nao: "Menos aderente" },
      { candidato: "C2", pontos_fortes: ["Experiência"], pontos_atencao: [] },
    ],
    confirmar_na_entrevista: "Disponibilidade de horários.",
  };

  it("lê a recomendação, troca rótulos por ids e mantém os motivos", () => {
    const r = parseComparison(JSON.stringify(ok), map)!;
    expect(r.recommendedId).toBe("id2");
    expect(r.confidence).toBe("alta");
    expect(r.reasons).toEqual(["Mais experiência", "Atende o corte"]);
    expect(r.perCandidate.find((p) => p.id === "id1")).toMatchObject({ concerns: ["Sem experiência"], whyNot: "Menos aderente" });
    expect(r.checkNext).toBe("Disponibilidade de horários.");
  });
  it("aceita JSON em bloco de código com texto em volta", () => {
    const raw = "Segue:\n```json\n" + JSON.stringify(ok) + "\n```";
    expect(parseComparison(raw, map)?.recommendedId).toBe("id2");
  });
  it("recomendado desconhecido ou 'empate' vira sem recomendação, sem quebrar", () => {
    expect(parseComparison(JSON.stringify({ ...ok, recomendado: "empate" }), map)?.recommendedId).toBeNull();
    expect(parseComparison(JSON.stringify({ ...ok, recomendado: "C9" }), map)?.recommendedId).toBeNull();
  });
  it("confiança inválida vira média", () => {
    expect(parseComparison(JSON.stringify({ ...ok, confianca: "??" }), map)?.confidence).toBe("media");
  });
  it("resposta ilegível devolve null", () => {
    expect(parseComparison("sem json", map)).toBeNull();
    expect(parseComparison('{"resumo": 1}', map)).toBeNull();
  });
});

describe("computedRecommendation (sem IA)", () => {
  it("quem atende o corte e tem maior índice vence, com a margem", () => {
    const r = computedRecommendation([
      cand({ id: "a", aiScore: 95, aiChecklist: [{ criterion: "Vendas", met: "sim", evidence: "" }] }),
      cand({ id: "b", aiScore: 70, aiChecklist: [{ criterion: "Vendas", met: "não", evidence: "" }] }),
    ]);
    expect(r.recommendedId).toBe("a");
    expect(r.margin).toBeGreaterThan(10);
  });
  it("quem atende o corte vem antes de quem não atende, mesmo com índice maior", () => {
    const r = computedRecommendation([
      cand({ id: "abaixo", aiScore: 68, aiChecklist: [{ criterion: "Vendas", met: "sim", evidence: "" }] }),
      cand({ id: "atende", aiScore: 72, aiChecklist: [{ criterion: "Vendas", met: "não", evidence: "" }] }),
    ]);
    expect(r.recommendedId).toBe("atende");
  });
  it("candidatos sem nota não são recomendados; sem nenhum com nota, não há recomendação", () => {
    expect(computedRecommendation([cand({ id: "a", aiScore: null }), cand({ id: "b", aiScore: null })]).recommendedId).toBeNull();
  });
});

import { labelsToNames } from "@/server/models/comparison.model";

describe("labelsToNames", () => {
  const names = { C1: "Clara Falcão", C2: "Vanessa Carvalho", C3: "Ana Paula Silva" };

  it("troca o rótulo pelo nome e descarta o artigo que vinha na frente", () => {
    expect(labelsToNames("O C3 é o candidato mais forte.", names)).toBe("Ana Paula Silva é o candidato mais forte.");
    expect(labelsToNames("Perguntar a C1 sobre horários.", names)).toBe("Perguntar a Clara Falcão sobre horários.");
    expect(labelsToNames("C2 superou C1 em experiência.", names)).toBe("Vanessa Carvalho superou Clara Falcão em experiência.");
  });
  it("troca rótulos soltos e repetidos", () => {
    expect(labelsToNames("C2 tem menos experiência que C3; C2 ficou em segundo.", names)).toBe(
      "Vanessa Carvalho tem menos experiência que Ana Paula Silva; Vanessa Carvalho ficou em segundo."
    );
  });
  it("não mexe em siglas parecidas nem em rótulo desconhecido", () => {
    expect(labelsToNames("Cursa ADS e usa o CRM. C9 não existe.", names)).toBe("Cursa ADS e usa o CRM. C9 não existe.");
  });
});
