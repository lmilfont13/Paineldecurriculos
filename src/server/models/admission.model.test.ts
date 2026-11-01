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
    expect(parseAdmissionInput({})).toEqual({ ok: true, data: { rg: null, cpf: null, bootSize: null, pantsSize: null, shirtSize: null, hasBankAccount: null, bankNames: null, bankAccountType: null } });
  });
  it("guarda CPF só com dígitos e apara os tamanhos", () => {
    const r = parseAdmissionInput({ rg: " 2002099 123 ", cpf: "529.982.247-25", bootSize: " 40 ", pantsSize: "42", shirtSize: "M", hasBankAccount: null, bankNames: null, bankAccountType: null });
    expect(r).toEqual({ ok: true, data: { rg: "2002099 123", cpf: "52998224725", bootSize: "40", pantsSize: "42", shirtSize: "M", hasBankAccount: null, bankNames: null, bankAccountType: null } });
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

  it("guarda bancos e tipo só para quem tem conta", () => {
    const yes = parseAdmissionInput({ hasBankAccount: "yes", bankNames: " Nubank, Caixa ", bankAccountType: "poupanca" });
    expect(yes).toMatchObject({ ok: true, data: { hasBankAccount: "yes", bankNames: "Nubank, Caixa", bankAccountType: "poupanca" } });
    const no = parseAdmissionInput({ hasBankAccount: "no", bankNames: "Nubank", bankAccountType: "corrente" });
    expect(no).toMatchObject({ ok: true, data: { hasBankAccount: "no", bankNames: null, bankAccountType: null } });
  });

  it("ignora resposta e tipo de conta desconhecidos", () => {
    const r = parseAdmissionInput({ hasBankAccount: "talvez", bankAccountType: "x" });
    expect(r).toMatchObject({ ok: true, data: { hasBankAccount: null, bankAccountType: null } });
    const t = parseAdmissionInput({ hasBankAccount: "yes", bankAccountType: "invalido" });
    expect(t).toMatchObject({ ok: true, data: { hasBankAccount: "yes", bankAccountType: null } });
  });
});
