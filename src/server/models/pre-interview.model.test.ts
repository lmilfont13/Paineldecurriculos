import { describe, expect, it } from "vitest";

import {
  buildInfoAnswerSchema,
  isValidCpf,
  maskCpf,
  maskRg,
  missingInfoFields,
  pendingRequestedFields,
  toWhatsappNumber,
  whatsappInfoLink,
  type KnownInfo,
} from "@/server/models/pre-interview.model";

const nothingKnown: KnownInfo = {
  maritalStatus: null,
  hasChildren: null,
  professionalSummary: null,
  rg: null,
  cpf: null,
  hasAddress: false,
  hasUniform: false,
  hasResumeText: true,
};

describe("isValidCpf", () => {
  it("aceita CPF válido, com ou sem pontuação", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
  });
  it("recusa sequência repetida, tamanho errado e dígito errado", () => {
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
    expect(isValidCpf("529.982.247-26")).toBe(false);
  });
});

describe("máscaras", () => {
  it("maskCpf esconde o começo e o fim", () => {
    expect(maskCpf("52998224725")).toBe("***.982.247-**");
    expect(maskCpf("529.982.247-25")).toBe("***.982.247-**");
  });
  it("maskRg mostra só os 2 últimos caracteres", () => {
    expect(maskRg("1234567")).toBe("*****67");
  });
});

describe("missingInfoFields", () => {
  it("com currículo com texto, o resumo não é pedido", () => {
    expect(missingInfoFields(nothingKnown)).toEqual([
      "maritalStatus",
      "children",
      "rg",
      "cpf",
      "address",
      "uniform",
    ]);
  });
  it("sem texto de currículo, o resumo é pedido", () => {
    expect(
      missingInfoFields({ ...nothingKnown, hasResumeText: false })
    ).toContain("professionalSummary");
  });
  it("não pede o que já foi informado", () => {
    expect(
      missingInfoFields({
        ...nothingKnown,
        maritalStatus: "Casado(a)",
        hasChildren: false,
        cpf: "52998224725",
      })
    ).toEqual(["rg", "address", "uniform"]);
  });
});

describe("endereço e uniforme na segunda fase", () => {
  it("não pede de novo o que o candidato já adiantou no cadastro", () => {
    expect(
      missingInfoFields({ ...nothingKnown, hasAddress: true, hasUniform: true })
    ).toEqual(["maritalStatus", "children", "rg", "cpf"]);
  });
  it("endereço exige CEP válido, rua e número", () => {
    const schema = buildInfoAnswerSchema(["address"]);
    const ok = {
      zipCode: "60115-190",
      street: "Rua Silva Jatahy",
      streetNumber: "1200",
      complement: "Apto 2",
      neighborhood: "Meireles",
      city: "Fortaleza",
      state: "ce",
    };
    const parsed = schema.safeParse(ok);
    expect(parsed.success).toBe(true);
    expect(parsed.success && (parsed.data as { zipCode: string; state: string }).zipCode).toBe("60115190");
    expect(parsed.success && (parsed.data as { zipCode: string; state: string }).state).toBe("CE");
    expect(schema.safeParse({ ...ok, zipCode: "123" }).success).toBe(false);
    expect(schema.safeParse({ ...ok, streetNumber: "" }).success).toBe(false);
  });
  it("uniforme exige os três tamanhos", () => {
    const schema = buildInfoAnswerSchema(["uniform"]);
    expect(schema.safeParse({ bootSize: "40", pantsSize: "42", shirtSize: "M" }).success).toBe(true);
    expect(schema.safeParse({ bootSize: "40", pantsSize: "", shirtSize: "M" }).success).toBe(false);
  });
});

describe("buildInfoAnswerSchema", () => {
  it("recusa CPF inválido", () => {
    const schema = buildInfoAnswerSchema(["cpf"]);
    expect(schema.safeParse({ cpf: "111.111.111-11" }).success).toBe(false);
    expect(schema.safeParse({ cpf: "529.982.247-25" }).success).toBe(true);
  });
  it("ignora campo que não foi pedido", () => {
    const parsed = buildInfoAnswerSchema(["cpf"]).safeParse({
      cpf: "52998224725",
      rg: "1234567",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && "rg" in parsed.data).toBe(false);
  });
  it("filhos: exige a escolha e aceita quantidade", () => {
    const schema = buildInfoAnswerSchema(["children"]);
    expect(schema.safeParse({}).success).toBe(false);
    expect(
      schema.safeParse({ hasChildren: true, childrenCount: 2 }).success
    ).toBe(true);
  });
});

describe("whatsappInfoLink", () => {
  const base = {
    candidateName: "Maria Souza",
    companyName: "Loja X",
    jobTitle: "Consultor de Vendas",
    url: "https://site.app/x/minhas-candidaturas/1/pre-entrevista",
  };
  it("monta o link com o DDI 55", () => {
    expect(whatsappInfoLink({ ...base, phone: "(85) 99999-1234" })).toMatch(
      /^https:\/\/wa\.me\/5585999991234\?text=/
    );
  });
  it("não duplica o 55", () => {
    expect(whatsappInfoLink({ ...base, phone: "5585999991234" })).toMatch(
      /^https:\/\/wa\.me\/5585999991234\?text=/
    );
  });
});

describe("pendingRequestedFields", () => {
  it("devolve só os pedidos que ainda faltam", () => {
    expect(
      pendingRequestedFields(["cpf", "rg"], { ...nothingKnown, cpf: "52998224725" })
    ).toEqual(["rg"]);
  });
  it("vazio quando tudo o que foi pedido já é conhecido", () => {
    expect(
      pendingRequestedFields(["cpf"], { ...nothingKnown, cpf: "52998224725" })
    ).toEqual([]);
  });
});

describe("toWhatsappNumber", () => {
  it("acrescenta o 55 a telefone brasileiro com DDD", () => {
    expect(toWhatsappNumber("(85) 99999-1234")).toBe("5585999991234");
    expect(toWhatsappNumber("85 3222-1234")).toBe("558532221234");
  });
  it("DDD 55 (RS) não é confundido com o DDI", () => {
    expect(toWhatsappNumber("(55) 99999-1234")).toBe("5555999991234");
  });
  it("mantém número que já vem com o DDI", () => {
    expect(toWhatsappNumber("+55 85 99999-1234")).toBe("5585999991234");
    expect(toWhatsappNumber("5585999991234")).toBe("5585999991234");
  });
});
