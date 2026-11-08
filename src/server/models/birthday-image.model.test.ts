import { describe, expect, it } from "vitest";
import {
  BIRTHDAY_AI_STYLES,
  buildBirthdayImagePrompt,
} from "./birthday-image.model";

describe("birthday-image.model", () => {
  it("contém os 4 estilos visuais profissionais", () => {
    expect(BIRTHDAY_AI_STYLES.luxury_gold).toBeDefined();
    expect(BIRTHDAY_AI_STYLES.gourmet_cake).toBeDefined();
    expect(BIRTHDAY_AI_STYLES.corporate_achievement).toBeDefined();
    expect(BIRTHDAY_AI_STYLES.warm_botanical).toBeDefined();
  });

  it("gera prompt em inglês com idade quando fornecida", () => {
    const prompt = buildBirthdayImagePrompt({
      name: "Jéssica Silva",
      age: 33,
      company: "Tárguet",
      style: "luxury_gold",
    });

    expect(prompt).toContain("celebrating 33 years of life and success");
    expect(prompt).toContain("Ultra-realistic");
    expect(prompt).toContain("crystal glasses");
  });

  it("gera prompt em inglês para bolo gourmet", () => {
    const prompt = buildBirthdayImagePrompt({
      name: "Carlos Eduardo",
      age: 40,
      company: "Acme",
      style: "gourmet_cake",
    });

    expect(prompt).toContain("artisanal birthday cake");
    expect(prompt).toContain("celebrating 40th birthday");
  });

  it("permite prompt customizado diretamente", () => {
    const prompt = buildBirthdayImagePrompt({
      name: "Ana",
      customPrompt: "A custom prompt for celebration",
    });

    expect(prompt).toBe("A custom prompt for celebration");
  });
});

