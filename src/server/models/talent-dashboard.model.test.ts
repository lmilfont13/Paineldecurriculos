import { describe, expect, it } from "vitest";

import {
  buildTalentDashboardData,
  inferGender,
  normalizeCompanyName,
  type RawCandidateForDashboard,
} from "@/server/models/talent-dashboard.model";

describe("inferGender", () => {
  it("reconhece nomes femininos comuns", () => {
    expect(inferGender("Maria Julia Santos")).toBe("Feminino");
    expect(inferGender("Ana Paula Silva")).toBe("Feminino");
    expect(inferGender("Ticiane da Costa")).toBe("Feminino");
    expect(inferGender("Gleiciane Muniz")).toBe("Feminino");
    expect(inferGender("Vanessa Freitas")).toBe("Feminino");
  });

  it("reconhece nomes masculinos comuns", () => {
    expect(inferGender("João Victor")).toBe("Masculino");
    expect(inferGender("Darlan Sousa")).toBe("Masculino");
    expect(inferGender("Walber Almeida")).toBe("Masculino");
    expect(inferGender("Glaydstone do Nascimento")).toBe("Masculino");
    expect(inferGender("Carlos Eduardo")).toBe("Masculino");
  });

  it("utiliza termos do currículo quando o nome não for conclusivo", () => {
    expect(inferGender("Alex Santos", "Brasileira, solteira, promotora de vendas")).toBe("Feminino");
    expect(inferGender("Alex Santos", "Brasileiro, casado, promotor de vendas")).toBe("Masculino");
  });
});

describe("normalizeCompanyName", () => {
  it("padroniza grandes redes de varejo e empresas comuns", () => {
    expect(normalizeCompanyName("Atacadão Distribuição S/A")).toBe("Atacadão");
    expect(normalizeCompanyName("Assaí Atacadista - Loja 12")).toBe("Assaí Atacadista");
    expect(normalizeCompanyName("Farmácias Pague Menos")).toBe("Farmácias Pague Menos");
    expect(normalizeCompanyName("Supermercados Cometa")).toBe("Cometa Supermercados");
  });
});

describe("buildTalentDashboardData", () => {
  it("calcula consolidações demográficas, de mercado e scores corretamente", () => {
    const candidates: RawCandidateForDashboard[] = [
      {
        id: "1",
        name: "Maria Júlia",
        age: 21,
        aiScore: 95,
        aiProfile: "Promotor de Vendas",
        aiArea: "Vendas",
        aiLevel: "Pleno",
        aiTenure: {
          tempoMedioMeses: 18,
          empresas: [{ empresa: "Atacadão", cargo: "Promotora", periodo: "2021-2023", meses: 18 }],
        },
        createdAt: new Date(),
      },
      {
        id: "2",
        name: "Darlan Sousa",
        age: 28,
        aiScore: 90,
        aiProfile: "Promotor de Vendas",
        aiArea: "Vendas",
        aiLevel: "Pleno",
        aiTenure: {
          tempoMedioMeses: 24,
          empresas: [{ empresa: "Carrefour", cargo: "Repositor", periodo: "2020-2022", meses: 24 }],
        },
        createdAt: new Date(),
      },
      {
        id: "3",
        name: "Carlos Alberto",
        age: 40,
        aiScore: 65,
        aiProfile: "Motorista",
        aiArea: "Logística",
        aiLevel: "Sênior",
        createdAt: new Date(),
      },
    ];

    const data = buildTalentDashboardData("Empresa Teste", candidates);

    expect(data.totals.candidates).toBe(3);
    expect(data.gender.female.count).toBe(1);
    expect(data.gender.male.count).toBe(2);
    expect(data.age.mean).toBe(30); // (21 + 28 + 40) / 3 = 29.67 -> 30
    expect(data.totals.topMatchesCount).toBe(2); // 95 e 90
    expect(data.roles[0].label).toBe("Promotor de Vendas");
    expect(data.roles[0].count).toBe(2);
    expect(data.highlights).toHaveLength(3);
    expect(data.highlights[0].name).toBe("Maria Júlia");
  });
});

