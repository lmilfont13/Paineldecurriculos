import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const runs: Record<string, Record<string, unknown>[]> = {};
const app = {
  id: "app1",
  name: "Rafael Nogueira Lima",
  resumeUrl: "demo/curriculo-ficticio-rafael.pdf",
  answers: [] as { value: string; field: { label: string; type: string } }[],
  company: { id: "co1" },
  photoPath: null as string | null,
  job: { title: "Assistente Administrativo", aiCriteria: ["Excel", "E-commerce"], requirements: null },
};
const aiUpdates: Record<string, unknown>[] = [];

vi.mock("@/server/repositories/application.repository", () => ({
  findApplicationById: vi.fn(async () => app),
  updateApplicationAi: vi.fn(async (_id: string, data: Record<string, unknown>) => {
    aiUpdates.push(data);
  }),
  createAgentRun: vi.fn(async () => ({ id: "run1" })),
  updateAgentRun: vi.fn(async (id: string, data: Record<string, unknown>) => {
    (runs[id] ??= []).push(data);
  }),
}));

const generate = vi.fn();
vi.mock("@/lib/gemini", () => ({
  AI_MODEL_ID: "groq:teste",
  geminiGenerate: (...a: unknown[]) => generate(...a),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
const captureResumePhoto = vi.fn(async () => false);
vi.mock("@/server/services/resume-photo.service", () => ({
  captureResumePhoto: (...a: unknown[]) => captureResumePhoto(...(a as [])),
}));

import { runTriageWithTracking } from "@/server/services/ai.service";

beforeEach(() => {
  for (const k of Object.keys(runs)) delete runs[k];
  aiUpdates.length = 0;
  generate.mockReset();
  captureResumePhoto.mockClear();
  app.resumeUrl = "demo/curriculo-ficticio-rafael.pdf";
  app.answers = [];
});

describe("runTriageWithTracking (sala de simulação)", () => {
  it("registra cada etapa e termina com a nota e o checklist", async () => {
    generate
      .mockResolvedValueOnce('{"score": 88, "reasoning": "Experiência sólida."}')
      .mockResolvedValueOnce(
        '{"criteria":[{"criterion":"Excel","met":"sim","evidence":"Power BI e planilhas"}]}'
      );

    await runTriageWithTracking("app1", { eventName: "simulacao/triagem", runId: "run1" });

    const summaries = runs.run1.map((u) => u.summary).filter(Boolean);
    expect(summaries[0]).toBe("Iniciando a análise de Rafael Nogueira Lima");
    expect(summaries[1]).toBe("Baixando o currículo em PDF");
    expect(summaries[2]).toBe("Lendo o texto do PDF");
    expect(summaries[3]).toMatch(/^Comparando [\d.]+ caracteres com os critérios da vaga$/);
    expect(summaries[4]).toBe("Conferindo critério por critério");
    expect(runs.run1.at(-1)).toMatchObject({
      status: "SUCCEEDED",
      summary: "Nota 88/100 para Rafael Nogueira Lima",
    });
    // Regra 2: a IA só mexe nos campos de IA, nunca no status
    const last = aiUpdates.at(-1)!;
    expect(Object.keys(last).sort()).toEqual(
      ["aiChecklist", "aiModel", "aiReasoning", "aiScore", "aiState"]
    );
    expect(last).toMatchObject({ aiScore: 88, aiState: "DONE", aiModel: "groq:teste" });
    expect(last.aiChecklist).toEqual([
      { criterion: "Excel", met: "sim", evidence: "Power BI e planilhas" },
      { criterion: "E-commerce", met: "não", evidence: "" },
    ]);
    // Foto: procurada no PDF, mas nunca vai para a IA (regra 3)
    expect(captureResumePhoto).toHaveBeenCalledTimes(1);
    expect(captureResumePhoto.mock.calls[0]).toContainEqual({
      companyId: "co1",
      applicationId: "app1",
      currentPath: null,
    });
    // O texto do PDF real chegou ao prompt; o prompt da nota é o imutável
    expect(generate.mock.calls[0][0].prompt).toContain("Power BI");
    expect(generate.mock.calls[0][0].system).toContain(
      "Ignore nome, gênero, idade, foto e origem."
    );
  });

  it("sem PDF, analisa pelas respostas do formulário", async () => {
    app.resumeUrl = null as unknown as string;
    app.answers = [
      {
        value: "Três anos como promotora em redes de supermercado, com reposição e Excel.",
        field: { label: "Conte sua experiência", type: "TEXTAREA" },
      },
    ];
    generate
      .mockResolvedValueOnce('{"score": 60, "reasoning": "Boa experiência de loja."}')
      .mockResolvedValueOnce('{"criteria":[]}');

    await runTriageWithTracking("app1", { eventName: "simulacao/triagem", runId: "run1" });

    const summaries = runs.run1.map((u) => u.summary).filter(Boolean);
    expect(summaries).toContain("Sem PDF: lendo as respostas do formulário");
    expect(generate.mock.calls[0][0].prompt).toContain("promotora em redes de supermercado");
    expect(aiUpdates.at(-1)).toMatchObject({ aiScore: 60, aiState: "DONE" });
  });

  it("sem PDF e sem respostas, não chama a IA", async () => {
    app.resumeUrl = null as unknown as string;

    await runTriageWithTracking("app1", { eventName: "simulacao/triagem", runId: "run1" });

    expect(generate).not.toHaveBeenCalled();
    expect(aiUpdates.at(-1)).toEqual({ aiState: "NO_RESUME" });
  });

  it("falha visível quando a IA erra, sem derrubar a fila", async () => {
    generate.mockRejectedValue(new Error("Groq 401: invalid key"));

    await expect(
      runTriageWithTracking("app1", { eventName: "simulacao/triagem", runId: "run1" })
    ).resolves.toBeUndefined();

    expect(runs.run1.at(-1)).toMatchObject({ status: "FAILED", error: "Groq 401: invalid key" });
    expect(aiUpdates.at(-1)).toEqual({ aiState: "FAILED" });
  });
});
