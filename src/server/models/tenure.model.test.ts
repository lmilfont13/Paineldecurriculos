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

  it("descarta dados pessoais, telefones e datas de nascimento confundidos com empresa", () => {
    const polluted = {
      tempoMedioMeses: 100,
      resumo: "...",
      empresas: [
        {
          empresa: "Maria Júlia de Maria Araújo Data de Nascimento: 09",
          cargo: "Conforme currículo",
          periodo: "11/2005",
          meses: 252,
        },
        {
          empresa: "GLEICIANE MUNIZ Telefone: (85) 9 87530785 | (85)",
          cargo: "Conforme currículo",
          periodo: "05/2026",
          meses: 6,
        },
        {
          empresa: "Empresa Real LTDA",
          cargo: "Vendedora",
          periodo: "2021 a 2023",
          meses: 24,
        },
      ],
    };

    const parsed = parseTenureAnalysis(polluted);
    expect(parsed).not.toBeNull();
    // Apenas a Empresa Real LTDA deve ser aceita
    expect(parsed?.totalExperiencias).toBe(1);
    expect(parsed?.empresas[0].empresa).toBe("Empresa Real LTDA");
    expect(parsed?.tempoMedioMeses).toBe(24);
  });
});

describe("readTenure", () => {
  it("retorna null quando aiTenure for nulo, sem inferir via regex em texto cru", () => {
    const rawText = "Maria Júlia de Maria Araújo Data de Nascimento: 09/11/2005";
    const res = readTenure(null, rawText);
    expect(res).toBeNull();
  });
});

describe("extractHeuristicTenure", () => {
  it("está desativado para evitar falsos positivos", () => {
    const text = "01/2020 a 06/2022";
    const res = extractHeuristicTenure(text);
    expect(res).toBeNull();
  });
});

