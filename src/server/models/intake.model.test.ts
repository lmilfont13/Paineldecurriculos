import { describe, expect, it } from "vitest";

import { intakeInviteText, nameFromEmail, parseIntakeList } from "@/server/models/intake.model";

describe("parseIntakeList", () => {
  it("aceita só e-mail, e-mail + nome, telefone em qualquer ordem e Nome <email>", () => {
    const { entries, invalid } = parseIntakeList(`
      maria.souza@gmail.com
      joao@hotmail.com, João Pedro Lima
      (85) 99999-0000; Ana Clara; ANA@empresa.com.br
      Carlos Mendes <carlos.m@outlook.com>
      maria.souza@gmail.com
      isso não é email
    `);
    expect(entries).toEqual([
      { email: "maria.souza@gmail.com", name: "Maria Souza", phone: null },
      { email: "joao@hotmail.com", name: "João Pedro Lima", phone: null },
      { email: "ana@empresa.com.br", name: "Ana Clara", phone: "(85) 99999-0000" },
      { email: "carlos.m@outlook.com", name: "Carlos Mendes", phone: null },
    ]);
    expect(invalid).toEqual(["isso não é email"]);
  });

  it("limita a 50 por vez", () => {
    const text = Array.from({ length: 60 }, (_, i) => `p${i}@x.com`).join("\n");
    expect(parseIntakeList(text).entries).toHaveLength(50);
  });
});

describe("nameFromEmail", () => {
  it("monta um nome legível a partir do e-mail", () => {
    expect(nameFromEmail("joao.silva_23@x.com")).toBe("Joao Silva");
    expect(nameFromEmail("x@x.com")).toBe("x");
  });
});

describe("intakeInviteText", () => {
  it("leva primeiro nome, vaga, e-mail e link", () => {
    const text = intakeInviteText({
      name: "Maria Souza",
      company: "TARHGET",
      jobTitle: "Promotor(a)",
      url: "https://x/vaga",
      email: "maria@x.com",
    });
    expect(text).toContain("Oi, Maria!");
    expect(text).toContain("Promotor(a)");
    expect(text).toContain("maria@x.com");
    expect(text).toContain("https://x/vaga");
  });
});
