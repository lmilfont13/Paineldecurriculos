import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import {
  listLiveDoubtsForCompany,
  submitLiveDoubtService,
  answerLiveDoubtService,
} from "@/server/services/live-doubt.service";

let fakeStorage: Record<string, string> = {};

vi.mock("@/server/repositories/live-doubt.repository", () => ({
  findLiveDoubtsRaw: vi.fn(async (companyId: string) => fakeStorage[companyId] ?? null),
  saveLiveDoubtsRaw: vi.fn(async (companyId: string, body: string) => {
    fakeStorage[companyId] = body;
  }),
}));

vi.mock("@/server/services/company.service", () => ({
  getPublicCompanyBySlug: vi.fn(async (slug: string) => {
    if (slug === "targuet") {
      return { id: "comp-123", name: "Tárguet", slug: "targuet" };
    }
    return null;
  }),
}));

describe("live-doubt service", () => {
  beforeEach(() => {
    fakeStorage = {};
  });

  it("permite candidato enviar uma dúvida ao vivo com sucesso", async () => {
    const res = await submitLiveDoubtService({
      companySlug: "targuet",
      candidateName: "Larissa Mendes",
      contact: "11988887777",
      question: "Qual é a escala de trabalho desta vaga de caixa?",
      path: "/targuet/vagas/caixa",
    });

    expect(res.ok).toBe(true);
    expect(res.doubt).toBeDefined();
    expect(res.doubt?.candidateName).toBe("Larissa Mendes");
    expect(res.doubt?.status).toBe("pending");
    expect(res.doubt?.question).toContain("escala de trabalho");

    const list = await listLiveDoubtsForCompany("comp-123");
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(res.doubt?.id);
  });

  it("retorna erro se a empresa não existir", async () => {
    const res = await submitLiveDoubtService({
      companySlug: "empresa-fantasma",
      candidateName: "João",
      question: "Dúvida teste",
    });

    expect(res.ok).toBe(false);
    expect(res.error).toBe("Empresa não encontrada");
  });

  it("permite gestor responder a dúvida do candidato", async () => {
    const sub = await submitLiveDoubtService({
      companySlug: "targuet",
      candidateName: "Carlos Pereira",
      question: "Precisa ter experiência prévia?",
    });

    const doubtId = sub.doubt!.id;

    const ans = await answerLiveDoubtService({
      companyId: "comp-123",
      doubtId,
      answer: "Olá Carlos! Não exigimos experiência prévia para esta vaga, oferecemos treinamento.",
      answeredBy: "Ana (Recrutadora Tárguet)",
    });

    expect(ans.ok).toBe(true);
    expect(ans.doubt?.status).toBe("answered");
    expect(ans.doubt?.answer).toContain("oferecemos treinamento");
    expect(ans.doubt?.answeredBy).toBe("Ana (Recrutadora Tárguet)");
    expect(ans.doubt?.answeredAt).toBeDefined();

    const list = await listLiveDoubtsForCompany("comp-123");
    expect(list[0].status).toBe("answered");
    expect(list[0].answer).toContain("oferecemos treinamento");
  });

  it("retorna erro ao tentar responder dúvida inexistente", async () => {
    const ans = await answerLiveDoubtService({
      companyId: "comp-123",
      doubtId: "doubt-9999",
      answer: "Resposta qualquer",
      answeredBy: "Gestor",
    });

    expect(ans.ok).toBe(false);
    expect(ans.error).toBe("Dúvida não encontrada");
  });
});
