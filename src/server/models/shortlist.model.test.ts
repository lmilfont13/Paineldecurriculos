import { describe, expect, it } from "vitest";

import {
  buildShortlistPrompt,
  parseShortlist,
  pickCandidatesForShortlist,
  redactContacts,
  type ShortlistInput,
} from "@/server/models/shortlist.model";

const cand = (over: Partial<ShortlistInput>): ShortlistInput => ({
  id: "a",
  status: "PENDING",
  aiScore: 50,
  aiReasoning: null,
  aiProfile: null,
  aiArea: null,
  aiLevel: null,
  aiChecklist: null,
  resumeText: null,
  ...over,
});

describe("pickCandidatesForShortlist", () => {
  it("ordena pela nota, deixa quem não tem nota por último e corta no limite", () => {
    const out = pickCandidatesForShortlist(
      [cand({ id: "sem", aiScore: null }), cand({ id: "40", aiScore: 40 }), cand({ id: "90", aiScore: 90 }), cand({ id: "70", aiScore: 70 })],
      3
    );
    expect(out.map((c) => c.id)).toEqual(["90", "70", "40"]);
  });
  it("não considera reprovados", () => {
    const out = pickCandidatesForShortlist([cand({ id: "r", status: "REJECTED", aiScore: 99 }), cand({ id: "ok", aiScore: 10 })]);
    expect(out.map((c) => c.id)).toEqual(["ok"]);
  });
});

describe("redactContacts", () => {
  it("apaga e-mail, telefone e CPF do texto do currículo", () => {
    const out = redactContacts("Contato: joao@mail.com, (85) 99999-1234, CPF 529.982.247-25. Trabalhou 5 anos em vendas.");
    expect(out).not.toMatch(/joao@mail\.com/);
    expect(out).not.toMatch(/99999-1234/);
    expect(out).not.toMatch(/529\.982\.247-25/);
    expect(out).toContain("Trabalhou 5 anos em vendas.");
  });
});

describe("buildShortlistPrompt", () => {
  const built = buildShortlistPrompt(
    {
      jobTitle: "Consultor de Vendas",
      requirements: "• Ensino médio completo\n• Experiência em vendas",
      criteria: ["Experiência em vendas"],
    },
    [
      cand({
        id: "real-id-1",
        aiScore: 85,
        aiProfile: "Promotor de vendas",
        aiChecklist: [{ criterion: "Experiência em vendas", met: "sim", evidence: "5 anos" }],
        resumeText: "Maria Souza maria@x.com 85 98888-7777. Vendedora há 5 anos.",
      }),
    ],
    3
  );

  it("identifica candidatos por rótulo e não vaza identificadores nem contatos", () => {
    expect(built.prompt).toContain("C1");
    expect(built.prompt).not.toContain("real-id-1");
    expect(built.prompt).not.toContain("maria@x.com");
    expect(built.prompt).not.toContain("98888-7777");
  });
  it("leva a vaga, os critérios e a nota atual", () => {
    expect(built.prompt).toContain("Consultor de Vendas");
    expect(built.prompt).toContain("Experiência em vendas");
    expect(built.prompt).toContain("85");
    expect(built.system).toMatch(/ignore nome/i);
  });
  it("devolve o mapa rótulo → candidatura", () => {
    expect(built.labelToId).toEqual({ C1: "real-id-1" });
  });
});

describe("parseShortlist", () => {
  const map = { C1: "id1", C2: "id2", C3: "id3" };

  it("lê a resposta, mantém a ordem e troca o rótulo pelo id", () => {
    const raw = JSON.stringify({
      ranking: [
        { candidato: "C2", motivo: "Mais experiência.", pontos_fortes: ["Vendas"], pontos_atencao: ["Sem CNH"] },
        { candidato: "C1", motivo: "Boa base.", pontos_fortes: [], pontos_atencao: [] },
      ],
    });
    const out = parseShortlist(raw, map, 5);
    expect(out.map((p) => [p.rank, p.applicationId])).toEqual([[1, "id2"], [2, "id1"]]);
    expect(out[0]).toMatchObject({ reason: "Mais experiência.", strengths: ["Vendas"], concerns: ["Sem CNH"] });
  });
  it("aceita JSON dentro de bloco de código e texto em volta", () => {
    const raw = 'Aqui está:\n```json\n{"ranking":[{"candidato":"C3","motivo":"ok"}]}\n```';
    expect(parseShortlist(raw, map, 5).map((p) => p.applicationId)).toEqual(["id3"]);
  });
  it("descarta rótulo desconhecido e repetido, e respeita o limite", () => {
    const raw = JSON.stringify({
      ranking: [
        { candidato: "C9", motivo: "?" },
        { candidato: "C1", motivo: "a" },
        { candidato: "C1", motivo: "repetido" },
        { candidato: "C2", motivo: "b" },
        { candidato: "C3", motivo: "c" },
      ],
    });
    expect(parseShortlist(raw, map, 2).map((p) => p.applicationId)).toEqual(["id1", "id2"]);
  });
  it("resposta inválida vira lista vazia, sem quebrar", () => {
    expect(parseShortlist("não é json", map, 3)).toEqual([]);
    expect(parseShortlist('{"ranking": "x"}', map, 3)).toEqual([]);
  });
});

import { redactName } from "@/server/models/shortlist.model";

describe("redactName", () => {
  it("apaga o nome completo e cada parte do nome no currículo", () => {
    const out = redactName("MARIA DA SILVA SOUZA. Maria atua em vendas. Contato com Silva Ltda.", "Maria da Silva Souza");
    expect(out).not.toMatch(/maria|souza/i);
    expect(out).toContain("atua em vendas");
  });
  it("ignora partes muito curtas e ligações (da, de)", () => {
    expect(redactName("Ele foi da equipe de vendas.", "Ana da Silva")).toContain("da equipe de vendas");
  });
  it("sem nome, devolve o texto como está", () => {
    expect(redactName("texto", "")).toBe("texto");
  });
});

import { scrubText } from "@/server/models/shortlist.model";

describe("scrubText", () => {
  it("apaga o nome e os contatos de qualquer texto que vai para a IA", () => {
    const out = scrubText("Maria Souza (maria@x.com) tem 5 anos de vendas.", "Maria Souza");
    expect(out).not.toMatch(/maria|souza|@/i);
    expect(out).toContain("5 anos de vendas");
  });
  it("texto vazio e nome vazio não quebram", () => {
    expect(scrubText("", "Maria")).toBe("");
    expect(scrubText("texto", "")).toBe("texto");
  });
});

describe("buildShortlistPrompt: a leitura da triagem também não leva o nome", () => {
  it("apaga o nome que a própria IA escreveu antes na leitura", () => {
    const built = buildShortlistPrompt(
      { jobTitle: "Vaga", requirements: null, criteria: [] },
      [cand({ id: "r1", name: "Ana Paula Ramos", aiReasoning: "Ana Paula possui experiência sólida em vendas." })],
      3
    );
    expect(built.prompt).not.toMatch(/Ana Paula|Ramos/);
    expect(built.prompt).toContain("experiência sólida em vendas");
  });
});
