import { describe, expect, it } from "vitest";

import { rejectionMessage } from "@/server/models/message-templates.model";

describe("rejectionMessage", () => {
  const text = rejectionMessage("Maria Souza", "Loja X", "Consultor de Vendas");

  it("começa pelo primeiro nome e cita a vaga e a empresa", () => {
    expect(text.startsWith("Maria,")).toBe(true);
    expect(text).toContain("Consultor de Vendas");
    expect(text).toContain("Loja X");
  });
  it("é respeitosa e não dá motivo nem promete retorno", () => {
    expect(text).toMatch(/não vamos seguir/i);
    expect(text).not.toMatch(/entraremos em contato|guardaremos|banco de talentos/i);
  });
});
