import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { saveTemplate, findTemplate } = vi.hoisted(() => ({
  saveTemplate: vi.fn(),
  findTemplate: vi.fn(),
}));
vi.mock("@/server/repositories/message-template.repository", () => ({
  saveTemplate,
  findTemplate,
  findTemplatesByCompany: vi.fn(async () => []),
}));

import {
  rememberMessageTemplate,
  savedMessageForSubject,
} from "@/server/services/message-template.service";

const ctx = { firstName: "Maria", companyName: "Loja X", jobTitle: "Consultor" };

beforeEach(() => {
  saveTemplate.mockReset();
  findTemplate.mockReset();
});

describe("rememberMessageTemplate", () => {
  it("salva por empresa, com chave normalizada e marcadores", async () => {
    await rememberMessageTemplate("co1", "  Informações pendentes ", "Maria, a Loja X precisa de dados.", ctx);
    expect(saveTemplate).toHaveBeenCalledWith(
      "co1",
      "Informações pendentes",
      "informacoes pendentes",
      "{nome}, a {empresa} precisa de dados."
    );
  });
  it("sem assunto ou sem texto não salva nada", async () => {
    await rememberMessageTemplate("co1", "   ", "texto", ctx);
    await rememberMessageTemplate("co1", "Assunto", "   ", ctx);
    expect(saveTemplate).not.toHaveBeenCalled();
  });
  it("limita o tamanho do assunto", async () => {
    await rememberMessageTemplate("co1", "x".repeat(200), "texto longo ok", ctx);
    expect(saveTemplate.mock.calls[0][1]).toHaveLength(80);
  });
});

describe("savedMessageForSubject", () => {
  it("devolve o modelo já preenchido para o candidato", async () => {
    findTemplate.mockResolvedValue({ body: "{nome}, falta pouco para {vaga}." });
    expect(await savedMessageForSubject("co1", "Falta pouco", ctx)).toBe(
      "Maria, falta pouco para Consultor."
    );
    expect(findTemplate).toHaveBeenCalledWith("co1", "falta pouco");
  });
  it("sem modelo salvo devolve null", async () => {
    findTemplate.mockResolvedValue(null);
    expect(await savedMessageForSubject("co1", "Novo", ctx)).toBeNull();
  });
});

import { saveMessageTemplate } from "@/server/services/message-template.service";

describe("saveMessageTemplate", () => {
  it("guarda o texto como foi escrito (já com marcadores), pela chave do assunto", async () => {
    await saveMessageTemplate("co1", "  Retorno Final ", "{nome}, obrigado pelo interesse na {vaga}.");
    expect(saveTemplate).toHaveBeenCalledWith(
      "co1",
      "Retorno Final",
      "retorno final",
      "{nome}, obrigado pelo interesse na {vaga}."
    );
  });
  it("sem assunto ou sem texto não salva", async () => {
    await saveMessageTemplate("co1", "  ", "texto");
    await saveMessageTemplate("co1", "Assunto", "  ");
    expect(saveTemplate).not.toHaveBeenCalled();
  });
});
