import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const findPool = vi.fn();
const createPool = vi.fn();
vi.mock("@/server/repositories/job.repository", () => ({
  findTalentPoolJob: (...a: unknown[]) => findPool(...a),
  createTalentPoolJob: (...a: unknown[]) => createPool(...a),
}));
const findFolders = vi.fn();
const createFolder = vi.fn();
const addItem = vi.fn();
vi.mock("@/server/repositories/talent.repository", () => ({
  findTalentFolders: (...a: unknown[]) => findFolders(...a),
  createTalentFolder: (...a: unknown[]) => createFolder(...a),
  addTalentFolderItem: (...a: unknown[]) => addItem(...a),
}));

import { SPONTANEOUS_FOLDER, addToSpontaneousFolder, getTalentPoolJobId } from "@/server/services/talent-bank.service";

beforeEach(() => vi.clearAllMocks());

describe("getTalentPoolJobId", () => {
  it("reaproveita a vaga oculta que já existe", async () => {
    findPool.mockResolvedValue({ id: "pool1" });
    expect(await getTalentPoolJobId("co1", "Empresa")).toBe("pool1");
    expect(createPool).not.toHaveBeenCalled();
  });

  it("cria a vaga oculta na primeira vez", async () => {
    findPool.mockResolvedValue(null);
    createPool.mockResolvedValue({ id: "novo" });
    expect(await getTalentPoolJobId("co1", "Empresa")).toBe("novo");
    expect(createPool).toHaveBeenCalledWith("co1", "Empresa");
  });
});

describe("addToSpontaneousFolder", () => {
  it("cria a pasta de cadastros espontâneos e guarda a pessoa", async () => {
    findFolders.mockResolvedValue([]);
    createFolder.mockResolvedValue({ id: "f1" });
    await addToSpontaneousFolder("co1", "app1");
    expect(createFolder).toHaveBeenCalledWith("co1", SPONTANEOUS_FOLDER, null);
    expect(addItem).toHaveBeenCalledWith("f1", "app1");
  });

  it("usa a pasta que já existe, sem criar outra", async () => {
    findFolders.mockResolvedValue([{ id: "f9", name: "Cadastros espontâneos" }]);
    await addToSpontaneousFolder("co1", "app2");
    expect(createFolder).not.toHaveBeenCalled();
    expect(addItem).toHaveBeenCalledWith("f9", "app2");
  });

  it("nunca lança: falha no banco não derruba a candidatura", async () => {
    findFolders.mockRejectedValue(new Error("db"));
    await expect(addToSpontaneousFolder("co1", "app3")).resolves.toBeUndefined();
  });
});
