import { describe, expect, it } from "vitest";

import {
  applicationResumePrefix,
  hasPdfSignature,
  isAllowedResumePath,
  isDemoResumePath,
  looksLikePdf,
  profileResumePrefix,
} from "@/server/models/application.model";

const UUID = "123e4567-e89b-42d3-a456-426614174000";

describe("looksLikePdf", () => {
  it("aceita application/pdf", () => {
    expect(looksLikePdf({ name: "cv", type: "application/pdf" })).toBe(true);
  });
  it("aceita MIME vazio/genérico do celular quando a extensão é .pdf", () => {
    expect(looksLikePdf({ name: "CV Maria.PDF", type: "" })).toBe(true);
    expect(
      looksLikePdf({ name: "cv.pdf", type: "application/octet-stream" })
    ).toBe(true);
  });
  it("recusa outros tipos", () => {
    expect(looksLikePdf({ name: "cv.docx", type: "" })).toBe(false);
    expect(looksLikePdf({ name: "cv.pdf", type: "image/jpeg" })).toBe(false);
  });
});

describe("hasPdfSignature", () => {
  it("reconhece %PDF-", () => {
    expect(hasPdfSignature(new TextEncoder().encode("%PDF-1.7"))).toBe(true);
  });
  it("recusa outro conteúdo", () => {
    expect(hasPdfSignature(new TextEncoder().encode("PK\u0003\u0004"))).toBe(false);
    expect(hasPdfSignature(new Uint8Array())).toBe(false);
  });
});

describe("isAllowedResumePath", () => {
  const prefix = applicationResumePrefix("co1", "job1", "cand1");

  it("aceita o caminho emitido para o próprio candidato", () => {
    expect(isAllowedResumePath(`${prefix}${UUID}.pdf`, prefix)).toBe(true);
  });
  it("recusa caminho de outro candidato, vaga ou empresa", () => {
    const other = applicationResumePrefix("co1", "job1", "cand2");
    expect(isAllowedResumePath(`${other}${UUID}.pdf`, prefix)).toBe(false);
    expect(
      isAllowedResumePath(`co2/job1/cand1/${UUID}.pdf`, prefix)
    ).toBe(false);
  });
  it("recusa travessia de diretório e nomes fora do padrão", () => {
    expect(isAllowedResumePath(`${prefix}../x/${UUID}.pdf`, prefix)).toBe(false);
    expect(isAllowedResumePath(`${prefix}qualquer.pdf`, prefix)).toBe(false);
    expect(isAllowedResumePath(`${prefix}${UUID}.exe`, prefix)).toBe(false);
  });
  it("prefixo do perfil é por candidato", () => {
    expect(
      isAllowedResumePath(`profile/cand1/${UUID}.pdf`, profileResumePrefix("cand1"))
    ).toBe(true);
    expect(
      isAllowedResumePath(`profile/cand2/${UUID}.pdf`, profileResumePrefix("cand1"))
    ).toBe(false);
  });
});

describe("isDemoResumePath", () => {
  it("identifica o currículo de demonstração", () => {
    expect(isDemoResumePath("demo/curriculo-candidato-ficticio.pdf")).toBe(true);
    expect(isDemoResumePath("co1/job1/x.pdf")).toBe(false);
    expect(isDemoResumePath(null)).toBe(false);
  });
});
