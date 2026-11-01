import { describe, expect, it } from "vitest";

import { formatCpfInput, parseAdmissionInput } from "@/server/models/admission.model";

describe("formatCpfInput", () => {
  it("aplica a máscara enquanto digita", () => {
    expect(formatCpfInput("123")).toBe("123");
    expect(formatCpfInput("1234")).toBe("123.4");
    expect(formatCpfInput("12345678901")).toBe("123.456.789-01");
    expect(formatCpfInput("123.456.789-01999")).toBe("123.456.789-01");
  });
});

describe("parseAdmissionInput (tudo opcional)", () => {
  it("vazio é aceito e não grava nada", () => {
    expect(parseAdmissionInput({})).toEqual({ ok: true, data: { rg: null, cpf: null, bootSize: null, pantsSize: null, shirtSize: null } });
  });
  it("guarda CPF só com dígitos e apara os tamanhos", () => {
    const r = parseAdmissionInput({ rg: " 2002099 123 ", cpf: "529.982.247-25", bootSize: " 40 ", pantsSize: "42", shirtSize: "M" });
    expect(r).toEqual({ ok: true, data: { rg: "2002099 123", cpf: "52998224725", bootSize: "40", pantsSize: "42", shirtSize: "M" } });
  });
  it("CPF preenchido e inválido é recusado", () => {
    const r = parseAdmissionInput({ cpf: "111.111.111-11" });
    expect(r).toEqual({ ok: false, error: "CPF inválido. Confira os números ou deixe em branco." });
  });
  it("RG curto demais é recusado, mas em branco passa", () => {
    expect(parseAdmissionInput({ rg: "12" })).toEqual({ ok: false, error: "RG inválido. Confira ou deixe em branco." });
    expect(parseAdmissionInput({ rg: "" }).ok).toBe(true);
  });
  it("tamanho muito longo é cortado", () => {
    const r = parseAdmissionInput({ bootSize: "x".repeat(40) });
    expect(r.ok && r.data.bootSize?.length).toBe(10);
  });
});
