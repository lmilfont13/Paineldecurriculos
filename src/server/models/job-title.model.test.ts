import { describe, expect, it } from "vitest";

import { jobCity, splitJobTitle } from "./job-title.model";

describe("splitJobTitle", () => {
  it("tira a cidade repetida no título quando ela é a cidade da vaga", () => {
    expect(splitJobTitle("Promotor de Merchandising - (GUARACIABA DO NORTE)", "Guaraciaba do Norte, CE")).toBe(
      "Promotor de Merchandising"
    );
    expect(splitJobTitle("Promotor de Merchandising - (UBAJARA - CE)", "Ubajara, CE")).toBe("Promotor de Merchandising");
    expect(splitJobTitle("Promotor(a) de Merchandising ( BREJO SANTO - CE )", "Brejo Santo, CE")).toBe(
      "Promotor(a) de Merchandising"
    );
    expect(splitJobTitle("Promotor(a) de Merchandising ( QUIXADÁ -CE )", "Quixadá, CE")).toBe(
      "Promotor(a) de Merchandising"
    );
    expect(splitJobTitle("Promotor(a) de Merchandising (PACAJUS - CE)", "Pacajus, CE")).toBe(
      "Promotor(a) de Merchandising"
    );
    expect(splitJobTitle("Repositor - Fortaleza/CE", "Fortaleza, CE")).toBe("Repositor");
  });

  it("junta o '(a)' solto", () => {
    expect(splitJobTitle("Promotor (a) de Merchandising ( LIMOEIRO DO NORTE - CE )", "Limoeiro do Norte, CE")).toBe(
      "Promotor(a) de Merchandising"
    );
  });

  it("não mexe quando o trecho não é a cidade da vaga", () => {
    expect(splitJobTitle("Analista (Pleno)", "Fortaleza, CE")).toBe("Analista (Pleno)");
    expect(splitJobTitle("Promotor - (Sobral)", "Fortaleza, CE")).toBe("Promotor - (Sobral)");
    expect(splitJobTitle("Promotor - (Sobral)", "")).toBe("Promotor - (Sobral)");
  });

  it("nunca deixa o título vazio", () => {
    expect(splitJobTitle("(Fortaleza)", "Fortaleza, CE")).toBe("(Fortaleza)");
  });
});

describe("jobCity", () => {
  it("pega a cidade da localização", () => {
    expect(jobCity("Guaraciaba do Norte, CE")).toBe("Guaraciaba do Norte");
    expect(jobCity("Fortaleza - CE")).toBe("Fortaleza");
    expect(jobCity("  ")).toBe("");
    expect(jobCity(null)).toBe("");
  });
});
