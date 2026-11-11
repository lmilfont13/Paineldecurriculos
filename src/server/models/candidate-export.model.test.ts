import { describe, expect, it } from "vitest";

import {
  buildCandidateExport,
  exportFileName,
  type ExportApplication,
} from "./candidate-export.model";

const NOW = new Date("2026-11-11T18:00:00Z");

function app(over: Partial<ExportApplication>): ExportApplication {
  return {
    id: "a1",
    candidateId: "c1",
    name: "maria da silva",
    email: "Maria@x.com",
    phone: "11999990000",
    birthDate: new Date("1996-11-12T00:00:00Z"),
    city: "São Paulo",
    state: "SP",
    neighborhood: "Centro",
    desiredRole: "Promotora",
    salaryExpectation: "2.000",
    workPreference: "ONSITE",
    availability: "IMMEDIATE",
    hasCnh: "B",
    source: "instagram",
    status: "PENDING",
    aiState: "DONE",
    aiScore: 70,
    aiArea: "Vendas",
    aiLevel: "Júnior",
    hasImpediment: false,
    consentAt: new Date("2026-10-01T12:00:00Z"),
    createdAt: new Date("2026-10-01T12:00:00Z"),
    interviewAt: null,
    interviewMode: null,
    job: { title: "Promotor(a)", code: "1123", aiMinScore: 60, isTalentPool: false },
    ...over,
  };
}

describe("buildCandidateExport", () => {
  it("junta as candidaturas da mesma pessoa em uma linha", () => {
    const out = buildCandidateExport(
      [
        app({ id: "a1", createdAt: new Date("2026-10-01T12:00:00Z"), aiScore: 70, status: "REJECTED" }),
        app({
          id: "a2",
          createdAt: new Date("2026-11-05T12:00:00Z"),
          aiScore: 55,
          status: "INTERVIEW",
          job: { title: "Repositor", code: null, aiMinScore: 60, isTalentPool: false },
        }),
      ],
      NOW
    );
    expect(out.people).toHaveLength(1);
    const p = out.people[0];
    expect(p.name).toBe("Maria da Silva");
    expect(p.email).toBe("maria@x.com");
    expect(p.applications).toBe(2);
    expect(p.jobs).toBe("Repositor; Promotor(a) (1123)");
    expect(p.currentStage).toBe("Entrevista"); // da candidatura mais recente
    expect(p.bestScore).toBe(70);
    expect(p.age).toBe(29); // faz 30 só no dia seguinte
    expect(out.applications).toHaveLength(2);
  });

  it("sem conta, agrupa pelo e-mail (ignorando maiúsculas); contas diferentes ficam separadas", () => {
    const out = buildCandidateExport(
      [
        app({ id: "a1", candidateId: null, email: "JOAO@x.com", name: "João" }),
        app({ id: "a2", candidateId: null, email: "joao@x.com", name: "João" }),
        app({ id: "a3", candidateId: "c9", email: "ana@x.com", name: "Ana" }),
      ],
      NOW
    );
    expect(out.people.map((p) => p.name)).toEqual(["Ana", "João"]); // ordem alfabética
    expect(out.people[1].applications).toBe(2);
  });

  it("usa o dado mais recente e completa com o antigo quando o novo veio vazio", () => {
    const out = buildCandidateExport(
      [
        app({ id: "a1", createdAt: new Date("2026-09-01T12:00:00Z"), phone: "1111", city: "Osasco" }),
        app({ id: "a2", createdAt: new Date("2026-11-01T12:00:00Z"), phone: null, city: "Barueri" }),
      ],
      NOW
    );
    expect(out.people[0].phone).toBe("1111");
    expect(out.people[0].city).toBe("Barueri");
  });

  it("traduz códigos para o que o gestor lê na tela", () => {
    const out = buildCandidateExport([app({})], NOW);
    const p = out.people[0];
    expect(p.source).toBe("Instagram");
    expect(p.workPreference).toBe("Presencial");
    expect(p.availability).toBe("Imediata");
    const a = out.applications[0];
    expect(a.stage).toBe("Triagem");
    expect(a.meetsMinimum).toBe("Sim");
    expect(a.job).toBe("Promotor(a)");
    expect(a.jobCode).toBe("1123");
  });

  it("cadastro espontâneo aparece como Banco de talentos, sem nota mínima", () => {
    const out = buildCandidateExport(
      [app({ job: { title: "interno", code: null, aiMinScore: 60, isTalentPool: true }, aiScore: null, aiState: "NO_RESUME" })],
      NOW
    );
    expect(out.applications[0].job).toBe("Banco de talentos");
    expect(out.applications[0].meetsMinimum).toBe("");
    expect(out.people[0].bestScore).toBeNull();
  });

  it("resumo conta pessoas, candidaturas, etapas e vagas", () => {
    const out = buildCandidateExport(
      [
        app({ id: "a1", status: "PENDING" }),
        app({ id: "a2", candidateId: "c2", email: "b@x.com", name: "Bia", status: "APPROVED" }),
        app({ id: "a3", candidateId: "c2", email: "b@x.com", name: "Bia", status: "PENDING", job: { title: "Repositor", code: null, aiMinScore: null, isTalentPool: false } }),
      ],
      NOW
    );
    expect(out.summary.people).toBe(2);
    expect(out.summary.applications).toBe(3);
    expect(out.summary.byStage).toEqual([
      { label: "Triagem", count: 2 },
      { label: "Em análise", count: 0 },
      { label: "Entrevista", count: 0 },
      { label: "Stand-by", count: 0 },
      { label: "Aprovado", count: 1 },
      { label: "Banco de dados", count: 0 },
    ]);
    expect(out.summary.byJob).toEqual([
      { label: "Promotor(a) (1123)", count: 2 },
      { label: "Repositor", count: 1 },
    ]);
  });

  it("não carrega RG, CPF, PcD, notas internas nem texto do currículo", () => {
    const dirty = {
      ...app({}),
      rg: "123",
      cpf: "11122233344",
      isPcd: true,
      pcdDetails: "x",
      managerNotes: "segredo",
      resumeText: "texto",
      aiReasoning: "motivo",
    } as ExportApplication;
    const json = JSON.stringify(buildCandidateExport([dirty], NOW));
    for (const leaked of ["11122233344", "segredo", "texto", "motivo", "pcd", "cpf"]) {
      expect(json.toLowerCase()).not.toContain(leaked);
    }
  });

  it("datas viram o dia do calendário de São Paulo", () => {
    // 02:30 UTC do dia 12 ainda é dia 11 em São Paulo.
    const out = buildCandidateExport([app({ createdAt: new Date("2026-11-12T02:30:00Z") })], NOW);
    expect(out.applications[0].appliedOn?.toISOString()).toBe("2026-11-11T00:00:00.000Z");
    // Nascimento é data pura: não muda de dia.
    expect(out.people[0].birthDate?.toISOString()).toBe("1996-11-12T00:00:00.000Z");
  });
});

describe("exportFileName", () => {
  it("usa o nome da empresa sem acento e a data", () => {
    expect(exportFileName("Tárhget & Cia.", NOW)).toBe("cadastrados-tarhget-cia-2026-11-11.xlsx");
    expect(exportFileName("", NOW)).toBe("cadastrados-2026-11-11.xlsx");
  });
});
