import { describe, expect, it } from "vitest";

import {
  dedupeCandidatesByPerson,
  type CandidateCvCard,
} from "@/server/models/cv-search.model";

const card = (
  id: string,
  email: string,
  aiScore: number | null,
  createdAt = "2026-10-01T10:00:00.000Z",
  extra: Partial<CandidateCvCard> = {}
) =>
  ({
    id,
    name: "Candidato " + id,
    email,
    aiScore,
    createdAt,
    job: {
      id: "job-" + id,
      title: "Vaga " + id,
      location: "São Paulo",
      workMode: "ONSITE",
      contract: "CLT",
      aiMinScore: 60,
    },
    ...extra,
  }) as CandidateCvCard;

describe("dedupeCandidatesByPerson", () => {
  it("mostra a pessoa uma vez, com a candidatura de maior nota", () => {
    const out = dedupeCandidatesByPerson([
      card("a", "gabriel@x.com", 70),
      card("b", "gabriel@x.com", 85),
    ]);
    expect(out.map((c) => c.id)).toEqual(["b"]);
  });

  it("e-mail com caixa ou espaço diferente é a mesma pessoa", () => {
    const out = dedupeCandidatesByPerson([
      card("a", " Gabriel@X.com", 50),
      card("b", "gabriel@x.com ", 50, "2026-10-05T10:00:00.000Z"),
    ]);
    expect(out.map((c) => c.id)).toEqual(["b"]); // empate: a mais recente
  });

  it("nota vence candidatura ainda sem análise", () => {
    const out = dedupeCandidatesByPerson([
      card("a", "m@x.com", null, "2026-10-09T10:00:00.000Z"),
      card("b", "m@x.com", 40),
    ]);
    expect(out.map((c) => c.id)).toEqual(["b"]);
  });

  it("candidatura com currículo vence candidatura sem currículo", () => {
    const out = dedupeCandidatesByPerson([
      card("a", "ana@x.com", 90, "2026-10-01T10:00:00.000Z", { resumeUrl: undefined }),
      card("b", "ana@x.com", 80, "2026-10-02T10:00:00.000Z", { resumeUrl: "https://cv.pdf" }),
    ]);
    expect(out.map((c) => c.id)).toEqual(["b"]);
    expect(out[0].resumeUrl).toBe("https://cv.pdf");
  });

  it("unifica pessoas com o mesmo candidateId mesmo se e-mails diferirem", () => {
    const out = dedupeCandidatesByPerson([
      card("a", "pessoal@gmail.com", 70, "2026-10-01T10:00:00.000Z", { candidateId: "cand-123" }),
      card("b", "trabalho@empresa.com", 80, "2026-10-02T10:00:00.000Z", { candidateId: "cand-123" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("b");
    expect(out[0].allJobs).toEqual(["Vaga a", "Vaga b"]);
  });

  it("unifica pessoas com o mesmo CPF formatado ou sem formatação", () => {
    const out = dedupeCandidatesByPerson([
      card("a", "email1@x.com", 65, "2026-10-01T10:00:00.000Z", { cpf: "123.456.789-00" }),
      card("b", "email2@x.com", 85, "2026-10-02T10:00:00.000Z", { cpf: "12345678900" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("b");
  });

  it("unifica pessoas com o mesmo telefone com DDD", () => {
    const out = dedupeCandidatesByPerson([
      card("a", "antigo@x.com", 60, "2026-10-01T10:00:00.000Z", { phone: "(11) 98765-4321" }),
      card("b", "novo@x.com", 75, "2026-10-02T10:00:00.000Z", { phone: "11987654321" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("b");
  });

  it("unifica pessoas com o mesmo nome completo idêntico e mescla dados complementares", () => {
    const out = dedupeCandidatesByPerson([
      card("a", "joao.silva@x.com", 50, "2026-10-01T10:00:00.000Z", {
        name: "João da Silva Santos",
        photoUrl: "https://foto.jpg",
        hasImpediment: true,
        impedimentReason: "Demissão por justa causa",
      }),
      card("b", "joaozinho@y.com", 70, "2026-10-02T10:00:00.000Z", {
        name: "JOAO DA SILVA SANTOS",
        phone: "11999999999",
      }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("b");
    // Preserva a foto e o impedimento mesmo sendo do registro "a"
    expect(out[0].photoUrl).toBe("https://foto.jpg");
    expect(out[0].hasImpediment).toBe(true);
    expect(out[0].impedimentReason).toBe("Demissão por justa causa");
    expect(out[0].phone).toBe("11999999999");
  });

  it("pessoas diferentes continuam todas", () => {
    const out = dedupeCandidatesByPerson([
      card("a", "a@x.com", 10, "2026-10-01T10:00:00.000Z", { name: "Carlos Eduardo Oliveira" }),
      card("b", "b@x.com", 90, "2026-10-02T10:00:00.000Z", { name: "Mariana Souza Lima" }),
    ]);
    expect(out).toHaveLength(2);
  });

  it("conta excluída (e-mail sem @) não junta pessoas diferentes", () => {
    const out = dedupeCandidatesByPerson([
      card("a", "conta-excluida", 10, "2026-10-01T10:00:00.000Z", { name: "" }),
      card("b", "conta-excluida", 20, "2026-10-02T10:00:00.000Z", { name: "" }),
    ]);
    expect(out).toHaveLength(2);
  });
});
