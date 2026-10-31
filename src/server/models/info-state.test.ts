import { describe, expect, it } from "vitest";

import { infoRequestState } from "@/server/models/candidate-list.model";

describe("infoRequestState", () => {
  it("sem pedido, não há estado", () => {
    expect(infoRequestState(null, null)).toBeNull();
  });
  it("pedido sem resposta aguarda o candidato", () => {
    expect(infoRequestState(new Date(), null)).toBe("WAITING");
  });
  it("respondido", () => {
    expect(infoRequestState(new Date("2026-10-01"), new Date("2026-10-02"))).toBe("ANSWERED");
  });
});
