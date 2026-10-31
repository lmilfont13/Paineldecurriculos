import { describe, expect, it } from "vitest";

import {
  buildReportData,
  criteriaCoverage,
  decisionIndex,
  percentileRank,
  scoreBands,
  scoreStats,
  type ReportCandidate,
} from "@/server/models/report.model";

describe("scoreStats", () => {
  it("calcula média, mediana, desvio-padrão amostral e quartis", () => {
    const s = scoreStats([60, 70, 80, 90])!;
    expect(s.n).toBe(4);
    expect(s.mean).toBe(75);
    expect(s.median).toBe(75);
    expect(s.stdDev).toBeCloseTo(12.9099, 3); // sqrt(500/3)
    expect(s.q1).toBe(67.5);
    expect(s.q3).toBe(82.5);
    expect([s.min, s.max]).toEqual([60, 90]);
  });
  it("um candidato só: desvio zero; nenhum: null", () => {
    expect(scoreStats([80])).toMatchObject({ n: 1, mean: 80, median: 80, stdDev: 0 });
    expect(scoreStats([])).toBeNull();
  });
  it("mediana de quantidade ímpar", () => {
    expect(scoreStats([10, 50, 90])!.median).toBe(50);
  });
});

describe("percentileRank", () => {
  it("conta quem está abaixo e metade dos empatados", () => {
    expect(percentileRank([60, 70, 80, 90], 80)).toBe(62.5);
    expect(percentileRank([60, 70, 80, 90], 90)).toBe(87.5);
    expect(percentileRank([60, 70, 80, 90], 60)).toBe(12.5);
  });
});

describe("criteriaCoverage", () => {
  it("sim vale 1, parcial 0,5, não 0, em porcentagem", () => {
    expect(
      criteriaCoverage([{ met: "sim" }, { met: "parcial" }, { met: "não" }, { met: "sim" }])
    ).toBe(62.5);
  });
  it("sem critérios avaliados devolve null", () => {
    expect(criteriaCoverage([])).toBeNull();
  });
});

describe("decisionIndex", () => {
  it("60% da nota da triagem + 40% da cobertura dos critérios", () => {
    expect(decisionIndex(80, 62.5)).toBe(73);
  });
  it("sem cobertura usa só a nota; sem nota não há índice", () => {
    expect(decisionIndex(80, null)).toBe(80);
    expect(decisionIndex(null, 70)).toBeNull();
  });
});

describe("scoreBands", () => {
  it("agrupa as notas em 5 faixas de 20 pontos", () => {
    const bands = scoreBands([5, 25, 45, 59, 60, 79, 80, 100]);
    expect(bands.map((b) => [b.label, b.count])).toEqual([
      ["0–19", 1],
      ["20–39", 1],
      ["40–59", 2],
      ["60–79", 2],
      ["80–100", 2],
    ]);
  });
});

const cand = (over: Partial<ReportCandidate>): ReportCandidate => ({
  id: "a",
  name: "A",
  status: "PENDING",
  aiScore: 70,
  aiReasoning: null,
  criteria: [],
  aiProfile: null,
  aiArea: null,
  aiLevel: null,
  salaryExpectation: null,
  availability: null,
  city: null,
  neighborhood: null,
  createdAt: new Date("2026-10-30T12:00:00Z"),
  ...over,
});

describe("buildReportData", () => {
  const now = new Date("2026-11-01T12:00:00Z");
  const job = { title: "Promotor de Vendas", code: "1124", aiMinScore: 70, criteria: ["Vendas", "Ensino médio"] };

  const data = buildReportData(
    job,
    [
      cand({ id: "ana", name: "Ana", aiScore: 90, criteria: [{ criterion: "Vendas", met: "sim" }, { criterion: "Ensino médio", met: "sim" }] }),
      cand({ id: "bia", name: "Bia", aiScore: 88, criteria: [{ criterion: "Vendas", met: "sim" }, { criterion: "Ensino médio", met: "não" }] }),
      cand({ id: "caio", name: "Caio", aiScore: 50, criteria: [{ criterion: "Vendas", met: "não" }, { criterion: "Ensino médio", met: "sim" }] }),
      cand({ id: "rej", name: "Rej", aiScore: 95, status: "REJECTED" }),
      cand({ id: "sem", name: "Sem", aiScore: null }),
    ],
    now
  );

  it("ranqueia pelo índice de decisão e deixa de fora reprovados e sem análise", () => {
    expect(data.ranking.map((r) => r.id)).toEqual(["ana", "bia", "caio"]);
    expect(data.ranking.map((r) => r.position)).toEqual([1, 2, 3]);
    // Ana: 0,6*90 + 0,4*100 = 94 ; Bia: 0,6*88 + 0,4*50 = 72,8
    expect(data.ranking[0].index).toBe(94);
    expect(data.ranking[1].index).toBeCloseTo(72.8, 5);
  });
  it("distância ao corte e atendimento do mínimo", () => {
    expect(data.ranking[0].gapToCutoff).toBe(20);
    expect(data.ranking[2].gapToCutoff).toBe(-20);
    expect(data.totals.meetsMinimum).toBe(2);
    expect(data.totals.analyzed).toBe(3); // ativos com nota (sem o reprovado)
    expect(data.totals.active).toBe(4); // sem o reprovado
    expect(data.totals.total).toBe(5);
  });
  it("margem entre o 1º e o 2º colocado", () => {
    expect(data.margin).toBeCloseTo(21.2, 5);
  });
  it("contagem por etapa e espera média em dias", () => {
    expect(data.stage.find((s) => s.status === "PENDING")?.count).toBe(4);
    expect(data.stage.find((s) => s.status === "REJECTED")?.count).toBe(1);
    expect(data.avgWaitDays).toBeCloseTo(2, 5); // quem está em triagem espera 2 dias
  });
  it("sem candidatos devolve estrutura vazia sem quebrar", () => {
    const empty = buildReportData(job, [], now);
    expect(empty.ranking).toEqual([]);
    expect(empty.stats).toBeNull();
    expect(empty.margin).toBeNull();
    expect(empty.totals.total).toBe(0);
  });
});

import { executiveSummary } from "@/server/models/report.model";

describe("executiveSummary", () => {
  const job = { title: "Vaga", code: "1", aiMinScore: 70, criteria: ["X"] };
  const mk = (scores: [string, number][]) =>
    buildReportData(
      job,
      scores.map(([name, aiScore]) => cand({ id: name, name, aiScore, criteria: [{ criterion: "X", met: "sim" }] })),
      new Date("2026-11-01T12:00:00Z")
    );

  it("sem candidatos analisados, diz isso e não inventa recomendação", () => {
    const s = executiveSummary(mk([]));
    expect(s.headline).toMatch(/ainda não há candidatos analisados/i);
    expect(s.bullets).toEqual([]);
  });
  it("vantagem clara (10+ pontos de índice)", () => {
    const s = executiveSummary(mk([["Ana", 95], ["Bia", 70]]));
    expect(s.headline).toContain("Ana");
    expect(s.bullets[0]).toMatch(/vantagem clara/i);
    expect(s.bullets[0]).toContain("Bia");
  });
  it("disputa acirrada (menos de 3 pontos) recomenda entrevistar os dois", () => {
    const s = executiveSummary(mk([["Ana", 90], ["Bia", 89]]));
    expect(s.bullets[0]).toMatch(/disputa acirrada/i);
    expect(s.bullets[0]).toMatch(/entrevistar os dois/i);
  });
  it("informa quantos atendem o mínimo", () => {
    const s = executiveSummary(mk([["Ana", 90], ["Bia", 80], ["Caio", 40]]));
    expect(s.bullets.join(" ")).toMatch(/2 de 3 candidatos analisados/);
  });
});

describe("ranking: quem atende o corte vem antes de quem não atende", () => {
  it("candidato abaixo do corte não passa à frente de quem atende, mesmo com índice maior", () => {
    const job = { title: "Vaga", code: null, aiMinScore: 70, criteria: ["X"] };
    const data = buildReportData(
      job,
      [
        // índice alto, mas abaixo do corte: 0,6×68 + 0,4×100 = 80,8
        cand({ id: "abaixo", name: "Abaixo", aiScore: 68, criteria: [{ criterion: "X", met: "sim" }] }),
        // índice menor, mas atende o corte: 0,6×72 + 0,4×0 = 43,2
        cand({ id: "atende", name: "Atende", aiScore: 72, criteria: [{ criterion: "X", met: "não" }] }),
      ],
      new Date("2026-11-01T12:00:00Z")
    );
    expect(data.ranking.map((r) => r.id)).toEqual(["atende", "abaixo"]);
  });
});

describe("fichas de cada candidato", () => {
  const job = { title: "Vaga", code: null, aiMinScore: 70, criteria: ["X"] };
  const data = buildReportData(
    job,
    [
      cand({
        id: "ana",
        name: "Ana",
        aiScore: 90,
        aiReasoning: "Experiência sólida em vendas.",
        criteria: [{ criterion: "X", met: "sim", evidence: "5 anos como vendedora" }],
      }),
      cand({ id: "sem", name: "Sem análise", aiScore: null }),
      cand({ id: "rej", name: "Reprovado", aiScore: 20, status: "REJECTED" }),
    ],
    new Date("2026-11-01T12:00:00Z")
  );

  it("mantém a leitura da IA e a evidência de cada critério exatamente como gravadas", () => {
    expect(data.ranking[0].aiReasoning).toBe("Experiência sólida em vendas.");
    expect(data.ranking[0].criteria[0]).toEqual({ criterion: "X", met: "sim", evidence: "5 anos como vendedora" });
  });
  it("quem está ativo e ainda sem análise aparece depois do ranking; reprovado não aparece", () => {
    expect(data.unranked.map((c) => c.id)).toEqual(["sem"]);
    expect(data.ranking.map((c) => c.id)).toEqual(["ana"]);
  });
});

import { criteriaSummary } from "@/server/models/report.model";

describe("criteriaSummary", () => {
  const job = { title: "Vaga", code: null, aiMinScore: 70, criteria: ["Vendas", "Capilares"] };
  const data = buildReportData(
    job,
    [
      cand({ id: "a", aiScore: 90, criteria: [{ criterion: "Vendas", met: "sim" }, { criterion: "Capilares", met: "sim" }] }),
      cand({ id: "b", aiScore: 80, criteria: [{ criterion: "Vendas", met: "sim" }, { criterion: "Capilares", met: "não" }] }),
      cand({ id: "c", aiScore: 75, criteria: [{ criterion: "Vendas", met: "parcial" }, { criterion: "Capilares", met: "não" }] }),
      cand({ id: "d", aiScore: 60, criteria: [{ criterion: "Vendas", met: "não" }, { criterion: "Capilares", met: "não" }] }),
    ],
    new Date("2026-11-01T12:00:00Z")
  );

  it("conta, por critério da vaga, quantos atendem, atendem em parte e não atendem", () => {
    const [vendas, capilares] = criteriaSummary(data);
    expect(vendas).toMatchObject({ criterion: "Vendas", sim: 2, parcial: 1, nao: 1, total: 4 });
    expect(capilares).toMatchObject({ criterion: "Capilares", sim: 1, parcial: 0, nao: 3, total: 4 });
  });
  it("percentual de quem atende e marca o critério escasso (menos de 1/3 atende)", () => {
    const [vendas, capilares] = criteriaSummary(data);
    expect(vendas.pctSim).toBe(50);
    expect(vendas.scarce).toBe(false);
    expect(capilares.pctSim).toBe(25);
    expect(capilares.scarce).toBe(true);
  });
  it("candidato sem esse critério avaliado não entra na conta dele", () => {
    const d = buildReportData(job, [cand({ id: "x", aiScore: 80, criteria: [{ criterion: "Vendas", met: "sim" }] })], new Date());
    const capilares = criteriaSummary(d).find((c) => c.criterion === "Capilares")!;
    expect(capilares.total).toBe(0);
    expect(capilares.pctSim).toBe(0);
  });
});
