import { describe, expect, it } from "vitest";

import { consentCheckboxText, privacyNotice } from "@/server/models/consent.model";

describe("textos do consentimento", () => {
  it("o aceite cita a empresa, a finalidade restrita e o dado sensível", () => {
    const text = consentCheckboxText("TARHGET FORTALEZA");
    expect(text).toContain("TARHGET FORTALEZA");
    expect(text).toContain("somente para este processo seletivo e para o banco de talentos");
    expect(text).toContain("pessoa com deficiência");
    expect(text).toContain("retirar este consentimento");
  });

  it("o aviso traz o contato da empresa e cita a IA e os prestadores", () => {
    const all = privacyNotice("ACME", "rh@acme.com.br")
      .flatMap((s) => [s.title, ...s.paragraphs])
      .join(" ");
    expect(all).toContain("rh@acme.com.br");
    expect(all).toContain("não aprova nem reprova ninguém");
    expect(all).toMatch(/Vercel.*Supabase.*Resend.*Google/);
    expect(privacyNotice("ACME", null).flatMap((s) => s.paragraphs).join(" ")).toContain(
      "pelos canais de contato da empresa"
    );
  });
});
