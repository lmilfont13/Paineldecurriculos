import { describe, expect, it } from "vitest";

import { pickByRelevance, relevance, whatsappInvite, whatsappNumber } from "@/server/models/standby.model";

const promotor = {
  title: "Promotor(a) de Vendas – Laticínios e Frios",
  aiCriteria: ["Experiência como promotor(a) ou repositor(a)", "Reposição e organização de PDV"],
};

describe("relevance", () => {
  it("perfil parecido pontua mais que perfil diferente", () => {
    const parecido = relevance(promotor, {
      aiProfile: "Promotor de vendas",
      aiArea: "Vendas e trade marketing",
      folderNames: ["Vendas · Promotor de vendas"],
    });
    const diferente = relevance(promotor, {
      aiProfile: "Motorista e entregador",
      aiArea: "Logística",
      folderNames: ["Logística · Motorista"],
    });
    expect(parecido).toBeGreaterThan(diferente);
    expect(diferente).toBe(0);
  });
});

describe("pickByRelevance", () => {
  it("com pouca gente analisa todos; com muita, só quem tem algo em comum", () => {
    expect(pickByRelevance([{ item: "a", relevance: 0 }, { item: "b", relevance: 3 }], 5)).toEqual(["b", "a"]);
    const many = Array.from({ length: 10 }, (_, i) => ({ item: i, relevance: i % 2 }));
    const picked = pickByRelevance(many, 8);
    expect(picked).toHaveLength(5);
    expect(picked.every((i) => i % 2 === 1)).toBe(true);
  });
});

describe("convite pelo WhatsApp", () => {
  it("normaliza o telefone", () => {
    expect(whatsappNumber("(85) 99999-0000")).toBe("5585999990000");
    expect(whatsappNumber("+55 85 3333-4444")).toBe("558533334444");
    expect(whatsappNumber("123")).toBeNull();
  });

  it("monta a mensagem com primeiro nome, empresa, vaga e link", () => {
    const link = whatsappInvite({
      phone: "85999990000",
      name: "Juliana Prado Matos",
      company: "TARHGET",
      jobTitle: "Recepcionista",
      url: "https://x.app/tarhget/vagas/1",
    })!;
    const text = decodeURIComponent(link.split("text=")[1]);
    expect(link.startsWith("https://wa.me/5585999990000?text=")).toBe(true);
    expect(text).toContain("Oi, Juliana!");
    expect(text).toContain("Recepcionista");
    expect(text).toContain("https://x.app/tarhget/vagas/1");
  });
});
