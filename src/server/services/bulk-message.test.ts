import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { findApplicationsForBulkMessage, createNotifications, getCompanyById, findManagerByCompanyId, sendManagerMessageEmails } =
  vi.hoisted(() => ({
    findApplicationsForBulkMessage: vi.fn(),
    createNotifications: vi.fn(),
    getCompanyById: vi.fn(),
    findManagerByCompanyId: vi.fn(),
    sendManagerMessageEmails: vi.fn(),
  }));
vi.mock("@/server/repositories/application.repository", () => ({ findApplicationsForBulkMessage }));
vi.mock("@/server/repositories/notification.repository", () => ({ createNotifications }));
vi.mock("@/server/services/company.service", () => ({ getCompanyById }));
vi.mock("@/server/repositories/user.repository", () => ({ findManagerByCompanyId }));
vi.mock("@/server/services/email.service", () => ({ sendManagerMessageEmails }));
// o trabalho em segundo plano roda na hora, para o teste poder conferir o que foi enviado
vi.mock("@/lib/background", () => ({
  runInBackground: (_label: string, task: () => Promise<unknown>) => {
    void task();
  },
}));

import { MAX_BULK_RECIPIENTS, sendBulkMessage } from "@/server/services/bulk-message.service";

const app = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  name,
  email: `${id}@mail.com`,
  candidateId: `cand-${id}`,
  isDemo: false,
  job: { title: "Consultor de Vendas", code: "1123" },
  ...over,
});

beforeEach(() => {
  findApplicationsForBulkMessage.mockReset();
  createNotifications.mockReset().mockResolvedValue({ count: 0 });
  sendManagerMessageEmails.mockReset().mockResolvedValue("sent");
  getCompanyById.mockReset().mockResolvedValue({ id: "co1", name: "Loja X", slug: "loja-x", primaryColor: "#7a1f3d", logoUrl: null });
  findManagerByCompanyId.mockReset().mockResolvedValue({ email: "gestora@loja.com" });
});

describe("sendBulkMessage", () => {
  it("personaliza o texto de cada candidato (nome, vaga e empresa)", async () => {
    findApplicationsForBulkMessage.mockResolvedValue([app("a1", "maria souza"), app("a2", "JOÃO LIMA")]);
    const r = await sendBulkMessage("co1", ["a1", "a2"], "Retorno", "{nome}, sobre {vaga} na {empresa}.");
    expect(r).toMatchObject({ ok: true, total: 2, notified: 2, emailed: 2, noChannel: 0 });

    const notes = createNotifications.mock.calls[0][0];
    expect(notes.map((n: { body: string }) => n.body)).toEqual([
      "Sobre a vaga de Consultor de Vendas: Maria, sobre Consultor de Vendas na Loja X.",
      "Sobre a vaga de Consultor de Vendas: João, sobre Consultor de Vendas na Loja X.",
    ]);
    expect(notes[0].title).toBe("Retorno");

    const emails = sendManagerMessageEmails.mock.calls[0][0];
    expect(emails.map((e: { message: string }) => e.message)).toEqual([
      "Maria, sobre Consultor de Vendas na Loja X.",
      "João, sobre Consultor de Vendas na Loja X.",
    ]);
    expect(emails[0]).toMatchObject({ to: "a1@mail.com", subject: "Retorno", managerEmail: "gestora@loja.com", applicationId: "a1" });
  });

  it("só envia a candidaturas da empresa: ids de outra empresa não voltam da consulta e contam como pulados", async () => {
    findApplicationsForBulkMessage.mockResolvedValue([app("a1", "Maria")]);
    const r = await sendBulkMessage("co1", ["a1", "de-outra-empresa"], "", "Olá, {nome}.");
    expect(findApplicationsForBulkMessage).toHaveBeenCalledWith("co1", ["a1", "de-outra-empresa"]);
    expect(r).toMatchObject({ ok: true, total: 1, skipped: 1 });
  });

  it("pula candidatura de demonstração e conta quem não tem nenhum canal", async () => {
    findApplicationsForBulkMessage.mockResolvedValue([
      app("demo", "Demo", { isDemo: true }),
      app("semcanal", "Sem Canal", { candidateId: null, email: "conta-excluida" }),
      app("ok", "Ok"),
    ]);
    const r = await sendBulkMessage("co1", ["demo", "semcanal", "ok"], "", "Oi, {nome}.");
    expect(r).toMatchObject({ ok: true, total: 2, skipped: 1, noChannel: 1, notified: 1, emailed: 1 });
  });

  it("ids repetidos viram um só", async () => {
    findApplicationsForBulkMessage.mockResolvedValue([app("a1", "Maria")]);
    await sendBulkMessage("co1", ["a1", "a1", "a1"], "", "Oi.");
    expect(findApplicationsForBulkMessage).toHaveBeenCalledWith("co1", ["a1"]);
  });

  it("recusa lista vazia, texto curto demais e lotes acima do limite, sem tocar no banco", async () => {
    expect((await sendBulkMessage("co1", [], "", "Texto válido")).ok).toBe(false);
    expect((await sendBulkMessage("co1", ["a1"], "", " x ")).ok).toBe(false);
    const many = Array.from({ length: MAX_BULK_RECIPIENTS + 1 }, (_, i) => `id${i}`);
    expect((await sendBulkMessage("co1", many, "", "Texto válido")).ok).toBe(false);
    expect(findApplicationsForBulkMessage).not.toHaveBeenCalled();
  });
});
