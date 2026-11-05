import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";

import { TalentDashboardReport } from "@/components/report/talent-dashboard-report";
import {
  buildTalentDashboardData,
  type RawCandidateForDashboard,
} from "@/server/models/talent-dashboard.model";

const mockCandidates: RawCandidateForDashboard[] = [
  {
    id: "c1",
    name: "Vanessa Freitas da Silva",
    age: 29,
    aiScore: 95,
    aiProfile: "Promotor de Vendas",
    aiArea: "Vendas",
    aiLevel: "Pleno",
    aiTenure: {
      tempoMedioMeses: 22,
      empresas: [{ empresa: "Atacadão", cargo: "Promotora", periodo: "2020 a 2022", meses: 22 }],
    },
    city: "Fortaleza",
    neighborhood: "Aldeota",
    createdAt: new Date(),
  },
  {
    id: "c2",
    name: "Darlan Sousa",
    age: 34,
    aiScore: 88,
    aiProfile: "Repositor",
    aiArea: "Vendas",
    aiLevel: "Pleno",
    aiTenure: {
      tempoMedioMeses: 36,
      empresas: [{ empresa: "Carrefour", cargo: "Repositor", periodo: "2019 a 2022", meses: 36 }],
    },
    city: "Maranguape",
    neighborhood: "Centro",
    createdAt: new Date(),
  },
  {
    id: "c3",
    name: "Maria Júlia",
    age: 21,
    aiScore: 78,
    aiProfile: "Atendente de Loja",
    aiArea: "Atendimento",
    aiLevel: "Júnior",
    city: "Fortaleza",
    neighborhood: "Centro",
    createdAt: new Date(),
  },
];

describe("TalentDashboardReport (PDF)", () => {
  it("renderiza um PDF válido com os dados demográficos e de mercado", async () => {
    const data = buildTalentDashboardData("TARHGET FORTALEZA", mockCandidates);
    const buf = await renderToBuffer(
      <TalentDashboardReport data={data} company="TARHGET FORTALEZA" brand="#7a1f3d" />
    );

    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(1000);
  }, 60000);

  it("não quebra com base de dados vazia", async () => {
    const data = buildTalentDashboardData("TARHGET FORTALEZA", []);
    const buf = await renderToBuffer(
      <TalentDashboardReport data={data} company="TARHGET FORTALEZA" />
    );

    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  }, 60000);
});

