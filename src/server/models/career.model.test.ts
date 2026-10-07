import { describe, expect, it } from "vitest";

import { careerKeywordsText, parseCareer, readCareer } from "@/server/models/career.model";

const raw = `{"areas":[
  {"area":"Logística","score":62,"why":"Rotas e entregas."},
  {"area":"Vendas e trade marketing","score":88,"why":"5 anos como promotor."},
  {"area":"Administrativo","score":140,"why":"x"},
  {"area":"Atendimento","score":"abc","why":"y"}
 ],
 "roles":["Promotor de vendas","Repositor","Promotor de vendas"],
 "summary":"Seria bem aproveitado em vagas de promotor ou repositor em supermercados."}`;

describe("parseCareer", () => {
  it("ordena as áreas pela nota, limita a 3 e corta notas fora da faixa", () => {
    const c = parseCareer(raw, new Date("2026-10-07T12:00:00Z"))!;
    expect(c.areas.map((a) => [a.area, a.score])).toEqual([
      ["Administrativo", 100],
      ["Vendas e trade marketing", 88],
      ["Logística", 62],
    ]);
    expect(c.roles).toEqual(["Promotor de vendas", "Repositor"]);
    expect(c.summary).toContain("promotor");
    expect(c.analyzedAt).toBe("2026-10-07T12:00:00.000Z");
  });

  it("resposta inválida ou sem resumo vira null", () => {
    expect(parseCareer("sem json")).toBeNull();
    expect(parseCareer('{"areas":[{"area":"Vendas","score":80}]}')).toBeNull();
  });

  it("lê de volta o que foi salvo e monta o texto de comparação", () => {
    const c = parseCareer(raw)!;
    expect(readCareer(JSON.parse(JSON.stringify(c)))).toEqual(c);
    expect(readCareer({ areas: "x" })).toBeNull();
    expect(careerKeywordsText(c)).toContain("Repositor");
  });
});
