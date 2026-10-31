import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

type App = Record<string, unknown>;
const apps: Record<string, App> = {
  a1: {
    id: "a1",
    candidateId: "c1",
    infoRequestedFields: ["cpf"],
    infoAnsweredAt: null,
  },
  a2: {
    id: "a2",
    candidateId: "c2",
    infoRequestedFields: ["cpf"],
    infoAnsweredAt: null,
  },
  a3: {
    id: "a3",
    candidateId: "c1",
    infoRequestedFields: [],
    infoAnsweredAt: null,
  },
};
const saved: Record<string, unknown>[] = [];

vi.mock("@/server/repositories/application.repository", async (orig) => ({
  ...(await orig<object>()),
  findApplicationForCandidate: vi.fn(async (candidateId: string, id: string) => {
    const app = apps[id];
    return app && app.candidateId === candidateId ? app : null;
  }),
  updateInfoAnswers: vi.fn(async (_id: string, data: Record<string, unknown>) => {
    saved.push(data);
  }),
}));

import { saveInfoAnswers } from "@/server/services/application.service";

beforeEach(() => {
  saved.length = 0;
});

describe("saveInfoAnswers", () => {
  it("grava só o que foi pedido e descarta o resto", async () => {
    const result = await saveInfoAnswers("c1", "a1", {
      cpf: "529.982.247-25",
      rg: "1234567",
    });
    expect(result).toEqual({ ok: true });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ cpf: "52998224725" });
    expect(saved[0]).not.toHaveProperty("rg");
    expect(saved[0]).toHaveProperty("infoAnsweredAt");
  });

  it("candidato não responde a candidatura de outro", async () => {
    const result = await saveInfoAnswers("c1", "a2", { cpf: "52998224725" });
    expect(result.ok).toBe(false);
    expect(saved).toEqual([]);
  });

  it("recusa CPF inválido sem gravar nada", async () => {
    const result = await saveInfoAnswers("c1", "a1", { cpf: "111.111.111-11" });
    expect(result).toEqual({ ok: false, error: "CPF inválido." });
    expect(saved).toEqual([]);
  });

  it("sem pedido em aberto não grava", async () => {
    const result = await saveInfoAnswers("c1", "a3", { cpf: "52998224725" });
    expect(result.ok).toBe(false);
    expect(saved).toEqual([]);
  });
});
