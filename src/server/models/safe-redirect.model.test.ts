import { describe, expect, it } from "vitest";

import { safeInternalPath } from "./safe-redirect.model";

describe("safeInternalPath", () => {
  it("aceita caminhos internos", () => {
    expect(safeInternalPath("/technova/vagas/abc/candidatar", "/")).toBe("/technova/vagas/abc/candidatar");
    expect(safeInternalPath("/technova/minhas-candidaturas?x=1", "/")).toBe("/technova/minhas-candidaturas?x=1");
  });

  it("recusa destinos externos, inclusive com barra invertida", () => {
    expect(safeInternalPath("https://evil.com", "/ok")).toBe("/ok");
    expect(safeInternalPath("//evil.com", "/ok")).toBe("/ok");
    // O navegador lê "/\evil.com" como "//evil.com".
    expect(safeInternalPath("/\\evil.com", "/ok")).toBe("/ok");
    expect(safeInternalPath("/\t/evil.com", "/ok")).toBe("/ok");
    expect(safeInternalPath("/a\nb", "/ok")).toBe("/ok");
  });

  it("usa o padrão quando não vem nada", () => {
    expect(safeInternalPath(null, "/ok")).toBe("/ok");
    expect(safeInternalPath(undefined, "/ok")).toBe("/ok");
    expect(safeInternalPath("", "/ok")).toBe("/ok");
  });
});
