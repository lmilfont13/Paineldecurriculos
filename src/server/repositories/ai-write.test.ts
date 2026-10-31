import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { update } = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { application: { update } } }));

import { updateApplicationAi, updateApplicationResumeText } from "@/server/repositories/application.repository";

beforeEach(() => update.mockReset());

describe("gravação da análise (texto de PDF com caractere nulo)", () => {
  it("não envia U+0000 ao banco em nenhum campo de texto nem no checklist", async () => {
    await updateApplicationAi("a1", {
      aiScore: 80,
      aiReasoning: "Experiência\u0000 sólida.",
      aiProfile: "Vend\u0000edora",
      aiChecklist: [{ criterion: "Vendas", met: "sim", evidence: "5 anos\u0000 em loja" }],
      resumeText: "Francisca\u0000 Geane",
      aiState: "DONE",
    });
    const data = update.mock.calls[0][0].data;
    expect(JSON.stringify(data)).not.toContain("\u0000");
    expect(data.aiReasoning).toBe("Experiência sólida.");
    expect(data.resumeText).toBe("Francisca Geane");
    expect(data.aiChecklist).toEqual([{ criterion: "Vendas", met: "sim", evidence: "5 anos em loja" }]);
    expect(data.aiScore).toBe(80);
  });

  it("mantém o valor especial de 'sem checklist' do Prisma", async () => {
    await updateApplicationAi("a1", { aiChecklist: Prisma.DbNull, aiState: "DONE" });
    expect(update.mock.calls[0][0].data.aiChecklist).toBe(Prisma.DbNull);
  });

  it("limpa também o texto do currículo salvo para a busca", async () => {
    await updateApplicationResumeText("a1", "texto\u0000 do cv");
    expect(update.mock.calls[0][0].data.resumeText).toBe("texto do cv");
  });
});
