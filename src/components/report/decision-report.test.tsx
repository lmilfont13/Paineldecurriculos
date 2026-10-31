import { renderToBuffer } from "@react-pdf/renderer";
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { DecisionReport } from "@/components/report/decision-report";
import { buildReportData, type ReportCandidate } from "@/server/models/report.model";

const criteria = ["Experiência em vendas", "Ensino médio completo", "Boa comunicação", "Interesse em beleza", "Disponibilidade de horários", "Experiência com capilares"];
const mk = (id: string, name: string, score: number, mets: ("sim" | "parcial" | "não")[], over: Partial<ReportCandidate> = {}): ReportCandidate => ({
  id,
  name,
  status: "PENDING",
  aiScore: score,
  aiReasoning: "Possui experiência relevante como promotora de vendas e boa base de atendimento; a ausência de menção a produtos capilares é o principal ponto de atenção.",
  criteria: criteria.map((c, i) => ({ criterion: c, met: mets[i] ?? "não", evidence: mets[i] === "sim" ? "Trabalhou 4 anos em vendas e promoção em lojas de varejo." : "" })),
  aiProfile: "Promotora de vendas",
  aiArea: "Vendas e Promoção",
  aiLevel: "Pleno",
  salaryExpectation: "R$ 2.200",
  availability: "Imediata",
  city: "Fortaleza",
  neighborhood: "Messejana",
  createdAt: new Date("2026-10-30T12:00:00Z"),
  ...over,
});

const candidates: ReportCandidate[] = [
  mk("1", "Vanessa Caroline de Mendonça Carvalho", 95, ["sim", "sim", "parcial", "sim", "sim", "sim"]),
  mk("2", "Clara Angélica Melo Falcão", 95, ["sim", "sim", "parcial", "sim", "sim", "não"]),
  mk("3", "Gabriel Ribeiro Martins", 85, ["sim", "sim", "parcial", "não", "não", "não"], { status: "INTERVIEW" }),
  mk("4", "Breno Silva Carvalho", 72, ["sim", "parcial", "parcial", "não", "sim", "não"]),
  mk("5", "Dayane Oliveira Lima", 68, ["parcial", "sim", "sim", "não", "sim", "não"]),
  mk("6", "Eduardo Santos Pereira", 55, ["parcial", "sim", "não", "não", "não", "não"]),
  mk("7", "Fernanda Costa Alves", 40, ["não", "sim", "não", "não", "parcial", "não"]),
  mk("8", "Rejeitado Exemplo", 30, [], { status: "REJECTED" }),
  mk("9", "Sem Análise Exemplo", 0, [], { aiScore: null }),
];

describe("DecisionReport (PDF)", () => {
  it("gera um PDF válido com dados reais de exemplo", async () => {
    const data = buildReportData(
      { title: "Promotor de Vendas", code: "1124", aiMinScore: 70, criteria },
      candidates,
      new Date("2026-11-01T12:00:00Z")
    );
    const buf = await renderToBuffer(
      <DecisionReport
        data={data}
        company="TARHGET FORTALEZA"
        brand="#7a1f3d"
        notes={{ "1": { reason: "Experiência mais aderente, com produtos capilares (Wella) e histórico consistente em promoção.", strengths: ["Produtos capilares", "Disponibilidade total"], concerns: ["Comunicação parcial na triagem"] } }}
      />
    );
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(5000);
    if (process.env.PREVIEW_PDF) writeFileSync(process.env.PREVIEW_PDF, buf);
  }, 60000);

  it("não quebra sem nenhum candidato", async () => {
    const data = buildReportData({ title: "Vaga vazia", code: null, aiMinScore: 70, criteria: [] }, [], new Date());
    const buf = await renderToBuffer(<DecisionReport data={data} company="Empresa" />);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  }, 60000);
});
