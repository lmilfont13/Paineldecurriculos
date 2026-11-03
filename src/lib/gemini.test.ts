import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  readEnv: (k: string) => ({ ANTHROPIC_API_KEY: "sk-ant-teste", GROQ_API_KEY: "gsk-teste" })[k],
}));
vi.mock("@/server/repositories/company.repository", () => ({
  findCompanyById: vi.fn(async () => ({ aiModel: "claude-sonnet-5-5" })),
}));

import { generateWithModelInfo } from "@/lib/gemini";

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllGlobals());

describe("qual modelo de fato respondeu", () => {
  it("Claude responde: registra o Claude escolhido", async () => {
    fetchMock.mockResolvedValueOnce(ok({ content: [{ type: "text", text: "{}" }] }));
    const r = await generateWithModelInfo({ system: "s", prompt: "p", companyId: "co1" });
    expect(r.modelUsed).toBe("anthropic:claude-sonnet-5-5");
  });

  it("Claude falha e a Groq assume: registra a Groq, não o Sonnet", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("credit balance too low", { status: 400 }))
      .mockResolvedValueOnce(ok({ choices: [{ message: { content: "{}" } }] }));
    const r = await generateWithModelInfo({ system: "s", prompt: "p", companyId: "co1" });
    expect(r.modelUsed).toBe("groq:qwen/qwen3.8-27b");
  });

  it("modelo forçado (teste de modelos) nunca cai na reserva: o erro aparece", async () => {
    fetchMock.mockResolvedValueOnce(new Response("invalid x-api-key", { status: 401 }));
    await expect(
      generateWithModelInfo({ system: "s", prompt: "p", model: "claude-haiku-5-5" })
    ).rejects.toThrow("Claude 401: invalid x-api-key");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("modelos que recusam temperature", () => {
  it("repete sem temperature e não manda mais para esse modelo", async () => {
    const reject = () =>
      new Response('{"type":"error","error":{"type":"invalid_request_error","message":"`temperature` is deprecated for this model."}}', { status: 400 });
    fetchMock
      .mockResolvedValueOnce(reject())
      .mockResolvedValueOnce(ok({ content: [{ type: "text", text: "{\"score\":70}" }] }))
      .mockResolvedValueOnce(ok({ content: [{ type: "text", text: "{}" }] }));
    const r = await generateWithModelInfo({ system: "s", prompt: "p", model: "claude-haiku-5-5" });
    expect(r.text).toBe('{"score":70}');
    const bodies = fetchMock.mock.calls.map((c) => JSON.parse(String((c[1] as RequestInit).body)));
    expect(bodies[0].temperature).toBe(0.2);
    expect(bodies[1].temperature).toBeUndefined();
    await generateWithModelInfo({ system: "s", prompt: "p", model: "claude-haiku-5-5" });
    expect(JSON.parse(String((fetchMock.mock.calls[2][1] as RequestInit).body)).temperature).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
