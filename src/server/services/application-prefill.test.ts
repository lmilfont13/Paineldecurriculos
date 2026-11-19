import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
const { findLatestApplicationWithAnswers } = vi.hoisted(() => ({ findLatestApplicationWithAnswers: vi.fn() }));
vi.mock("@/server/repositories/application.repository", async (original) => ({
  ...(await original<object>()), findLatestApplicationWithAnswers,
}));
import { getApplicationPrefill } from "./application.service";

beforeEach(() => vi.resetAllMocks());

describe("histórico para reutilizar cadastro", () => {
  it("não confunde uma conta nova com candidatura anterior", async () => {
    findLatestApplicationWithAnswers.mockResolvedValue(null);
    expect(await getApplicationPrefill("c1", "co1")).toEqual({ answers: {}, hasPreviousApplication: false });
    expect(findLatestApplicationWithAnswers).toHaveBeenCalledWith("c1", "co1");
  });
  it("detecta candidatura anterior mesmo sem respostas extras", async () => {
    findLatestApplicationWithAnswers.mockResolvedValue({ preRegistered: false, answers: [] });
    expect(await getApplicationPrefill("c1", "co1")).toEqual({ answers: {}, hasPreviousApplication: true });
  });
  it("preserva pré-preenchimento sem tratar pré-cadastro do gestor como envio concluído", async () => {
    findLatestApplicationWithAnswers.mockResolvedValue({ preRegistered: true, answers: [{ fieldId: "f1", value: "Sim" }] });
    expect(await getApplicationPrefill("c1", "co1")).toEqual({ answers: { f1: "Sim" }, hasPreviousApplication: false });
  });
});
