import { describe, expect, it } from "vitest";

import {
  normalizeFolderName,
  normalizeArea,
  sameFolderName,
  suggestFolderName,
  suggestTalentPool,
} from "@/server/models/talent.model";
import { parseProfile } from "@/server/models/ai.model";

describe("pastas do banco de talentos", () => {
  it("normaliza o nome", () => {
    expect(normalizeFolderName("  motorista   e entregador ")).toBe("Entregador e motorista");
    expect(normalizeFolderName("   ")).toBe("");
    expect(normalizeFolderName("x".repeat(80))).toHaveLength(60);
  });

  it("neutraliza gênero (feminino → masculino)", () => {
    expect(normalizeFolderName("Promotora de vendas")).toBe("Promotor de vendas");
    expect(normalizeFolderName("Vendedora e promotora")).toBe("Promotor e vendedor");
    expect(normalizeFolderName("Consultora comercial")).toBe("Consultor comercial");
  });

  it("ordena termos compostos com 'e'", () => {
    expect(normalizeFolderName("Vendedora e promotora")).toBe("Promotor e vendedor");
    expect(normalizeFolderName("Promotor e vendedor")).toBe("Promotor e vendedor");
  });

  it("reconhece a mesma pasta ignorando caixa, acento, gênero e ordem", () => {
    expect(sameFolderName("Logística ", "logistica")).toBe(true);
    expect(sameFolderName("Promotor de vendas", "Promotora de vendas")).toBe(true);
    expect(sameFolderName("Vendedora e promotora", "Promotor e vendedor")).toBe(true);
    expect(sameFolderName("Vendas", "Vendedor")).toBe(false);
  });

  it("sugere guardar quem ficou abaixo do mínimo da vaga", () => {
    expect(suggestTalentPool({ aiState: "DONE", aiScore: 40, minScore: 70 })).toBe(true);
    expect(suggestTalentPool({ aiState: "DONE", aiScore: 80, minScore: 70 })).toBe(false);
    expect(suggestTalentPool({ aiState: "PROCESSING", aiScore: null, minScore: 70 })).toBe(false);
  });
});

describe("normalizeArea", () => {
  it("mapeia sinônimos para área canônica", () => {
    expect(normalizeArea("Vendas")).toBe("Vendas");
    expect(normalizeArea("varejo")).toBe("Vendas");
    expect(normalizeArea("promoção")).toBe("Vendas");
    expect(normalizeArea("Cosméticos")).toBe("Beleza");
    expect(normalizeArea("Estética")).toBe("Beleza");
    expect(normalizeArea("Transporte")).toBe("Logística");
    expect(normalizeArea("Desconhecida")).toBe("Outros");
    expect(normalizeArea("Indefinida")).toBe("Outros");
  });

  it("simplifica áreas compostas pelo primeiro termo", () => {
    expect(normalizeArea("Vendas e Atendimento")).toBe("Vendas");
    expect(normalizeArea("Vendas e Beleza")).toBe("Vendas");
    expect(normalizeArea("Vendas e Cosméticos")).toBe("Vendas");
    expect(normalizeArea("Varejo e Atendimento")).toBe("Vendas");
    expect(normalizeArea("Cosméticos e vendas")).toBe("Beleza");
  });

  it("mantém áreas simples intactas", () => {
    expect(normalizeArea("Logística")).toBe("Logística");
    expect(normalizeArea("Trade Marketing")).toBe("Trade Marketing");
    expect(normalizeArea("")).toBe("Outros");
  });

  it("capitaliza áreas desconhecidas do mapa", () => {
    expect(normalizeArea("educação")).toBe("Educação");
  });
});

describe("suggestFolderName", () => {
  it("retorna a área canônica", () => {
    expect(suggestFolderName({ area: "Vendas e atendimento", role: "Promotor" })).toBe("Vendas");
    expect(suggestFolderName({ area: "Cosméticos", role: "Manicure" })).toBe("Beleza");
  });

  it("usa o role como fallback quando não há área", () => {
    expect(suggestFolderName({ area: null, role: "Logística" })).toBe("Logística");
    expect(suggestFolderName({ area: "", role: "varejo" })).toBe("Vendas");
  });

  it("retorna Outros quando não há nada", () => {
    expect(suggestFolderName({ area: null, role: null })).toBe("Outros");
    expect(suggestFolderName({ area: "", role: "" })).toBe("Outros");
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
