import { describe, expect, it } from "vitest";
import {
  BIRTHDAY_AI_STYLES,
  buildBirthdayImagePrompt,
} from "./birthday-image.model";

describe("birthday-image.model", () => {
  it("contém os 4 estilos de cartões comemorativos de aniversário", () => {
    expect(BIRTHDAY_AI_STYLES.luxury_gold).toBeDefined();
    expect(BIRTHDAY_AI_STYLES.corporate_modern).toBeDefined();
    expect(BIRTHDAY_AI_STYLES.festive_warm).toBeDefined();
    expect(BIRTHDAY_AI_STYLES.botanical_prestige).toBeDefined();
  });

  it("gera prompt de cartão em inglês com idade quando fornecida", () => {
    const prompt = buildBirthdayImagePrompt({
      name: "Jéssica Silva",
      age: 33,
      company: "Trade & Talent",
      style: "luxury_gold",
    });

    expect(prompt).toContain("Jéssica Silva");
    expect(prompt).toContain("completing 33 years of life");
    expect(prompt).toContain("luxury birthday greeting card");
    expect(prompt).toContain("embossed polished gold borders");
  });

  it("gera prompt em inglês para cartão corporativo moderno", () => {
    const prompt = buildBirthdayImagePrompt({
      name: "Carlos Eduardo",
      company: "Acme Corp",
      style: "corporate_modern",
    });

    expect(prompt).toContain("contemporary corporate birthday greeting card");
    expect(prompt).toContain("Carlos Eduardo");
    expect(prompt).toContain("Acme Corp");
  });

  it("permite prompt customizado diretamente", () => {
    const prompt = buildBirthdayImagePrompt({
      name: "Ana",
      customPrompt: "A custom birthday card prompt",
    });

    expect(prompt).toBe("A custom birthday card prompt");
  });
});
