import { describe, expect, it } from "vitest";

import { instagramUrl, parseInstagram } from "@/server/models/instagram.model";

describe("Instagram do candidato", () => {
  it("aceita @usuario, usuario e o link do perfil, guardando só o usuário", () => {
    for (const input of ["@Maria.Souza", "maria.souza", " maria.souza ", "https://www.instagram.com/maria.souza/", "instagram.com/maria.souza?igsh=abc", "@@maria.souza"]) {
      expect(parseInstagram(input), input).toEqual({ handle: "maria.souza" });
    }
  });

  it("vazio é opcional; usuário com caracteres proibidos é inválido", () => {
    expect(parseInstagram("")).toEqual({ handle: null });
    expect(parseInstagram(null)).toEqual({ handle: null });
    for (const bad of ["maria souza", "maria-souza", ".maria", "maria.", "ma..ria", "a".repeat(31), "https://facebook.com/maria"]) {
      expect("error" in parseInstagram(bad), bad).toBe(true);
    }
  });

  it("monta o link do perfil", () => {
    expect(instagramUrl("maria.souza")).toBe("https://www.instagram.com/maria.souza/");
  });
});
