import { describe, expect, it } from "vitest";

import {
  BIRTHDAY_CARD_THEMES,
  MAX_CARD_MESSAGE,
  cardDisplayName,
  cardPalette,
  cleanCardMessage,
  nameFontSize,
  parseCardParams,
} from "./birthday-card.model";

describe("cardDisplayName", () => {
  it("primeiro nome ou nome e último sobrenome, com maiúsculas certas", () => {
    expect(cardDisplayName("MARIA JULIA DE ARAUJO", "first")).toBe("Maria");
    expect(cardDisplayName("maria julia de araujo", "full")).toBe("Maria Araujo");
    expect(cardDisplayName("  joão  ", "full")).toBe("João");
    expect(cardDisplayName("", "full")).toBe("Você");
  });
});

describe("cleanCardMessage", () => {
  it("tira emoji e marcação do WhatsApp e junta as quebras de linha", () => {
    expect(cleanCardMessage("Olá, Maria! 🎉🎂\n\nA equipe da *Trade* deseja _tudo de bom_! ✨")).toBe(
      "Olá, Maria! A equipe da Trade deseja tudo de bom!"
    );
  });

  it("corta mensagem longa numa palavra inteira, com reticências", () => {
    const out = cleanCardMessage("palavra ".repeat(100));
    expect(out.length).toBeLessThanOrEqual(MAX_CARD_MESSAGE);
    expect(out.endsWith("palavra…")).toBe(true);
  });

  it("vazio usa a mensagem padrão", () => {
    expect(cleanCardMessage("  🎂 ").length).toBeGreaterThan(20);
    expect(cleanCardMessage(null).length).toBeGreaterThan(20);
  });
});

describe("cardPalette", () => {
  it("tema da marca usa a cor da empresa e texto com contraste", () => {
    const dark = cardPalette("marca", "#811201");
    expect(dark.background).toBe("#811201");
    expect(dark.ink).toBe("#ffffff");
    const light = cardPalette("marca", "#FFE14D");
    expect(light.ink).toBe("#0a0a0a");
    expect(light.accent).not.toBe("#FFE14D"); // destaque visível sobre fundo claro
  });

  it("tema claro escurece uma marca clara demais para ler no papel", () => {
    expect(cardPalette("claro", "#811201").accent).toBe("#811201");
    expect(cardPalette("claro", "#FFE14D").accent).not.toBe("#FFE14D");
  });

  it("cor inválida cai no padrão em vez de quebrar a imagem", () => {
    expect(cardPalette("marca", "javascript:alert(1)").background).toMatch(/^#[0-9a-f]{6}$/i);
    expect(cardPalette("marca", "").background).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("todos os temas têm paleta completa", () => {
    for (const t of BIRTHDAY_CARD_THEMES) {
      const p = cardPalette(t.id, "#1E4FBF");
      for (const v of Object.values(p)) expect(v).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("parseCardParams", () => {
  const parse = (q: string) => parseCardParams(new URLSearchParams(q));

  it("valores desconhecidos caem no padrão", () => {
    const p = parse("name=Ana&theme=xss&mode=zzz&age=abc&showAge=true");
    expect(p.theme).toBe("marca");
    expect(p.mode).toBe("first");
    expect(p.age).toBeNull(); // sem idade válida, não mostra
  });

  it("idade só aparece quando pedida e plausível", () => {
    expect(parse("name=Ana&age=30&showAge=true").age).toBe(30);
    expect(parse("name=Ana&age=30").age).toBeNull();
    expect(parse("name=Ana&age=300&showAge=true").age).toBeNull();
  });

  it("limita o tamanho do nome", () => {
    expect(parse(`name=${"a".repeat(500)}`).name.length).toBeLessThanOrEqual(80);
  });
});

describe("nameFontSize", () => {
  it("nome maior, letra menor", () => {
    expect(nameFontSize("Ana")).toBeGreaterThan(nameFontSize("Maria Fernanda Albuquerque"));
  });
});
