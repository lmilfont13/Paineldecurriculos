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

  it("deduplica candidaturas da mesma pessoa para que não apareça repetida no ranking nem nas estatísticas", () => {
    const candidates: RawCandidateForDashboard[] = [
      {
        id: "app-1",
        name: "Viviane Vasconcelos",
        email: "viviane@exemplo.com",
        phone: "(85) 98888-1111",
        age: 32,
        aiScore: 95,
        aiProfile: "Função Operacional",
        aiLevel: "Operacional",
        aiTenure: null, // Sem data
        createdAt: new Date("2026-01-01"),
      },
      {
        id: "app-2",
        name: "Viviane Vasconcelos",
        email: "viviane@exemplo.com",
        phone: "(85) 98888-1111",
        age: 32,
        aiScore: 95,
        aiProfile: "Promotor de Vendas",
        aiLevel: "Pleno",
        aiTenure: {
          tempoMedioMeses: 31,
          empresas: [{ empresa: "São Braz", cargo: "Promotora", meses: 31 }],
        },
        createdAt: new Date("2026-02-01"),
      },
      {
        id: "app-3",
        name: "Francisco Felicio Gomes Filho",
        email: "francisco1@exemplo.com",
        phone: "85999992222",
        age: 44,
        aiScore: 95,
        aiProfile: "Função Operacional",
        createdAt: new Date("2026-01-02"),
      },
      {
        id: "app-4",
        name: "Francisco Felicio Gomes Filho",
        email: "francisco2@exemplo.com",
        phone: "85999992222",
        age: 44,
        aiScore: 95,
        aiProfile: "Promotor de Vendas",
        aiLevel: "Pleno",
        aiTenure: {
          tempoMedioMeses: 25,
          empresas: [{ empresa: "MRH", cargo: "Promotor", meses: 25 }],
        },
        createdAt: new Date("2026-02-02"),
      },
      {
        id: "app-5",
        name: "Fellipe Vieira Diniz",
        email: "fellipe@exemplo.com",
        phone: "85977773333",
        age: 37,
        aiScore: 95,
        aiProfile: "Promotor de Vendas",
        createdAt: new Date("2026-01-10"),
      },
      {
        id: "app-6",
        name: "Fellipe Vieira Diniz",
        email: "fellipe@exemplo.com",
        phone: "85977773333",
        age: 37,
        aiScore: 95,
        aiProfile: "Promotor de Vendas",
        createdAt: new Date("2026-01-15"),
      },
    ];

    const data = buildTalentDashboardData("Empresa Teste", candidates);

    // Total de pessoas físicas deve ser 3 (Viviane, Francisco, Fellipe) e não 6 candidaturas
    expect(data.totals.candidates).toBe(3);

    // No ranking de destaques, cada pessoa aparece estritamente uma vez
    expect(data.highlights).toHaveLength(3);
    const names = data.highlights.map((h) => h.name);
    expect(new Set(names).size).toBe(3);

    // Viviane deve ter herdado o melhor perfil ("Promotor de Vendas" com tenure "2 anos e 7m")
    const viviane = data.highlights.find((h) => h.name.includes("Viviane"));
    expect(viviane).toBeDefined();
    expect(viviane?.role).toBe("Promotor de Vendas");
    expect(viviane?.level).toBe("Pleno");
    expect(viviane?.tenureFormatted).toContain("2 anos e 7m");

    // Francisco deve ter herdado o perfil "Promotor de Vendas" e empresa MRH
    const francisco = data.highlights.find((h) => h.name.includes("Francisco"));
    expect(francisco).toBeDefined();
    expect(francisco?.role).toBe("Promotor de Vendas");
    expect(francisco?.topCompany).toBe("MRH");
  });
});

