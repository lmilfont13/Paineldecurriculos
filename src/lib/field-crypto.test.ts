import { describe, expect, it } from "vitest";

import {
  decryptField,
  decryptSensitiveDeep,
  encryptField,
  encryptSensitiveWrites,
  isEncrypted,
  keyFromSecret,
} from "./field-crypto";

const key = keyFromSecret("uma-chave-de-teste-com-mais-de-32-caracteres!!")!;
const other = keyFromSecret("outra-chave-de-teste-com-mais-de-32-caracteres")!;

describe("keyFromSecret", () => {
  it("recusa chave ausente ou curta", () => {
    expect(keyFromSecret(undefined)).toBeNull();
    expect(keyFromSecret("  ")).toBeNull();
    expect(keyFromSecret("curta")).toBeNull();
    expect(key).toHaveLength(32);
  });
});

describe("encryptField / decryptField", () => {
  it("cifra e devolve o valor original", () => {
    const enc = encryptField("123.456.789-09", key);
    expect(isEncrypted(enc)).toBe(true);
    expect(enc).not.toContain("123");
    expect(decryptField(enc, key)).toBe("123.456.789-09");
  });

  it("o mesmo CPF gera textos diferentes a cada gravação", () => {
    expect(encryptField("12345678909", key)).not.toBe(encryptField("12345678909", key));
  });

  it("não cifra duas vezes", () => {
    const enc = encryptField("12345678909", key);
    expect(encryptField(enc, key)).toBe(enc);
  });

  it("sem chave grava como antes (texto normal) e lê texto antigo", () => {
    expect(encryptField("12345678909", null)).toBe("12345678909");
    expect(decryptField("12345678909", key)).toBe("12345678909");
    expect(decryptField("12345678909", null)).toBe("12345678909");
  });

  it("chave errada, valor adulterado ou sem chave: devolve null, nunca o texto cifrado", () => {
    const enc = encryptField("12345678909", key);
    expect(decryptField(enc, other)).toBeNull();
    expect(decryptField(enc, null)).toBeNull();
    expect(decryptField(enc.slice(0, -3) + "AAA", key)).toBeNull();
    expect(decryptField("enc:v1:lixo", key)).toBeNull();
  });
});

describe("encryptSensitiveWrites", () => {
  it("cifra rg e cpf em data, create, update e gravações aninhadas", () => {
    const args = {
      where: { id: "a", cpf: "nao-mexer" },
      data: {
        name: "Ana",
        rg: "12.345.678-9",
        cpf: { set: "12345678909" },
        candidate: { update: { cpf: "98765432100", where: { cpf: "nao-mexer" } } },
      },
      create: { cpf: "11122233344", rg: null },
      update: [{ rg: "1" }],
    };
    const out = encryptSensitiveWrites(args, key) as typeof args;
    expect(out.where.cpf).toBe("nao-mexer");
    expect(out.data.name).toBe("Ana");
    expect(decryptField(out.data.rg, key)).toBe("12.345.678-9");
    expect(isEncrypted(out.data.cpf.set)).toBe(true);
    expect(isEncrypted(out.data.candidate.update.cpf)).toBe(true);
    expect(out.data.candidate.update.where.cpf).toBe("nao-mexer");
    expect(isEncrypted(out.create.cpf)).toBe(true);
    expect(out.create.rg).toBeNull();
    expect(isEncrypted(out.update[0].rg)).toBe(true);
    // Não altera o objeto original.
    expect(args.data.rg).toBe("12.345.678-9");
  });

  it("sem chave não muda nada", () => {
    const args = { data: { cpf: "12345678909" } };
    expect(encryptSensitiveWrites(args, null)).toEqual(args);
  });
});

describe("decryptSensitiveDeep", () => {
  it("abre rg e cpf em listas e relações, preservando o resto", () => {
    const when = new Date("2026-11-11T12:00:00Z");
    const rows = [
      {
        id: "1",
        cpf: encryptField("12345678909", key),
        rg: "antigo-em-texto",
        createdAt: when,
        candidate: { cpf: encryptField("98765432100", key), name: "Ana" },
        notes: [{ body: "cpf: não é campo" }],
      },
    ];
    const out = decryptSensitiveDeep(rows, key) as typeof rows;
    expect(out[0].cpf).toBe("12345678909");
    expect(out[0].rg).toBe("antigo-em-texto");
    expect(out[0].candidate.cpf).toBe("98765432100");
    expect(out[0].createdAt).toBe(when);
    expect(out[0].notes[0].body).toBe("cpf: não é campo");
  });

  it("passa direto por null, números e contagens", () => {
    expect(decryptSensitiveDeep(null, key)).toBeNull();
    expect(decryptSensitiveDeep(3, key)).toBe(3);
    expect(decryptSensitiveDeep({ count: 2 }, key)).toEqual({ count: 2 });
  });
});

describe("script de conversão (prisma/encrypt-sensitive-data.mjs)", () => {
  it("usa o mesmo formato e a mesma chave do site", async () => {
    const script = await import("../../prisma/encrypt-sensitive-data.mjs");
    const secret = "uma-chave-de-teste-com-mais-de-32-caracteres!!";
    const scriptKey = script.keyFromSecret(secret) as Buffer;
    expect(scriptKey.equals(key)).toBe(true);
    expect(decryptField(script.encrypt("12345678909", scriptKey), key)).toBe("12345678909");
    expect(script.decrypt(encryptField("12.345.678-9", key), scriptKey)).toBe("12.345.678-9");
  });
});
