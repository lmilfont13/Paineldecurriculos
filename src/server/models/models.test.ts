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
import { personInitials } from "@/server/models/dashboard.model";
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
