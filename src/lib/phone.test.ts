import { describe, expect, it } from "vitest";

import { domesticPhoneError, formatPhone, maskDomesticPhoneInput, maskPhoneInput } from "@/lib/phone";

describe("formatPhone", () => {
  it.each([
    ["85999990000", "(85) 99999-0000"],
    ["(85) 9 9999-0000", "(85) 99999-0000"],
    ["+55 85 99999-0000", "(85) 99999-0000"],
    ["8533334444", "(85) 3333-4444"],
    ["85 3333 4444", "(85) 3333-4444"],
    ["5585999990000", "(85) 99999-0000"],
  ])("%s → %s", (input, out) => expect(formatPhone(input)).toBe(out));

  it("deixa como veio o que não cabe no padrão", () => {
    expect(formatPhone("+1 415 555 0100")).toBe("+1 415 555 0100");
    expect(formatPhone("1234")).toBe("1234");
  });
  it("vazio vira texto vazio", () => {
    expect(formatPhone(null)).toBe("");
  });
});

describe("maskPhoneInput", () => {
  it("formata enquanto digita", () => {
    expect(maskPhoneInput("8")).toBe("(8");
    expect(maskPhoneInput("85999")).toBe("(85) 999");
    expect(maskPhoneInput("8599999000")).toBe("(85) 9999-9000");
    expect(maskPhoneInput("85999990000")).toBe("(85) 99999-0000");
    expect(maskPhoneInput("859999900001234")).toBe("(85) 99999-0000");
  });
});

describe("contatos nacionais do candidato", () => {
  it("recusa o DDI 55 sem cortar o número colado", () => {
    for (const value of ["+55 (85) 99999-0000", "(55) 85 99999-0000", "5585999990000"]) {
      expect(domesticPhoneError(value, { mobile: true })).toContain("código do país");
      expect(maskDomesticPhoneInput(value)).toBe(value);
    }
  });
  it("aceita DDD 55 válido e exige celular de nove dígitos no WhatsApp", () => {
    expect(domesticPhoneError("(55) 99999-0000", { mobile: true })).toBeNull();
    expect(domesticPhoneError("(85) 99999-0000", { mobile: true })).toBeNull();
    expect(domesticPhoneError("(85) 3333-4444", { mobile: true })).not.toBeNull();
    expect(domesticPhoneError("(20) 99999-0000", { mobile: true })).not.toBeNull();
    expect(domesticPhoneError("859999900001", { mobile: true })).not.toBeNull();
  });
  it("recado permite vazio, fixo ou celular, mas não DDI nem incompleto", () => {
    for (const value of ["", "(85) 3333-4444", "(85) 99999-0000", "(55) 3333-4444"]) {
      expect(domesticPhoneError(value, { optional: true })).toBeNull();
    }
    expect(domesticPhoneError("+55 85 3333-4444", { optional: true })).not.toBeNull();
    expect(domesticPhoneError("3333-4444", { optional: true })).not.toBeNull();
    expect(domesticPhoneError("", { mobile: true })).not.toBeNull();
  });
  it("aplica máscara nacional sem truncar entradas grandes", () => {
    expect(maskDomesticPhoneInput("85999990000")).toBe("(85) 99999-0000");
    expect(maskDomesticPhoneInput("85999990000123")).toBe("85999990000123");
  });
});
