/**
 * Dados estruturados (JSON-LD, schema.org `JobPosting`) da página pública da
 * vaga — é o que faz a vaga aparecer na busca de empregos do Google (Google
 * for Jobs). Funções puras, testadas em job-posting.model.test.ts.
 *
 * Só dados que o candidato já vê na página. Nada de IA, notas ou critérios.
 */
import type { Contract, WorkMode } from "@prisma/client";

import { isHiddenFromDirectory } from "@/server/models/company.model";

export type JobPostingInput = {
  company: {
    name: string;
    slug: string;
    website?: string | null;
    logoUrl?: string | null;
  };
  job: {
    id: string;
    code?: string | null;
    title: string;
    description: string;
    requirements?: string | null;
    location?: string | null;
    contract: Contract;
    workMode: WorkMode;
    /** Data em que a vaga entrou no ar. */
    createdAt: Date;
    isTalentPool?: boolean;
  };
  /** URL pública absoluta da vaga. */
  url: string;
};

/** Tipo de contrato → `employmentType` do Google. */
export const EMPLOYMENT_TYPE: Record<Contract, string> = {
  CLT: "FULL_TIME",
  PJ: "CONTRACTOR",
  FREELANCE: "CONTRACTOR",
  INTERNSHIP: "INTERN",
};

/** Siglas das UFs, para separar "Fortaleza, CE" em cidade e estado. */
const UFS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

/**
 * "Fortaleza, CE" / "Fortaleza - CE" / "Fortaleza/CE" → cidade e UF.
 * Sem UF reconhecível, tudo vira cidade. Vazio → null.
 */
export function parseJobLocation(
  location: string | null | undefined
): { locality: string; region: string | null } | null {
  const text = (location ?? "").trim();
  if (!text) return null;
  const match = text.match(/^(.+?)\s*[,/–-]\s*([A-Za-z]{2})\s*$/);
  if (match && UFS.has(match[2].toUpperCase())) {
    return { locality: match[1].trim(), region: match[2].toUpperCase() };
  }
  return { locality: text, region: null };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Texto da vaga em HTML simples (o Google aceita e exibe os parágrafos). */
export function jobDescriptionHtml(description: string, requirements?: string | null): string {
  const paragraphs = description
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`);
  const items = (requirements ?? "")
    .split("\n")
    .map((r) => r.replace(/^\s*[-•*]\s*/, "").trim())
    .filter(Boolean)
    .map((r) => `<li>${escapeHtml(r)}</li>`);
  if (items.length > 0) paragraphs.push(`<p><strong>Requisitos</strong></p><ul>${items.join("")}</ul>`);
  return paragraphs.join("");
}

/**
 * Monta o `JobPosting`. Devolve null quando a vaga não deve ir para buscador:
 * vaga oculta do banco de talentos ou empresa fora das vitrines (demo).
 */
export function buildJobPostingJsonLd(input: JobPostingInput): Record<string, unknown> | null {
  const { company, job, url } = input;
  if (job.isTalentPool || isHiddenFromDirectory(company.slug)) return null;

  const hiringOrganization: Record<string, unknown> = {
    "@type": "Organization",
    name: company.name,
  };
  if (company.website) hiringOrganization.sameAs = company.website;
  if (company.logoUrl && /^https?:\/\//.test(company.logoUrl)) {
    hiringOrganization.logo = company.logoUrl;
  }

  const posting: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.title,
    description: jobDescriptionHtml(job.description, job.requirements),
    identifier: {
      "@type": "PropertyValue",
      name: company.name,
      value: job.code || job.id,
    },
    datePosted: job.createdAt.toISOString(),
    employmentType: EMPLOYMENT_TYPE[job.contract],
    hiringOrganization,
    url,
  };

  const place = parseJobLocation(job.location);
  if (job.workMode === "REMOTE") {
    // Remota: o Google pede o tipo e de onde a pessoa pode trabalhar.
    posting.jobLocationType = "TELECOMMUTE";
    posting.applicantLocationRequirements = { "@type": "Country", name: "BR" };
  }
  if (job.workMode !== "REMOTE" || place) {
    posting.jobLocation = {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        ...(place ? { addressLocality: place.locality } : {}),
        ...(place?.region ? { addressRegion: place.region } : {}),
        addressCountry: "BR",
      },
    };
  }
  return posting;
}

/**
 * Serializa para dentro de `<script type="application/ld+json">`. Troca `<`
 * pelo escape unicode para nenhum texto da vaga fechar a tag (XSS), como
 * recomenda o guia de JSON-LD do Next.
 */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
