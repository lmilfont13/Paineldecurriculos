import { describe, expect, it } from "vitest";

import { replyToEmail } from "@/server/models/company.model";

describe("replyToEmail", () => {
  it("o e-mail da empresa vence o do usuário gestor", () => {
    expect(replyToEmail("vanessa.freitas@tarhgetfortaleza.com.br", "ana@technova.com")).toBe(
      "vanessa.freitas@tarhgetfortaleza.com.br"
    );
  });
  it("ignora espaços", () => {
    expect(replyToEmail("  contato@empresa.com.br ", null)).toBe("contato@empresa.com.br");
  });
  it("e-mail da empresa vazio ou inválido cai para o do gestor", () => {
    expect(replyToEmail("", "gestor@empresa.com")).toBe("gestor@empresa.com");
    expect(replyToEmail("isso-nao-e-email", "gestor@empresa.com")).toBe("gestor@empresa.com");
  });
  it("sem nenhum dos dois, não há endereço de resposta", () => {
    expect(replyToEmail(null, null)).toBeNull();
    expect(replyToEmail("x", undefined)).toBeNull();
  });
});

import { emailSettingsSchema, isSandboxSender, senderAddressOf } from "@/server/models/company.model";

describe("senderAddressOf", () => {
  it("usa o remetente da empresa quando é um e-mail válido", () => {
    expect(senderAddressOf("vanessa.freitas@tarhgetfortaleza.com.br", "onboarding@resend.dev")).toBe(
      "vanessa.freitas@tarhgetfortaleza.com.br"
    );
  });
  it("vazio ou inválido volta para o remetente padrão do sistema", () => {
    expect(senderAddressOf("", "onboarding@resend.dev")).toBe("onboarding@resend.dev");
    expect(senderAddressOf(null, "onboarding@resend.dev")).toBe("onboarding@resend.dev");
    expect(senderAddressOf("nao-e-email", "onboarding@resend.dev")).toBe("onboarding@resend.dev");
  });
});

describe("isSandboxSender", () => {
  it("só o domínio de teste do Resend é modo de teste", () => {
    expect(isSandboxSender("onboarding@resend.dev")).toBe(true);
    expect(isSandboxSender("Loja <onboarding@RESEND.dev>")).toBe(true);
    expect(isSandboxSender("vanessa.freitas@tarhgetfortaleza.com.br")).toBe(false);
  });
});

describe("emailSettingsSchema", () => {
  it("aceita e-mail da empresa e remetente opcional vazio", () => {
    const r = emailSettingsSchema.safeParse({ email: "vanessa.freitas@tarhgetfortaleza.com.br", senderEmail: "" });
    expect(r.success).toBe(true);
    expect(r.success && r.data.senderEmail).toBe("");
  });
  it("recusa e-mail da empresa inválido", () => {
    expect(emailSettingsSchema.safeParse({ email: "isso", senderEmail: "" }).success).toBe(false);
  });
  it("recusa remetente preenchido e inválido", () => {
    expect(emailSettingsSchema.safeParse({ email: "a@b.com", senderEmail: "xyz" }).success).toBe(false);
  });
  it("tira espaços e deixa em minúsculo", () => {
    const r = emailSettingsSchema.safeParse({ email: "  Vanessa@Empresa.com.br ", senderEmail: " Nao-Responda@Empresa.com.br " });
    expect(r.success && [r.data.email, r.data.senderEmail]).toEqual(["vanessa@empresa.com.br", "nao-responda@empresa.com.br"]);
  });
});
