import { describe, expect, it } from "vitest";
import { renderCandidateResumePdfBuffer } from "@/components/report/candidate-resume-pdf";

describe("CandidateResumePdf", () => {
  it("gera um PDF válido com os dados e dossiê do candidato", async () => {
    const buffer = await renderCandidateResumePdfBuffer({
      id: "app-1",
      name: "Maria Clara Silva",
      email: "maria@exemplo.com",
      phone: "85999998888",
      city: "Fortaleza",
      state: "CE",
      neighborhood: "Aldeota",
      desiredRole: "Consultora de Vendas",
      instagram: "mariaclara",
      salaryExpectation: "R$ 2.500",
      workPreference: "Presencial",
      availability: "Imediata",
      hasCnh: "B",
      maritalStatus: "Solteira",
      professionalSummary: "Experiência sólida em atendimento consultivo e varejo.",
      status: "SHORTLISTED",
      aiScore: 88,
      aiReasoning: "Candidata com ótimo histórico em vendas e boa comunicação.",
      aiProfile: "Vendedora Consultiva",
      aiArea: "Vendas",
      aiLevel: "Pleno",
      aiHighlights: ["Experiência em varejo: 4 anos em lojas de shopping"],
      aiCareerSummary: null,
      resumeText: "Maria Clara Silva - Experiência: Loja X (2022-2026) como Consultora.",
      jobTitle: "Vendedor(a) Interno",
      companyName: "Empresa Exemplo",
      brandColor: "#7a1f3d",
      createdAt: new Date("2026-11-01T12:00:00Z"),
      answers: [
        { label: "Tem disponibilidade aos sábados?", value: "Sim, total disponibilidade" },
      ],
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.byteLength).toBeGreaterThan(500);
    expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });
});
