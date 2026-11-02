import { describe, expect, it } from "vitest";

import { formatPhone, maskPhoneInput } from "@/lib/phone";

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
