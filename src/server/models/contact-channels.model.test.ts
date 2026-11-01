import { describe, expect, it } from "vitest";

import {
  DEFAULT_CHANNELS,
  channelsFromCsv,
  channelsToCsv,
  parseChannels,
  serverChannels,
  whatsappUrl,
} from "@/server/models/contact-channels.model";

describe("parseChannels", () => {
  it("sem informação, mantém o comportamento de sempre: e-mail e aviso no sistema", () => {
    expect(parseChannels(undefined)).toEqual(DEFAULT_CHANNELS);
    expect(DEFAULT_CHANNELS).toEqual(["email", "system"]);
  });
  it("aceita qualquer combinação, sem repetir nem aceitar canal desconhecido", () => {
    expect(parseChannels(["whatsapp", "email", "whatsapp", "sms"])).toEqual(["whatsapp", "email"]);
  });
  it("lista vazia explícita continua vazia (o envio é recusado depois)", () => {
    expect(parseChannels([])).toEqual([]);
  });
});

describe("csv", () => {
  it("vai e volta", () => {
    expect(channelsToCsv(["email", "whatsapp"])).toBe("email,whatsapp");
    expect(channelsFromCsv("email,whatsapp")).toEqual(["email", "whatsapp"]);
  });
  it("campo ausente usa o padrão; vazio ('') significa nenhum", () => {
    expect(channelsFromCsv(null)).toEqual(DEFAULT_CHANNELS);
    expect(channelsFromCsv("")).toEqual([]);
  });
});

describe("serverChannels", () => {
  it("WhatsApp não é enviado pelo servidor: só e-mail e sistema", () => {
    expect(serverChannels(["whatsapp", "email"])).toEqual({ email: true, system: false });
    expect(serverChannels(["whatsapp"])).toEqual({ email: false, system: false });
  });
});

describe("whatsappUrl", () => {
  it("monta o link com o DDI e o texto", () => {
    expect(whatsappUrl("(85) 99999-1234", "Olá, tudo bem?")).toBe(
      "https://wa.me/5585999991234?text=Ol%C3%A1%2C%20tudo%20bem%3F"
    );
  });
  it("sem telefone válido, null", () => {
    expect(whatsappUrl("", "oi")).toBeNull();
    expect(whatsappUrl(null, "oi")).toBeNull();
    expect(whatsappUrl("123", "oi")).toBeNull();
  });
});
