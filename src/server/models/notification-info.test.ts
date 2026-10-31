import { describe, expect, it } from "vitest";

import { infoRequestedNotification } from "@/server/models/notification.model";

describe("infoRequestedNotification", () => {
  const content = infoRequestedNotification("Loja X", "Consultor de Vendas");

  it("é do tipo INFO_REQUESTED e cita a empresa e a vaga", () => {
    expect(content.type).toBe("INFO_REQUESTED");
    expect(content.title).toContain("Loja X");
    expect(content.body).toContain("Consultor de Vendas");
  });
  it("nunca menciona dados sensíveis", () => {
    const text = `${content.title} ${content.body}`;
    expect(text).not.toMatch(/\bCPF\b|\bRG\b/i);
  });
});

import { managerMessageNotification } from "@/server/models/notification.model";

describe("managerMessageNotification com assunto", () => {
  it("usa o assunto do gestor como título", () => {
    const n = managerMessageNotification("Loja X", "Consultor", "Texto", "Documentos pendentes");
    expect(n.title).toBe("Documentos pendentes");
    expect(n.body).toContain("Texto");
  });
  it("sem assunto mantém o título de sempre", () => {
    expect(managerMessageNotification("Loja X", "Consultor", "Texto").title).toBe("Recado da Loja X");
  });
});
