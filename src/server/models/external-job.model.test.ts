import { describe, expect, it } from "vitest";
import {
  dedupeExternalJobs,
  externalJobSearchSchema,
  importExternalJobsSchema,
  isGenericSearchUrl,
  isSafeHttpUrl,
  normalizeSource,
  parseGoogleJobResult,
} from "./external-job.model";

const sample = {
  title: "Promotor de Vendas",
  company_name: "Distribuidora XYZ",
  location: "Fortaleza, CE",
  via: "via LinkedIn",
  description: "Atuar no PDV   repondo produtos.",
  job_id: "abc123",
  detected_extensions: { posted_at: "há 2 dias", schedule_type: "Tempo integral" },
  apply_options: [
    { title: "LinkedIn", link: "javascript:alert(1)" },
    { title: "Gupy", link: "https://empresa.gupy.io/vaga/1" },
  ],
};

describe("external-job.model", () => {
  it("converte um resultado do Google Vagas", () => {
    const job = parseGoogleJobResult(sample);
    expect(job).toEqual({
      externalId: "abc123",
      title: "Promotor de Vendas",
      employer: "Distribuidora XYZ",
      location: "Fortaleza, CE",
      description: "Atuar no PDV repondo produtos.",
      source: "LinkedIn",
      applyUrl: "https://empresa.gupy.io/vaga/1",
      postedLabel: "há 2 dias",
      scheduleType: "Tempo integral",
    });
  });

  it("ignora links inseguros e descarta vaga sem link válido", () => {
    expect(
      parseGoogleJobResult({ ...sample, apply_options: [{ link: "javascript:x" }], share_link: undefined })
    ).toBeNull();
    expect(isSafeHttpUrl("data:text/html,x")).toBe(false);
    expect(isSafeHttpUrl("https://ok.com")).toBe(true);
  });

  it("usa share_link quando não há apply_options", () => {
    const job = parseGoogleJobResult({ ...sample, apply_options: undefined, share_link: "https://www.google.com/x" });
    expect(job?.applyUrl).toBe("https://www.google.com/x");
  });

  it("gera id estável quando falta job_id e descarta sem título/empresa", () => {
    const a = parseGoogleJobResult({ ...sample, job_id: undefined });
    const b = parseGoogleJobResult({ ...sample, job_id: undefined });
    expect(a?.externalId).toMatch(/^h_/);
    expect(a?.externalId).toBe(b?.externalId);
    expect(parseGoogleJobResult({ ...sample, title: "" })).toBeNull();
    expect(parseGoogleJobResult({ ...sample, company_name: undefined })).toBeNull();
  });

  it("remove duplicados e normaliza a fonte", () => {
    const job = parseGoogleJobResult(sample)!;
    expect(dedupeExternalJobs([job, job])).toHaveLength(1);
    expect(normalizeSource("via Indeed")).toBe("Indeed");
  });

  it("schema de importação rejeita link inseguro", () => {
    const job = parseGoogleJobResult(sample)!;
    expect(importExternalJobsSchema.safeParse([job]).success).toBe(true);
    expect(importExternalJobsSchema.safeParse([{ ...job, applyUrl: "javascript:x" }]).success).toBe(false);
    expect(importExternalJobsSchema.safeParse([]).success).toBe(false);
  });

  it("valida schema de busca para cargo, localidade e modalidade (cargo não obrigatório)", () => {
    // Cargo + localidade
    expect(externalJobSearchSchema.safeParse({ query: "Vendedor", location: "São Paulo" }).success).toBe(true);
    // Apenas localidade (sem cargo) -> VÁLIDO!
    expect(externalJobSearchSchema.safeParse({ location: "Fortaleza" }).success).toBe(true);
    // Apenas modalidade remota (sem cargo e sem localidade) -> VÁLIDO!
    expect(externalJobSearchSchema.safeParse({ workplaceType: "remote" }).success).toBe(true);
    // Apenas modalidade presencial com localidade
    expect(externalJobSearchSchema.safeParse({ location: "Recife", workplaceType: "on-site" }).success).toBe(true);
    // Tudo vazio com query curta -> inválido
    expect(externalJobSearchSchema.safeParse({ query: "A" }).success).toBe(false);
    expect(externalJobSearchSchema.safeParse({}).success).toBe(false);
  });

  it("distingue links diretos de vaga de URLs genéricas de busca", () => {
    // Links diretos da vaga (deve ser false -> não é busca genérica)
    expect(isGenericSearchUrl("https://empresa.gupy.io/job/123456")).toBe(false);
    expect(isGenericSearchUrl("https://unilider.gupy.io/job/eyJqb2JJZCI6MTI4NTM3NDAsInNvdXJjZSI6Imd1cHlfcG9ydGFsIn0=")).toBe(false);
    expect(isGenericSearchUrl("https://www.linkedin.com/jobs/view/394857291/")).toBe(false);
    expect(isGenericSearchUrl("https://www.vagas.com.br/vagas/v2654321/analista-financeiro")).toBe(false);
    expect(isGenericSearchUrl("https://empresa.com.br/carreiras/vaga-123")).toBe(false);
    expect(isGenericSearchUrl("https://www.google.com/search?ibp=htl;jobs#htidocid=abc123xyz")).toBe(false);

    // Links de busca genérica / listagem / catálogos (deve ser true -> é busca genérica!)
    expect(isGenericSearchUrl("https://www.gupy.io/vagas?jobName=vendedor")).toBe(true);
    expect(isGenericSearchUrl("https://portal.gupy.io/job-search/term=vendedor")).toBe(true);
    expect(isGenericSearchUrl("https://www.linkedin.com/jobs/search/?keywords=vendedor")).toBe(true);
    expect(isGenericSearchUrl("https://www.google.com/search?ibp=htl;jobs&q=vendedor")).toBe(true);
    expect(isGenericSearchUrl("https://www.vagas.com.br/vagas-de-vendedor?q=vendedor")).toBe(true);
    expect(isGenericSearchUrl("https://br.indeed.com/jobs?q=vendedor")).toBe(true);
    expect(isGenericSearchUrl("invalid-url")).toBe(true);
  });
});

