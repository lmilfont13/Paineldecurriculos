import { describe, expect, it } from "vitest";

import { cepDigits, formatAddress, formatCep, isValidCep, parseViaCep } from "@/server/models/address.model";

describe("CEP", () => {
  it("guarda só os 8 dígitos", () => {
    expect(cepDigits("60.115-190")).toBe("60115190");
    expect(cepDigits("601151901234")).toBe("60115190");
    expect(cepDigits("abc")).toBe("");
  });
  it("formata como 00000-000 enquanto digita", () => {
    expect(formatCep("60115")).toBe("60115");
    expect(formatCep("60115190")).toBe("60115-190");
    expect(formatCep("60115-1")).toBe("60115-1");
  });
  it("valida: 8 dígitos e não zerado", () => {
    expect(isValidCep("60115-190")).toBe(true);
    expect(isValidCep("6011519")).toBe(false);
    expect(isValidCep("00000-000")).toBe(false);
  });
});

describe("parseViaCep", () => {
  it("converte a resposta do ViaCEP", () => {
    expect(
      parseViaCep({ cep: "60115-190", logradouro: "Rua Silva Jatahy", bairro: "Meireles", localidade: "Fortaleza", uf: "ce" })
    ).toEqual({ street: "Rua Silva Jatahy", neighborhood: "Meireles", city: "Fortaleza", state: "CE" });
  });
  it("CEP inexistente (erro) ou lixo vira null", () => {
    expect(parseViaCep({ erro: true })).toBeNull();
    expect(parseViaCep({ erro: "true" })).toBeNull();
    expect(parseViaCep(null)).toBeNull();
    expect(parseViaCep("x")).toBeNull();
  });
  it("CEP geral de cidade (sem rua nem bairro) ainda preenche cidade e UF", () => {
    expect(parseViaCep({ logradouro: "", bairro: "", localidade: "Caucaia", uf: "CE" })).toEqual({
      street: "",
      neighborhood: "",
      city: "Caucaia",
      state: "CE",
    });
  });
});

describe("formatAddress", () => {
  it("monta o endereço em uma linha, pulando o que falta", () => {
    expect(
      formatAddress({
        street: "Rua Silva Jatahy",
        streetNumber: "1200",
        complement: "Apto 302",
        neighborhood: "Meireles",
        city: "Fortaleza",
        state: "CE",
        zipCode: "60115190",
      })
    ).toBe("Rua Silva Jatahy, 1200 - Apto 302 - Meireles, Fortaleza/CE - CEP 60115-190");
  });
  it("sem nada, devolve null", () => {
    expect(formatAddress({})).toBeNull();
  });
  it("só cidade e UF", () => {
    expect(formatAddress({ city: "Caucaia", state: "CE" })).toBe("Caucaia/CE");
  });
});
