import { describe, expect, it } from "vitest";

import {
  AUTO_RETRY_MAX_RUNS,
  canAutoRetry,
  isRateLimitError,
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
