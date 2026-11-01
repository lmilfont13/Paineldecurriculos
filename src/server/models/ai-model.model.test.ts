import { describe, expect, it } from "vitest";

import { parseAiModelChoice } from "@/server/models/ai-model.model";

describe("parseAiModelChoice", () => {
  it("aceita um modelo da lista", () => {
    expect(parseAiModelChoice("claude-sonnet-5-5")).toBe("claude-sonnet-5-5");
  });
  it("trata vazio e valores desconhecidos como padrão do sistema", () => {
    expect(parseAiModelChoice("")).toBeNull();
    expect(parseAiModelChoice("gpt-9")).toBeNull();
    expect(parseAiModelChoice(undefined)).toBeNull();
  });
});
