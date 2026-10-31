import { describe, expect, it } from "vitest";

import { parseJobDescription } from "@/server/models/job-description.model";

const organized = [
  "Sobre a vaga",
  "Buscamos profissional com experiência em atendimento.",
  "",
  "Escala e horário",
  "Escala a definir. Folga fixa aos domingos.",
  "",
  "Remuneração e benefícios",
  "• Salário: R$ 2.100,00/mês",
  "• Vale Refeição: R$ 26,68/dia trabalhado",
].join("\n");

describe("parseJobDescription — texto organizado pela IA (títulos sem dois-pontos)", () => {
  const sections = parseJobDescription(organized);

  it("o título 'Sobre a vaga' não fica misturado ao texto", () => {
    expect(sections[0].type).toBe("intro");
    expect(sections[0].content).toBe("Buscamos profissional com experiência em atendimento.");
  });
  it("'Escala e horário' vira bloco de jornada com o título", () => {
    expect(sections[1]).toMatchObject({
      type: "jornada",
      title: "Escala e horário",
      content: "Escala a definir. Folga fixa aos domingos.",
    });
  });
  it("'Remuneração e benefícios' vira lista de benefícios", () => {
    expect(sections[2]).toMatchObject({
      type: "beneficios",
      title: "Remuneração e benefícios",
    });
    expect(sections[2].items).toEqual([
      "Salário: R$ 2.100,00/mês",
      "Vale Refeição: R$ 26,68/dia trabalhado",
    ]);
  });
});

describe("parseJobDescription — o que já funcionava continua", () => {
  it("jornada com dois-pontos na mesma linha", () => {
    expect(parseJobDescription("Texto inicial.\n\nJornada: 08h às 17h")[1]).toMatchObject({
      type: "jornada",
      content: "08h às 17h",
    });
  });
  it("texto corrido sem título é apresentação", () => {
    expect(parseJobDescription("Somos uma empresa de varejo.\nVenha crescer com a gente.")[0]).toMatchObject({
      type: "intro",
      content: "Somos uma empresa de varejo.\nVenha crescer com a gente.",
    });
  });
  it("frase longa não é confundida com título", () => {
    const [, second] = parseJobDescription(
      "Intro.\n\nEstamos contratando pessoas dedicadas para a nossa nova loja.\nO início é imediato."
    );
    expect(second.type).toBe("geral");
    expect(second.title).toBeUndefined();
  });
  it("texto vazio não gera blocos", () => {
    expect(parseJobDescription("")).toEqual([]);
  });
});

import { jobSummary } from "@/server/models/job-description.model";

describe("jobSummary", () => {
  it("usa a apresentação da vaga, sem o título do bloco", () => {
    expect(jobSummary(organized)).toBe("Buscamos profissional com experiência em atendimento.");
  });
  it("corta no limite com reticências, sem quebrar palavra no meio", () => {
    const out = jobSummary("Sobre a vaga\nUma frase bastante comprida para testar o corte do resumo da vaga.", 30);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(31);
    expect(out).not.toMatch(/\s…$/);
  });
  it("texto corrido vira uma linha só", () => {
    expect(jobSummary("Somos uma loja.\nVenha crescer.")).toBe("Somos uma loja. Venha crescer.");
  });
  it("descrição vazia dá resumo vazio", () => {
    expect(jobSummary("")).toBe("");
  });
});
