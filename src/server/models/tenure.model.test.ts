import { describe, expect, it } from "vitest";

import {
  classifyStability,
  extractHeuristicTenure,
  formatDurationMonths,
  parseTenureAnalysis,
  readTenure,
} from "@/server/models/tenure.model";

describe("formatDurationMonths", () => {
  it("formata meses e anos corretamente", () => {
    expect(formatDurationMonths(0)).toBe("Menos de 1 mês");
    expect(formatDurationMonths(1)).toBe("1 mês");
    expect(formatDurationMonths(6)).toBe("6 meses");
    expect(formatDurationMonths(12)).toBe("1 ano");
    expect(formatDurationMonths(14)).toBe("1 ano e 2 meses");
    expect(formatDurationMonths(24)).toBe("2 anos");
    expect(formatDurationMonths(25)).toBe("2 anos e 1 mês");
  });
});

describe("classifyStability", () => {
  it("alta estabilidade para média >= 24 meses", () => {
    const res = classifyStability(26, 3);
    expect(res.estabilidade).toBe("ALTA");
    expect(res.classificacaoRisco).toBe("BAIXO");
  });

  it("estabilidade moderada para média entre 12 e 23 meses", () => {
    const res = classifyStability(16, 2);
    expect(res.estabilidade).toBe("MEDIA");
    expect(res.classificacaoRisco).toBe("MEDIO");
  });

  it("alta rotatividade / risco alto para média < 12 meses", () => {
    const res = classifyStability(6, 4);
    expect(res.estabilidade).toBe("BAIXA");
    expect(res.classificacaoRisco).toBe("ALTO");
  });

  it("insuficiente quando não há experiências com data", () => {
    const res = classifyStability(0, 0);
    expect(res.estabilidade).toBe("INSUFICIENTE");
    expect(res.classificacaoRisco).toBe("NEUTRO");
  });
});

describe("parseTenureAnalysis", () => {
  it("normaliza empresas e calcula tempo médio", () => {
    const data = {
      tempoMedioMeses: 18,
      resumo: "Bom tempo de permanência",
      empresas: [
        { empresa: "Supermercado A", cargo: "Operador", periodo: "2020 a 2022", meses: 24 },
        { empresa: "Loja B", cargo: "Vendedor", periodo: "2022 a 2023", meses: 12 },
      ],
    };
    const parsed = parseTenureAnalysis(data);
    expect(parsed).not.toBeNull();
    expect(parsed?.totalExperiencias).toBe(2);
    expect(parsed?.tempoMedioMeses).toBe(18);
    expect(parsed?.estabilidade).toBe("MEDIA");
    expect(parsed?.empresas[0].empresa).toBe("Supermercado A");
  });
});

describe("extractHeuristicTenure", () => {
  it("extrai períodos a partir do texto do currículo", () => {
    const text = `
      Experiência Profissional
      Atacadão Distribuidora
      01/2020 a 06/2022 - Promotor de Vendas
      Carrefour
      08/2022 a 02/2024 - Repositor
    `;
    const res = extractHeuristicTenure(text);
    expect(res).not.toBeNull();
    expect(res?.totalExperiencias).toBeGreaterThanOrEqual(1);
    expect(res?.tempoMedioMeses).toBeGreaterThan(0);
  });
});
