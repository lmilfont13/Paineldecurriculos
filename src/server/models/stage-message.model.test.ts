import { describe, expect, it } from "vitest";

import { stageMovePreview } from "@/server/models/stage-message.model";

const ctx = { candidateName: "Maria Souza", companyName: "TARHGET", jobTitle: "Promotor(a)" };

describe("stageMovePreview", () => {
  it("entrevista, aprovação e reprovação: e-mail + aviso no site", () => {
    for (const status of ["INTERVIEW", "APPROVED", "REJECTED"] as const) {
      const p = stageMovePreview(status, ctx);
      expect(p.email?.greeting).toBe("Oi, Maria.");
      expect(p.email?.body).toContain("Promotor(a)");
      expect(p.site?.title).toBeTruthy();
    }
  });

  it("passou da triagem: só aviso no site; voltar para triagem: nada", () => {
    expect(stageMovePreview("SHORTLISTED", ctx)).toMatchObject({ email: null, site: { title: "Você passou da primeira fase" } });
    expect(stageMovePreview("PENDING", ctx)).toEqual({ email: null, site: null });
  });
});
