import { describe, expect, it } from "vitest";

import { describeDelivery, reachedCandidate } from "@/server/models/communication.model";

describe("describeDelivery", () => {
  it("diz o que aconteceu em cada canal", () => {
    expect(describeDelivery("INTERVIEW", { site: "ok", email: "sandbox" })).toBe(
      "Entrevista: aviso no site entregue; e-mail não chega ao candidato (remetente de teste do Resend)."
    );
    expect(describeDelivery("REJECTED", { site: "ok", email: "sent" })).toMatch(
      /^Processo finalizado:/
    );
  });
});

describe("reachedCandidate", () => {
  it("basta um canal ter chegado", () => {
    expect(reachedCandidate({ site: "ok", email: "off" })).toBe(true);
    expect(reachedCandidate({ site: "no-account", email: "sent" })).toBe(true);
    expect(reachedCandidate({ site: "no-account", email: "sandbox" })).toBe(false);
    expect(reachedCandidate({ site: "failed", email: "failed" })).toBe(false);
  });
});
