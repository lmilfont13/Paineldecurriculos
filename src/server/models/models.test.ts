import { describe, expect, it } from "vitest";

import {
  applicationInputSchema,
  formatAppliedAt,
} from "@/server/models/application.model";
import {
  brandCssVars,
  brandForeground,
  companyDataSchema,
  createCompanySchema,
} from "@/server/models/company.model";
import {
  candidateSignupSchema,
} from "@/server/models/candidate.model";
import {
  applyFilters,
  countByStage,
  meetsMinimum,
  selectStage,
  sortRows,
  type CandidaturaRow,
} from "@/server/models/candidate-list.model";
import { personInitials } from "@/server/models/dashboard.model";
import {
  formatNotificationAge,
  stageNotification,
  whatHappensNow,
} from "@/server/models/notification.model";
import {
  formatJobMeta,
  formatPublishedAgo,
  jobFormSchema,
  requirementsToBullets,
} from "@/server/models/job.model";

describe("brandForeground (contraste da marca)", () => {
  it("usa texto branco sobre cores escuras", () => {
    expect(brandForeground("#1E4FBF")).toBe("#ffffff"); // azul TechNova
    expect(brandForeground("#eb002f")).toBe("#ffffff"); // vermelho tarhget
    expect(brandForeground("#0a0a0a")).toBe("#ffffff");
  });
  it("usa texto escuro sobre cores claras", () => {
    expect(brandForeground("#FFD700")).toBe("#0a0a0a"); // amarelo
    expect(brandForeground("#ffffff")).toBe("#0a0a0a");
    expect(brandForeground("#a3e635")).toBe("#0a0a0a"); // lima
  });
  it("cai em branco para valores malformados", () => {
    expect(brandForeground("#fff")).toBe("#ffffff");
    expect(brandForeground("")).toBe("#ffffff");
  });
});

describe("brandCssVars", () => {
  it("expõe as três CSS vars", () => {
    const vars = brandCssVars({
      primaryColor: "#1E4FBF",
      secondaryColor: "#0E7A6B",
    });
    expect(vars["--brand-primary"]).toBe("#1E4FBF");
    expect(vars["--brand-secondary"]).toBe("#0E7A6B");
    expect(vars["--brand-foreground"]).toBe("#ffffff");
  });
});

describe("formatJobMeta", () => {
  const base = {
    id: "1",
    title: "Dev",
    description: "x",
    requirements: null,
    createdAt: new Date(),
  };
  it("com localização → 'local · modelo'", () => {
    expect(
      formatJobMeta({
        ...base,
        location: "Fortaleza, CE",
        workMode: "HYBRID",
        contract: "CLT",
      })
    ).toBe("Fortaleza, CE · Híbrido");
  });
  it("sem localização → 'modelo · contrato'", () => {
    expect(
      formatJobMeta({
        ...base,
        location: null,
        workMode: "REMOTE",
        contract: "PJ",
      })
    ).toBe("Remoto · PJ");
  });
});

describe("formatPublishedAgo", () => {
  it("hoje", () => {
    expect(formatPublishedAgo(new Date())).toBe("publicada hoje");
  });
  it("singular e plural", () => {
    const day = 24 * 60 * 60 * 1000;
    expect(formatPublishedAgo(new Date(Date.now() - 1 * day))).toBe(
      "publicada há 1 dia"
    );
    expect(formatPublishedAgo(new Date(Date.now() - 5 * day))).toBe(
      "publicada há 5 dias"
    );
  });
});

describe("requirementsToBullets", () => {
  it("quebra por linha, remove marcadores e vazios", () => {
    expect(requirementsToBullets("- React\n\n• Node\n  SQL  ")).toEqual([
      "React",
      "Node",
      "SQL",
    ]);
  });
  it("null → lista vazia", () => {
    expect(requirementsToBullets(null)).toEqual([]);
  });
});

describe("personInitials", () => {
  it("primeiro + último nome", () => {
    expect(personInitials("Marcos Vinícius Souza")).toBe("MS");
  });
  it("nome único", () => {
    expect(personInitials("tarhget")).toBe("T");
  });
});

describe("formatAppliedAt", () => {
  it("com e sem hora", () => {
    const date = new Date(2026, 6, 9, 14, 32);
    expect(formatAppliedAt(date)).toMatch(/9 de jul/);
    expect(formatAppliedAt(date, true)).toMatch(/14:32/);
  });
});

describe("schemas zod", () => {
  it("companyDataSchema valida slug", () => {
    expect(
      companyDataSchema.safeParse({
        name: "Tech",
        slug: "tech-nova2",
        email: "a@b.com",
      }).success
    ).toBe(true);
    expect(
      companyDataSchema.safeParse({
        name: "Tech",
        slug: "Tech Nova!",
        email: "a@b.com",
      }).success
    ).toBe(false);
  });

  it("createCompanySchema exige gestor completo", () => {
    const base = {
      name: "Tech",
      slug: "tech",
      email: "a@b.com",
      primaryColor: "#1E4FBF",
      secondaryColor: "#0E7A6B",
      heroTitle: "Vagas",
      heroSubtitle: "Sub",
      managerName: "Ana",
      managerEmail: "ana@b.com",
      managerPassword: "12345678",
    };
    expect(createCompanySchema.safeParse(base).success).toBe(true);
    expect(
      createCompanySchema.safeParse({ ...base, managerPassword: "123" }).success
    ).toBe(false);
    expect(
      createCompanySchema.safeParse({ ...base, primaryColor: "azul" }).success
    ).toBe(false);
  });

  it("jobFormSchema limita score e critérios", () => {
    const base = {
      title: "Dev Pleno",
      description: "Descrição longa da vaga",
      contract: "CLT",
      workMode: "REMOTE",
      aiCriteria: ["React"],
      aiMinScore: 70,
    };
    expect(jobFormSchema.safeParse(base).success).toBe(true);
    expect(
      jobFormSchema.safeParse({ ...base, aiMinScore: 101 }).success
    ).toBe(false);
    expect(
      jobFormSchema.safeParse({ ...base, aiCriteria: Array(11).fill("x") })
        .success
    ).toBe(false);
  });

  it("applicationInputSchema não aceita telefone curto", () => {
    const base = {
      slug: "technova",
      jobId: "abc",
      name: "Juliana Alves",
      phone: "(85) 99123-4567",
      answers: {},
    };
    expect(applicationInputSchema.safeParse(base).success).toBe(true);
    expect(
      applicationInputSchema.safeParse({ ...base, phone: "123" }).success
    ).toBe(false);
  });

  it("candidateSignupSchema exige senha de 8+", () => {
    expect(
      candidateSignupSchema.safeParse({
        name: "Ju",
        email: "ju@x.com",
        password: "12345678",
      }).success
    ).toBe(true);
    expect(
      candidateSignupSchema.safeParse({
        name: "Ju",
        email: "ju@x.com",
        password: "1234",
      }).success
    ).toBe(false);
  });
});

describe("lista de candidatos (etapas, filtros e ordem)", () => {
  const row = (
    over: Partial<CandidaturaRow> & Pick<CandidaturaRow, "id">
  ): CandidaturaRow => ({
    name: "Fulano de Tal",
    email: "fulano@email.com",
    createdAt: "2026-07-10T12:00:00.000Z",
    status: "PENDING",
    aiState: "DONE",
    aiScore: 80,
    resumeUrl: "cv.pdf",
    jobId: "vaga-1",
    jobTitle: "Full Stack",
    aiMinScore: 70,
    ...over,
  });

  const rows: CandidaturaRow[] = [
    row({ id: "a", name: "Ana Lima", createdAt: "2026-07-01T00:00:00.000Z", aiScore: 90 }),
    row({ id: "b", name: "Bruno Sá", createdAt: "2026-07-05T00:00:00.000Z", aiScore: 60 }),
    row({ id: "c", name: "Célia Rocha", createdAt: "2026-07-09T00:00:00.000Z", status: "INTERVIEW", aiScore: null, aiState: "NO_RESUME" }),
    row({ id: "d", name: "Davi Souza", createdAt: "2026-07-02T00:00:00.000Z", status: "REJECTED", jobId: "vaga-2" }),
  ];

  it("conta cada etapa e o total", () => {
    const counts = countByStage(rows);
    expect(counts.PENDING).toBe(2);
    expect(counts.INTERVIEW).toBe(1);
    expect(counts.REJECTED).toBe(1);
    expect(counts.APPROVED).toBe(0);
    expect(counts.ALL).toBe(4);
  });

  it("as contagens respeitam os filtros ativos", () => {
    const counts = countByStage(
      applyFilters(rows, { search: "", jobId: "vaga-2", onlyMeets: false })
    );
    expect(counts.ALL).toBe(1);
    expect(counts.PENDING).toBe(0);
  });

  it("busca por nome ou e-mail, sem diferenciar caixa", () => {
    expect(
      applyFilters(rows, { search: "ANA", jobId: "", onlyMeets: false })
    ).toHaveLength(1);
    expect(
      applyFilters(rows, { search: "fulano@", jobId: "", onlyMeets: false })
    ).toHaveLength(4);
  });

  it("só quem atende o mínimo exclui abaixo do corte e sem análise", () => {
    const kept = applyFilters(rows, {
      search: "",
      jobId: "",
      onlyMeets: true,
    }).map((r) => r.id);
    expect(kept).toEqual(["a", "d"]); // b tem 60 (<70) e c não tem score
  });

  it("triagem ordenada por espera começa por quem chegou primeiro", () => {
    const ids = sortRows(selectStage(rows, "PENDING"), "WAITING").map((r) => r.id);
    expect(ids).toEqual(["a", "b"]);
  });

  it("mais recentes inverte a ordem do tempo", () => {
    const ids = sortRows(rows, "RECENT").map((r) => r.id);
    expect(ids).toEqual(["c", "b", "d", "a"]);
  });

  it("por aderência joga quem não tem score para o fim", () => {
    const ids = sortRows(rows, "SCORE").map((r) => r.id);
    expect(ids[0]).toBe("a");
    expect(ids.at(-1)).toBe("c");
  });

  it("meetsMinimum trata score ausente como não atende", () => {
    expect(meetsMinimum(row({ id: "x", aiScore: null }))).toBe(false);
    expect(meetsMinimum(row({ id: "x", aiScore: 70, aiMinScore: 70 }))).toBe(true);
  });
});

describe("notificações do candidato", () => {
  it("cada etapa vira uma novidade na voz do candidato", () => {
    expect(stageNotification("INTERVIEW", "tarhget", "Full Stack")?.title).toBe(
      "Você avançou para a entrevista"
    );
    expect(stageNotification("APPROVED", "tarhget", "Full Stack")?.type).toBe(
      "RESULT"
    );
  });

  it("reprovado nunca aparece como reprovado para o candidato", () => {
    const rejected = stageNotification("REJECTED", "tarhget", "Full Stack");
    expect(rejected?.title).toBe("Processo finalizado");
    expect(`${rejected?.title} ${rejected?.body}`.toLowerCase()).not.toContain(
      "reprovad"
    );
  });

  it("voltar para triagem é conserto do gestor e não gera novidade", () => {
    expect(stageNotification("PENDING", "tarhget", "Full Stack")).toBeNull();
  });

  it("nenhum texto de novidade menciona score ou análise da IA", () => {
    const textos = (["INTERVIEW", "APPROVED", "REJECTED"] as const)
      .map((s) => {
        const n = stageNotification(s, "tarhget", "Full Stack");
        return `${n?.title} ${n?.body}`;
      })
      .concat(
        (["PENDING", "INTERVIEW", "APPROVED", "REJECTED"] as const).map((s) =>
          whatHappensNow(s, "tarhget")
        )
      )
      .join(" ")
      .toLowerCase();
    for (const proibido of ["score", "pontos", "aderência", "ia ", "nota"]) {
      expect(textos).not.toContain(proibido);
    }
  });

  it("toda etapa tem uma frase de expectativa", () => {
    for (const status of ["PENDING", "INTERVIEW", "APPROVED", "REJECTED"] as const) {
      expect(whatHappensNow(status, "tarhget").length).toBeGreaterThan(20);
    }
  });

  it("idade da novidade em linguagem de gente", () => {
    const min = 60_000;
    expect(formatNotificationAge(new Date(Date.now() - min))).toBe(
      "agora há pouco"
    );
    expect(formatNotificationAge(new Date(Date.now() - 30 * min))).toBe(
      "há 30 min"
    );
    expect(formatNotificationAge(new Date(Date.now() - 3 * 60 * min))).toBe(
      "há 3 h"
    );
    expect(formatNotificationAge(new Date(Date.now() - 24 * 60 * min))).toBe(
      "ontem"
    );
    expect(formatNotificationAge(new Date(Date.now() - 72 * 60 * min))).toBe(
      "há 3 dias"
    );
  });
});
