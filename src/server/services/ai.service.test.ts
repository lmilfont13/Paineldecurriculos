import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const runs: Record<string, Record<string, unknown>[]> = {};
const app = {
  id: "app1",
  name: "Rafael Nogueira Lima",
  resumeUrl: "demo/curriculo-ficticio-rafael.pdf",
  company: { id: "co1" },
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
vi.mock("@/lib/gemini", () => ({ geminiGenerate: (...a: unknown[]) => generate(...a) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

import { runTriageWithTracking } from "@/server/services/ai.service";

beforeEach(() => {
  for (const k of Object.keys(runs)) delete runs[k];
  aiUpdates.length = 0;
  generate.mockReset();
});

describe("runTriageWithTracking (sala de simulação)", () => {
  it("registra cada etapa e termina com a nota", async () => {
    generate.mockResolvedValue('{"score": 88, "reasoning": "Experiência sólida."}');

    await runTriageWithTracking("app1", { eventName: "simulacao/triagem", runId: "run1" });

    const summaries = runs.run1.map((u) => u.summary).filter(Boolean);
    expect(summaries[0]).toBe("Iniciando a análise de Rafael Nogueira Lima");
    expect(summaries[1]).toBe("Baixando o currículo em PDF");
    expect(summaries[2]).toBe("Lendo o texto do PDF");
    expect(summaries[3]).toMatch(/^Comparando [\d.]+ caracteres com os critérios da vaga$/);
    expect(runs.run1.at(-1)).toMatchObject({
      status: "SUCCEEDED",
      summary: "Nota 88/100 para Rafael Nogueira Lima",
    });
    // Regra 2: a IA só mexe em aiScore/aiReasoning/aiState
    expect(aiUpdates.at(-1)).toEqual({ aiScore: 88, aiReasoning: "Experiência sólida.", aiState: "DONE" });
    // O texto do PDF real chegou ao prompt
    expect(generate.mock.calls[0][0].prompt).toContain("Power BI");
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
