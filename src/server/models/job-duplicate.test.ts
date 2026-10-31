import { describe, expect, it } from "vitest";

import { findDuplicateJob } from "@/server/models/job.model";

const job = (over: Record<string, unknown>) => ({
  id: "j1",
  title: "Promotor de Vendas",
  code: "1124",
  location: "Fortaleza, CE",
  status: "OPEN",
  ...over,
});

describe("findDuplicateJob", () => {
  it("mesmo cargo e mesma cidade (sem ligar para caixa e acento) é duplicada", () => {
    const dup = findDuplicateJob([job({})] as never, {
      title: "  promotor DE vendas ",
      location: "fortaleza, ce",
    });
    expect(dup?.id).toBe("j1");
  });
  it("mesmo código é duplicada, mesmo com cargo diferente", () => {
    expect(
      findDuplicateJob([job({})] as never, { title: "Outro cargo", location: "", code: "1124" })?.id
    ).toBe("j1");
  });
  it("outra cidade não é duplicada", () => {
    expect(
      findDuplicateJob([job({})] as never, { title: "Promotor de Vendas", location: "Caucaia, CE" })
    ).toBeNull();
  });
  it("vaga encerrada não conta, e a própria vaga editada também não", () => {
    expect(
      findDuplicateJob([job({ status: "CLOSED" })] as never, { title: "Promotor de Vendas", location: "Fortaleza, CE" })
    ).toBeNull();
    expect(
      findDuplicateJob([job({})] as never, { title: "Promotor de Vendas", location: "Fortaleza, CE" }, "j1")
    ).toBeNull();
  });
  it("sem cidade nos dois lados, só o cargo decide", () => {
    expect(
      findDuplicateJob([job({ location: null })] as never, { title: "Promotor de Vendas", location: "" })?.id
    ).toBe("j1");
  });
});
