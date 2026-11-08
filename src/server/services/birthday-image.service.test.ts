import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { generateBirthdayAiImage } from "./birthday-image.service";

describe("generateBirthdayAiImage", () => {
  it("executa e retorna resultado estruturado", async () => {
    const res = await generateBirthdayAiImage({
      name: "Maria Julia",
      age: 28,
      company: "Mamoeiro",
      style: "luxury_gold",
      seed: 12345,
    });
    expect(res.ok).toBe(true);
    expect(res.base64).toBeDefined();
    expect(res.base64!.length).toBeGreaterThan(1000);
  }, 45000);

  it("garante fallback infalível para cartão se a rede externa falhar com 402/timeout", async () => {
    // Simula falha da rede externa (HTTP 402 / Payment Required de terceiros)
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      text: async () => "Payment Required",
    } as any);

    try {
      const res = await generateBirthdayAiImage({
        name: "Jessica Silva",
        age: 33,
        company: "Trade & Talent",
        style: "luxury_gold",
      });

      expect(res.ok).toBe(true);
      expect(res.engine).toBe("card_studio");
      expect(res.base64).toBeDefined();
      expect(res.base64!.length).toBeGreaterThan(1000);
      expect(res.error).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
