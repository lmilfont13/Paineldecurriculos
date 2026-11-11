import { describe, expect, it } from "vitest";

import { notFoundTarget } from "./not-found.model";

describe("notFoundTarget", () => {
  it("leva o candidato de volta às vagas da empresa", () => {
    expect(notFoundTarget("/technova/vagas/nao-existe")).toEqual({ href: "/technova/vagas", label: "Ver vagas abertas" });
  });
  it("leva o gestor de volta ao painel", () => {
    expect(notFoundTarget("/candidaturas/nao-existe").href).toBe("/painel");
    expect(notFoundTarget("/talentos/x").href).toBe("/painel");
    expect(notFoundTarget("/admin/empresas/x").href).toBe("/admin/empresas");
  });
  it("no resto, vai para o início (e nunca monta link com texto estranho)", () => {
    expect(notFoundTarget("/").href).toBe("/");
    expect(notFoundTarget("/login/x").href).toBe("/");
    expect(notFoundTarget("/%3Cscript%3E/x").href).toBe("/");
  });
});
