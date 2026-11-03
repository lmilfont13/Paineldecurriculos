import { describe, expect, it } from "vitest";

import {
  buildJobPostingJsonLd,
  jobDescriptionHtml,
  parseJobLocation,
  serializeJsonLd,
  type JobPostingInput,
} from "@/server/models/job-posting.model";

const base: JobPostingInput = {
  company: {
    name: "TARHGET FORTALEZA",
    slug: "technova",
    website: "https://tarhget.com.br",
    logoUrl: "https://cdn.example.com/logo.png",
  },
  job: {
    id: "job1",
    code: "1123",
    title: "Promotor(a) de Vendas",
    description: "Atendimento na loja.\n\nMetas mensais.",
    requirements: "Ensino médio\n- Boa comunicação",
    location: "Fortaleza, CE",
    contract: "CLT",
    workMode: "ONSITE",
    createdAt: new Date("2026-10-01T12:00:00Z"),
    isTalentPool: false,
  },
  url: "https://mt-triagem.vercel.app/technova/vagas/job1",
};

describe("parseJobLocation", () => {
  it("separa cidade e UF nos formatos comuns", () => {
    expect(parseJobLocation("Fortaleza, CE")).toEqual({ locality: "Fortaleza", region: "CE" });
    expect(parseJobLocation("Caucaia - ce")).toEqual({ locality: "Caucaia", region: "CE" });
    expect(parseJobLocation("São Paulo/SP")).toEqual({ locality: "São Paulo", region: "SP" });
  });

  it("sem UF válida vira só cidade; vazio vira null", () => {
    expect(parseJobLocation("Região Metropolitana")).toEqual({
      locality: "Região Metropolitana",
      region: null,
    });
    expect(parseJobLocation("Bairro, XX")).toEqual({ locality: "Bairro, XX", region: null });
    expect(parseJobLocation("  ")).toBeNull();
    expect(parseJobLocation(null)).toBeNull();
  });
});

describe("buildJobPostingJsonLd", () => {
  it("vaga presencial: campos exigidos pelo Google, com endereço", () => {
    const ld = buildJobPostingJsonLd(base)!;
    expect(ld["@type"]).toBe("JobPosting");
    expect(ld.title).toBe("Promotor(a) de Vendas");
    expect(ld.datePosted).toBe("2026-10-01T12:00:00.000Z");
    expect(ld.employmentType).toBe("FULL_TIME");
    expect(ld.identifier).toEqual({ "@type": "PropertyValue", name: "TARHGET FORTALEZA", value: "1123" });
    expect(ld.hiringOrganization).toEqual({
      "@type": "Organization",
      name: "TARHGET FORTALEZA",
      sameAs: "https://tarhget.com.br",
      logo: "https://cdn.example.com/logo.png",
    });
    expect(ld.jobLocation).toEqual({
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Fortaleza",
        addressRegion: "CE",
        addressCountry: "BR",
      },
    });
    expect(ld.jobLocationType).toBeUndefined();
  });

  it("vaga remota: TELECOMMUTE e candidatos do Brasil", () => {
    const ld = buildJobPostingJsonLd({
      ...base,
      job: { ...base.job, workMode: "REMOTE", location: null, contract: "PJ" },
    })!;
    expect(ld.jobLocationType).toBe("TELECOMMUTE");
    expect(ld.applicantLocationRequirements).toEqual({ "@type": "Country", name: "BR" });
    expect(ld.jobLocation).toBeUndefined();
    expect(ld.employmentType).toBe("CONTRACTOR");
  });

  it("não publica no Google a vaga oculta do banco de talentos nem a empresa demo", () => {
    expect(buildJobPostingJsonLd({ ...base, job: { ...base.job, isTalentPool: true } })).toBeNull();
    expect(
      buildJobPostingJsonLd({ ...base, company: { ...base.company, slug: "demo" } })
    ).toBeNull();
  });

  it("sem código usa o id; logo relativo fica de fora", () => {
    const ld = buildJobPostingJsonLd({
      ...base,
      company: { ...base.company, logoUrl: "/logo.png", website: null },
      job: { ...base.job, code: null },
    })!;
    expect((ld.identifier as { value: string }).value).toBe("job1");
    expect(ld.hiringOrganization).toEqual({ "@type": "Organization", name: "TARHGET FORTALEZA" });
  });
});

describe("descrição e serialização", () => {
  it("vira HTML simples, com requisitos em lista e texto escapado", () => {
    expect(jobDescriptionHtml("Olá <b>time</b>\nlinha 2\n\nFim", "Ensino médio\n- Boa comunicação")).toBe(
      "<p>Olá &lt;b&gt;time&lt;/b&gt;<br>linha 2</p><p>Fim</p>" +
        "<p><strong>Requisitos</strong></p><ul><li>Ensino médio</li><li>Boa comunicação</li></ul>"
    );
  });

  it("nenhum texto da vaga consegue fechar a tag <script>", () => {
    const ld = buildJobPostingJsonLd({
      ...base,
      job: { ...base.job, title: "</script><script>alert(1)</script>" },
    })!;
    const out = serializeJsonLd(ld);
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<");
    expect(JSON.parse(out).title).toBe("</script><script>alert(1)</script>");
  });
});
