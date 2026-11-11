import { describe, expect, it } from "vitest";

import {
  AUTO_RETRY_MAX_RUNS,
  canAutoRetry,
  isRateLimitError,
  isStuckForAutoRetry,
  isTransientAiError,
  isUnreadableFileError,
  retryDelayMs,
} from "./ai-retry.model";

describe("ai-retry.model", () => {
  it("reconhece arquivo que nunca vai ser lido", () => {
    expect(isUnreadableFileError("The PDF file is empty, i.e. its size is zero bytes.")).toBe(true);
    expect(isUnreadableFileError("Invalid PDF structure.")).toBe(true);
    expect(isUnreadableFileError("Groq 429: Rate limit reached")).toBe(false);
    expect(isUnreadableFileError(null)).toBe(false);
  });

  it("separa limite de uso e erros passageiros", () => {
    expect(isRateLimitError('Groq 429: {"error":{"message":"Rate limit reached')).toBe(true);
    expect(isTransientAiError("Tempo esgotado: a execução ficou mais de 5 minutos")).toBe(true);
    expect(isTransientAiError("fetch failed")).toBe(true);
    expect(isTransientAiError("The PDF file is empty")).toBe(false);
  });

  it("espera mais quando é limite de uso", () => {
    expect(retryDelayMs(2, true)).toBeGreaterThan(retryDelayMs(2, false));
    expect(retryDelayMs(3, true)).toBeGreaterThan(retryDelayMs(2, true));
  });

  it("para de reenfileirar sozinho no teto", () => {
    expect(canAutoRetry(0)).toBe(true);
    expect(canAutoRetry(AUTO_RETRY_MAX_RUNS - 1)).toBe(true);
    expect(canAutoRetry(AUTO_RETRY_MAX_RUNS)).toBe(false);
    expect(canAutoRetry(232)).toBe(false);
  });
});

describe("isStuckForAutoRetry", () => {
  const old = new Date(Date.now() - 60_000);
  const base = { hasImpediment: false, resumeUrl: "c/j/x.pdf", updatedAt: old };

  it("reenfileira quem ficou sem leitura ou falhou", () => {
    expect(isStuckForAutoRetry({ ...base, aiState: "NO_RESUME" }, 10_000)).toBe(true);
    expect(isStuckForAutoRetry({ ...base, aiState: "FAILED" }, 10_000)).toBe(true);
  });

  it("nunca refaz sozinho uma nota já concluída (abrir a ficha não muda a nota)", () => {
    // Regressão: DONE sem resumeText era reanalisado ao abrir a ficha e a
    // nota mudava sozinha (74 → 22 na empresa de demonstração).
    expect(isStuckForAutoRetry({ ...base, aiState: "DONE" }, 10_000)).toBe(false);
  });

  it("respeita impedimento, falta de arquivo e idade mínima", () => {
    expect(isStuckForAutoRetry({ ...base, aiState: "FAILED", hasImpediment: true }, 10_000)).toBe(false);
    expect(isStuckForAutoRetry({ ...base, aiState: "FAILED", resumeUrl: null }, 10_000)).toBe(false);
    expect(isStuckForAutoRetry({ ...base, aiState: "FAILED", updatedAt: new Date() }, 10_000)).toBe(false);
  });
});
