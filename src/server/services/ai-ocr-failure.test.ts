import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const app = {
  id: "app1",
  name: "Candidata Teste",
  resumeUrl: "co1/job1/cand1/curriculo.png",
  hasImpediment: false,
  answers: [
    {
      value: "Tenho disponibilidade para trabalhar aos sábados e moro perto da loja.",
      field: { label: "Disponibilidade", type: "TEXTAREA" },
    },
  ],
  company: { id: "co1" },
  photoPath: null as string | null,
  job: { title: "Promotor(a) de Vendas", aiCriteria: ["Experiência em loja"], requirements: null },
};
const aiUpdates: Record<string, unknown>[] = [];
const runUpdates: Record<string, unknown>[] = [];

vi.mock("@/server/repositories/application.repository", () => ({
  findApplicationById: vi.fn(async () => app),
  updateApplicationAi: vi.fn(async (_id: string, data: Record<string, unknown>) => {
    aiUpdates.push(data);
  }),
  createAgentRun: vi.fn(async () => ({ id: "run1" })),
  updateAgentRun: vi.fn(async (_id: string, data: Record<string, unknown>) => {
    runUpdates.push(data);
  }),
}));

const generate = vi.fn();
vi.mock("@/lib/gemini", () => ({
  geminiGenerate: (...a: unknown[]) => generate(...a),
  generateWithModelInfo: async (...a: unknown[]) => ({ text: await generate(...a), modelUsed: "teste" }),
}));

let png: Buffer;
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        download: async () => ({ data: new Blob([new Uint8Array(png)]), error: null }),
      }),
    },
  }),
}));
vi.mock("@/server/services/resume-photo.service", () => ({ captureResumePhoto: vi.fn(async () => false) }));
vi.mock("@/server/repositories/talent.repository", () => ({ updateCandidateTenureAnalysis: vi.fn() }));
vi.mock("@/server/services/talent.service", () => ({ autoCategorizeTalent: vi.fn() }));

import { runTriageWithTracking } from "@/server/services/ai.service";

beforeEach(async () => {
  aiUpdates.length = 0;
  runUpdates.length = 0;
  generate.mockReset();
  png = await sharp({ create: { width: 300, height: 400, channels: 3, background: "#ffffff" } })
    .png()
    .toBuffer();
});

describe("triagem de currículo em imagem quando a leitura (OCR) falha", () => {
  it("limite de uso da IA na leitura NÃO vira nota só pelas respostas: a análise falha e pode ser repetida", async () => {
    generate.mockImplementation(async (args: { imageBase64?: string }) => {
      if (args.imageBase64) throw new Error('Groq 429: {"error":{"message":"Rate limit reached"}}');
      return '{"score": 71, "reasoning": "Nota dada sem ler o currículo."}';
    });

    await runTriageWithTracking("app1", { eventName: "teste", runId: "run1" });

    // Antes da correção: o erro do OCR era engolido, a IA dava nota só com as
    // respostas do formulário e a candidatura ficava DONE sem texto de currículo.
    expect(aiUpdates.some((u) => u.aiState === "DONE")).toBe(false);
    expect(aiUpdates.at(-1)).toEqual({ aiState: "FAILED" });
    expect(runUpdates.at(-1)).toMatchObject({ status: "FAILED" });
  });

  it("imagem sem texto legível (sem erro) continua valendo pelas respostas do formulário", async () => {
    generate.mockImplementation(async (args: { imageBase64?: string; system?: string }) => {
      if (args.imageBase64) return "VAZIO";
      if (args.system?.includes('"score"')) return '{"score": 40, "reasoning": "Só respostas."}';
      return '{"criteria":[]}';
    });

    await runTriageWithTracking("app1", { eventName: "teste", runId: "run1" });

    expect(aiUpdates.at(-1)).toMatchObject({ aiState: "DONE", aiScore: 40 });
  });
});
