import { describe, expect, it } from "vitest";

import { buildFolderBrief, parseJobDraft } from "@/server/models/job-draft.model";
import { folderArea, groupFoldersByArea, suggestFolderName } from "@/server/models/talent.model";
import { parseSegment } from "@/server/models/ai.model";

describe("segmentação do currículo", () => {
  it("lê área, função e nível", () => {
    expect(
      parseSegment('{"profile":{"area":"logística","role":"motorista e entregador.","level":"pleno"}}')
    ).toEqual({ area: "Logística", role: "Motorista e entregador", level: "Pleno" });
    expect(parseSegment('{"profile":"promotor de vendas"}')).toEqual({
      area: null,
      role: "Promotor de vendas",
      level: null,
    });
    expect(parseSegment('{"profile":{"level":"Coordenador"}}').level).toBe("Liderança");
  });

  it("monta o nome da pasta como Área · Função", () => {
    expect(suggestFolderName({ area: "Logística", role: "Motorista e entregador" })).toBe(
      "Logística · Motorista e entregador"
    );
    expect(suggestFolderName({ area: null, role: "Promotor de vendas" })).toBe("Promotor de vendas");
    expect(suggestFolderName({ area: "Vendas", role: "vendas" })).toBe("vendas");
  });

  it("agrupa as pastas por área", () => {
    const groups = groupFoldersByArea([
      { name: "Logística · Motorista" },
      { name: "Avulsa" },
      { name: "Conferente", area: "Logística" },
      { name: "Administrativo · Recepção" },
    ]);
    expect(groups.map((g) => g.area)).toEqual(["Administrativo", "Logística", "Outros"]);
    expect(groups[1].folders.map((f) => f.name)).toEqual(["Conferente", "Logística · Motorista"]);
    expect(folderArea({ name: "Sem área" })).toBe("Outros");
  });
});

describe("rascunho de vaga a partir da pasta", () => {
  it("resume a pasta sem dados pessoais", () => {
    const brief = buildFolderBrief({
      name: "Logística · Motorista",
      area: "Logística",
      people: [
        { aiProfile: "Motorista e entregador", aiLevel: "Pleno", jobTitle: "Assistente Administrativo" },
        { aiProfile: "Motorista e entregador", aiLevel: "Operacional", jobTitle: "Promotor" },
      ],
    });
    expect(brief).toContain("Funções: Motorista e entregador (2)");
    expect(brief).toContain("Candidatos guardados: 2");
  });

  it("garante campos e limites", () => {
    const draft = parseJobDraft(
      '{"title":"Motorista Entregador","description":"Entregas na região.","requirements":["CNH B","Experiência com rotas"],"criteria":["Experiência com entregas","CNH","Rotas urbanas","Atendimento"],"minScore":95}',
      "Motorista"
    );
    expect(draft).toMatchObject({ title: "Motorista Entregador", aiMinScore: 80 });
    expect(draft.requirements).toBe("• CNH B\n• Experiência com rotas");
    expect(draft.aiCriteria).toHaveLength(4);

    const empty = parseJobDraft("sem json", "Logística · Motorista");
    expect(empty.title).toBe("Logística · Motorista");
    expect(empty.description.length).toBeGreaterThan(10);
    expect(empty.aiMinScore).toBe(60);
    expect(empty.aiCriteria.length).toBeGreaterThan(0);
  });
});
