import { describe, expect, it } from "vitest";

import {
  buildAnswersText,
  hasMaterial,
  parseChecklist,
  readChecklist,
} from "@/server/models/ai.model";

describe("buildAnswersText", () => {
  it("monta 'pergunta: resposta' e pula anexos e datas", () => {
    const text = buildAnswersText([
      { value: "5 anos em loja", field: { label: "Experiência", type: "TEXTAREA" } },
      { value: "1990-01-01", field: { label: "Nascimento", type: "DATE" } },
      { value: "x.pdf", field: { label: "Currículo", type: "FILE_UPLOAD" } },
      { value: "  ", field: { label: "Vazia", type: "TEXT" } },
    ]);
    expect(text).toBe("Experiência: 5 anos em loja");
  });
});

describe("hasMaterial", () => {
  it("exige um mínimo de texto somando currículo e respostas", () => {
    expect(hasMaterial("", "")).toBe(false);
    expect(hasMaterial("curto", "")).toBe(false);
    expect(hasMaterial("", "Experiência: 5 anos como promotor em supermercado")).toBe(true);
  });
});

describe("parseChecklist", () => {
  const criteria = ["Excel", "Atendimento", "E-commerce"];

  it("mantém a ordem da vaga e normaliza as respostas", () => {
    const raw = `aqui está: {"criteria":[
      {"criterion":"atendimento","met":"Parcial","evidence":"Balcão por 1 ano"},
      {"criterion":"Excel","met":"yes","evidence":"Planilhas de estoque"},
      {"criterion":"Inventado","met":"sim","evidence":"x"}
    ]}`;
    expect(parseChecklist(raw, criteria)).toEqual([
      { criterion: "Excel", met: "sim", evidence: "Planilhas de estoque" },
      { criterion: "Atendimento", met: "parcial", evidence: "Balcão por 1 ano" },
      { criterion: "E-commerce", met: "não", evidence: "" },
    ]);
  });

  it("resposta inválida vira 'não' em todos os critérios", () => {
    expect(parseChecklist("sem json", ["Excel"])).toEqual([
      { criterion: "Excel", met: "não", evidence: "" },
    ]);
  });
});

describe("readChecklist", () => {
  it("ignora lixo vindo do banco", () => {
    expect(readChecklist(null)).toEqual([]);
    expect(
      readChecklist([{ criterion: "Excel", met: "talvez", evidence: 1 }, "x", {}])
    ).toEqual([{ criterion: "Excel", met: "não", evidence: "1" }]);
  });
});
