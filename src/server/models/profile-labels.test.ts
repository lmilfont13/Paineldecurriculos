import { describe, expect, it } from "vitest";

import { profileChoiceLabel } from "@/server/models/application.model";

describe("profileChoiceLabel", () => {
  it("traduz os valores do perfil para o que o candidato viu", () => {
    expect(profileChoiceLabel("workPreference", "REMOTE")).toBe("100% Remoto");
    expect(profileChoiceLabel("workPreference", "ANY")).toBe("Qualquer modalidade");
    expect(profileChoiceLabel("availability", "15_DAYS")).toBe("Até 15 dias");
    expect(profileChoiceLabel("hasCnh", "AB")).toBe("Cat. AB (Carro e Moto)");
    expect(profileChoiceLabel("hasCnh", "NONE")).toBe("Não possui");
  });
  it("valor desconhecido ou vazio devolve vazio, sem quebrar", () => {
    expect(profileChoiceLabel("hasCnh", "XYZ")).toBe("");
    expect(profileChoiceLabel("availability", "")).toBe("");
  });
});
