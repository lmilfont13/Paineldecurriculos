import { describe, expect, it } from "vitest";
import {
  dedupeExternalJobs,
  externalJobSearchSchema,
  importExternalJobsSchema,
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

  it("valida schema de busca para cargo e localidade", () => {
    expect(externalJobSearchSchema.safeParse({ query: "Vendedor", location: "São Paulo" }).success).toBe(true);
    expect(externalJobSearchSchema.safeParse({ query: "A" }).success).toBe(false); // min 2
  });
});

