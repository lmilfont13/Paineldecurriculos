import { describe, expect, it } from "vitest";

import {
  buildPortfolio,
  parseSalary,
  portfolioInsights,
  salaryBands,
  topCounts,
  type PortfolioApplication,
  type PortfolioJob,
} from "@/server/models/portfolio.model";

describe("parseSalary", () => {
  it("lê os formatos que o candidato digita", () => {
    expect(parseSalary("2200")).toBe(2200);
    expect(parseSalary("R$ 2.200,00")).toBe(2200);
    expect(parseSalary("2.000")).toBe(2000);
    expect(parseSalary("2000,50")).toBe(2000.5);
    expect(parseSalary("R$ 1.500")).toBe(1500);
  });
  it("em faixa ('1.800 a 2.000') usa o primeiro valor", () => {
    expect(parseSalary("1.800 a 2.000")).toBe(1800);
  });
  it("texto sem valor ou valor absurdo vira null", () => {
    expect(parseSalary("a combinar")).toBeNull();
    expect(parseSalary("50")).toBeNull();
    expect(parseSalary("999999999")).toBeNull();
    expect(parseSalary(null)).toBeNull();
    expect(parseSalary("")).toBeNull();
  });
});

describe("salaryBands", () => {
  it("agrupa em faixas de R$ 500", () => {
    const bands = salaryBands([1400, 1500, 1999, 2000, 2600, 3500, 5000]);
    expect(bands.map((b) => [b.label, b.count])).toEqual([
      ["até 1.499", 1],
      ["1.500–1.999", 2],
      ["2.000–2.499", 1],
      ["2.500–2.999", 1],
      ["3.000 ou mais", 2],
    ]);
  });
});

describe("topCounts", () => {
  it("conta, ordena e junta o resto em 'Outros'", () => {
    const out = topCounts(["A", "B", "A", "C", "A", "B", "D", "E"], 2);
    expect(out).toEqual([
      { label: "A", count: 3 },
      { label: "B", count: 2 },
      { label: "Outros", count: 3 },
    ]);
  });
  it("ignora vazios e não cria 'Outros' sem sobra", () => {
    expect(topCounts(["A", "", null, undefined, " A "], 3)).toEqual([{ label: "A", count: 2 }]);
  });
  it("normaliza caixa e espaço para somar a mesma coisa", () => {
    expect(topCounts(["messejana", "Messejana ", "MESSEJANA"], 3)).toEqual([{ label: "Messejana", count: 3 }]);
  });
});

const job = (over: Partial<PortfolioJob>): PortfolioJob => ({
  id: "j1",
  title: "Promotor de Vendas",
  code: "1124",
  status: "OPEN",
  location: "Fortaleza, CE",
  aiMinScore: 70,
  criteria: ["Vendas", "Capilares"],
  createdAt: new Date("2026-10-25T12:00:00Z"),
  ...over,
});

const app = (over: Partial<PortfolioApplication>): PortfolioApplication => ({
  id: "a",
  name: "Ana",
  email: "ana@x.com",
  jobId: "j1",
  status: "PENDING",
  aiScore: 80,
  aiReasoning: null,
  criteria: [
    { criterion: "Vendas", met: "sim" },
    { criterion: "Capilares", met: "não" },
  ],
  aiProfile: "Promotora",
  aiArea: "Vendas",
  aiLevel: "Pleno",
  salaryExpectation: "2200",
  availability: "Imediata",
  city: "Fortaleza",
  neighborhood: "Messejana",
  hasCnh: null,
  workPreference: null,
  createdAt: new Date("2026-10-30T12:00:00Z"),
  ...over,
});

describe("buildPortfolio", () => {
  const now = new Date("2026-11-01T12:00:00Z");
  const jobs = [job({}), job({ id: "j2", title: "Consultor", code: "1123", location: "Caucaia, CE" }), job({ id: "j3", status: "CLOSED" })];
  const apps = [
    app({ id: "1", jobId: "j1", email: "ana@x.com", aiScore: 90 }),
    app({ id: "2", jobId: "j1", email: "bia@x.com", name: "Bia", aiScore: 50, aiLevel: "Júnior", neighborhood: "Aldeota" }),
    // a mesma pessoa em outra vaga: conta uma vez no perfil
    app({ id: "3", jobId: "j2", email: "Ana@x.com", aiScore: 85, createdAt: new Date("2026-10-31T12:00:00Z") }),
    app({ id: "4", jobId: "j2", email: "caio@x.com", name: "Caio", status: "REJECTED", aiScore: 30 }),
    app({ id: "5", jobId: "j2", email: "dani@x.com", name: "Dani", aiScore: null, salaryExpectation: "a combinar" }),
  ];
  const p = buildPortfolio(jobs, apps, now);

  it("conta vagas por situação e candidaturas totais", () => {
    expect(p.totals.jobs).toMatchObject({ total: 3, open: 2, closed: 1, paused: 0, draft: 0 });
    expect(p.totals.applications).toBe(5);
  });
  it("conta pessoas pelo e-mail, sem repetir quem se candidatou a mais de uma vaga", () => {
    expect(p.totals.people).toBe(4); // ana (2 candidaturas), bia, caio, dani
  });
  it("candidatos ativos, analisados e quantos atendem o corte (sem reprovados)", () => {
    expect(p.totals.active).toBe(4);
    expect(p.totals.analyzed).toBe(3); // 90, 50, 85
    expect(p.totals.meets).toBe(2); // 90 e 85
    expect(p.totals.meetsPct).toBeCloseTo(66.67, 1);
  });
  it("resumo por vaga reaproveita o ranking e as estatísticas do relatório da vaga", () => {
    const j1 = p.perJob.find((j) => j.job.id === "j1")!;
    expect(j1.total).toBe(2);
    expect(j1.report.ranking.map((r) => r.id)).toEqual(["1", "2"]);
    expect(j1.report.stats?.mean).toBe(70);
    const j2 = p.perJob.find((j) => j.job.id === "j2")!;
    expect(j2.total).toBe(3);
    expect(j2.report.totals.meetsMinimum).toBe(1);
  });
  it("vaga encerrada fica fora do resumo por vaga", () => {
    expect(p.perJob.map((j) => j.job.id)).toEqual(["j1", "j2"]);
  });
  it("evolução diária dos últimos 30 dias, com zeros nos dias sem candidatura", () => {
    expect(p.timeline).toHaveLength(30);
    expect(p.timeline[p.timeline.length - 1].date).toBe("2026-11-01");
    const byDate = Object.fromEntries(p.timeline.map((d) => [d.date, d.count]));
    expect(byDate["2026-10-30"]).toBe(4); // candidaturas 1, 2, 4 e 5
    expect(byDate["2026-10-31"]).toBe(1);
    expect(byDate["2026-11-01"]).toBe(0);
  });
  it("perfil: conta cada pessoa uma vez, usando a candidatura mais recente", () => {
    expect(p.profile.people).toBe(4);
    expect(p.profile.levels.find((l) => l.label === "Pleno")?.count).toBe(3);
    expect(p.profile.levels.find((l) => l.label === "Júnior")?.count).toBe(1);
  });
  it("perfil: pretensão salarial lida do texto, ignorando o que não é valor", () => {
    expect(p.profile.salary.n).toBe(3);
    expect(p.profile.salary.median).toBe(2200);
  });
});

describe("portfolioInsights", () => {
  const now = new Date("2026-11-01T12:00:00Z");
  const jobs = [job({}), job({ id: "j2", title: "Consultor", code: "1123" })];
  const apps = [
    app({ id: "1", jobId: "j1", email: "a@x.com", aiScore: 95 }),
    app({ id: "2", jobId: "j1", email: "b@x.com", aiScore: 90 }),
    app({ id: "3", jobId: "j2", email: "c@x.com", aiScore: 40 }),
    app({ id: "4", jobId: "j2", email: "d@x.com", aiScore: 50 }),
    app({ id: "5", jobId: "j2", email: "e@x.com", aiScore: 60 }),
  ];
  const bullets = portfolioInsights(buildPortfolio(jobs, apps, now));

  it("aponta a vaga com mais candidatos e a de melhor e pior aderência", () => {
    const text = bullets.join(" ");
    expect(text).toMatch(/Consultor #1123[\s\S]*mais candidatos/);
    expect(text).toMatch(/Promotor de Vendas #1124[\s\S]*(maior|melhor)[\s\S]*(aderência|atendem)/i);
    expect(text).toMatch(/Consultor #1123[\s\S]*(menor|pior)[\s\S]*(aderência|atendem)/i);
  });
  it("aponta o critério mais escasso", () => {
    expect(bullets.join(" ")).toMatch(/Capilares/);
  });
  it("sem candidatos, devolve só um aviso", () => {
    const empty = portfolioInsights(buildPortfolio([job({})], [], now));
    expect(empty.length).toBe(1);
    expect(empty[0]).toMatch(/ainda não há candidaturas/i);
  });
});
