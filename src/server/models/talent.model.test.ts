import { describe, expect, it } from "vitest";

import { normalizeFolderName, sameFolderName, suggestTalentPool } from "@/server/models/talent.model";
import { parseProfile } from "@/server/models/ai.model";

describe("pastas do banco de talentos", () => {
  it("normaliza o nome", () => {
    expect(normalizeFolderName("  motorista   e entregador ")).toBe("Motorista e entregador");
    expect(normalizeFolderName("   ")).toBe("");
    expect(normalizeFolderName("x".repeat(80))).toHaveLength(60);
  });

  it("reconhece a mesma pasta ignorando caixa, acento e espaços", () => {
    expect(sameFolderName("Logística ", "logistica")).toBe(true);
    expect(sameFolderName("Vendas", "Vendedor")).toBe(false);
  });

  it("sugere guardar quem ficou abaixo do mínimo da vaga", () => {
    expect(suggestTalentPool({ aiState: "DONE", aiScore: 40, minScore: 70 })).toBe(true);
    expect(suggestTalentPool({ aiState: "DONE", aiScore: 80, minScore: 70 })).toBe(false);
    expect(suggestTalentPool({ aiState: "PROCESSING", aiScore: null, minScore: 70 })).toBe(false);
  });
});

describe("parseProfile", () => {
  it("lê o perfil curto da resposta da IA", () => {
    expect(parseProfile('{"criteria":[],"profile":"motorista e entregador."}')).toBe(
      "Motorista e entregador"
    );
    expect(parseProfile('{"profile":""}')).toBeNull();
    expect(parseProfile("sem json")).toBeNull();
    expect(parseProfile(`{"profile":"${"a".repeat(60)}"}`)).toBeNull();
  });
});
