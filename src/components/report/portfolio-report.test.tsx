import { renderToBuffer } from "@react-pdf/renderer";
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { PortfolioReport } from "@/components/report/portfolio-report";
import {
  buildPortfolio,
  type PortfolioApplication,
  type PortfolioJob,
} from "@/server/models/portfolio.model";

const NOW = new Date("2026-11-01T12:00:00Z");
const crit = ["Experiência em vendas", "Ensino médio completo", "Boa comunicação"];
const jobs: PortfolioJob[] = [
  { id: "j1", title: "Promotor de Vendas", code: "1124", status: "OPEN", location: null, aiMinScore: 70, criteria: crit, createdAt: new Date("2026-10-01") },
  { id: "j2", title: "Consultor de Vendas", code: "1130", status: "OPEN", location: null, aiMinScore: 60, criteria: crit, createdAt: new Date("2026-10-10") },
  { id: "j3", title: "Auxiliar", code: null, status: "CLOSED", location: null, aiMinScore: 60, criteria: [], createdAt: new Date("2026-09-01") },
];
const app = (i: number, jobId: string, score: number | null, over: Partial<PortfolioApplication> = {}): PortfolioApplication => ({
  id: `a${i}`,
  jobId,
  email: `c${i}@x.com`,
  hasCnh: i % 2 ? "B" : "NONE",
  workPreference: "Presencial",
  name: `Candidato ${i}`,
  status: i % 5 === 0 ? "INTERVIEW" : "PENDING",
  aiScore: score,
  aiReasoning: null,
  criteria: crit.map((c, k) => ({ criterion: c, met: (k + i) % 3 === 0 ? "sim" : (k + i) % 3 === 1 ? "parcial" : "não" })),
  aiProfile: i % 2 ? "Promotor de vendas" : "Vendedor",
  aiArea: "Vendas",
  aiLevel: i % 3 ? "Pleno" : "Júnior",
  salaryExpectation: `R$ ${1500 + i * 100}`,
  availability: "Imediata",
  city: "Fortaleza",
  neighborhood: i % 2 ? "Messejana" : "Centro",
  createdAt: new Date(NOW.getTime() - i * 86_400_000),
  ...over,
});
const apps = Array.from({ length: 12 }, (_, i) => app(i + 1, i % 2 ? "j1" : "j2", 40 + i * 5));

describe("PortfolioReport (PDF)", () => {
  it("gera um PDF válido com vários candidatos", async () => {
    const buf = await renderToBuffer(<PortfolioReport data={buildPortfolio(jobs, apps, NOW)} company="TARHGET FORTALEZA" />);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    if (process.env.PREVIEW_PDF) writeFileSync(process.env.PREVIEW_PDF, buf);
  }, 60000);

  it("não quebra sem vagas nem candidatos", async () => {
    const buf = await renderToBuffer(<PortfolioReport data={buildPortfolio([], [], NOW)} company="Empresa" />);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  }, 60000);
});
