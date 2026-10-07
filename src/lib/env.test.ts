import { afterEach, describe, expect, it } from "vitest";

import { appUrl, readEnv } from "@/lib/env";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe("readEnv", () => {
  it("remove o \\r\\n que vem de .env do Windows", () => {
    process.env.TEST_KEY = "abc123\r\n";
    expect(readEnv("TEST_KEY")).toBe("abc123");
  });
  it("trata vazio/só espaços como ausente", () => {
    process.env.TEST_KEY = " \r\n";
    expect(readEnv("TEST_KEY")).toBeUndefined();
    delete process.env.TEST_KEY;
    expect(readEnv("TEST_KEY")).toBeUndefined();
  });
});

describe("appUrl", () => {
  it("sem quebra de linha nem barra final", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://exemplo.vercel.app/\r\n";
    expect(appUrl()).toBe("https://exemplo.vercel.app");
  });
});
