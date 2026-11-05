import { describe, expect, it } from "vitest";

import { categorizePresence } from "@/components/gestor/online-presence";

describe("categorizePresence", () => {
  it("classifica como cadastro quando o candidato está na inscrição ou formulário", () => {
    const res1 = categorizePresence("/empresa/vagas/1126/candidatar", "candidato");
    expect(res1.category).toBe("cadastro");
    expect(res1.screenTitle).toContain("Formulário de Candidatura");

    const res2 = categorizePresence("/empresa/entrar", "candidato");
    expect(res2.category).toBe("cadastro");
    expect(res2.screenTitle).toContain("Login / Cadastro");
  });

  it("classifica como perfil quando o candidato está no perfil ou minhas candidaturas", () => {
    const res1 = categorizePresence("/empresa/perfil", "candidato");
    expect(res1.category).toBe("perfil");
    expect(res1.screenTitle).toContain("Perfil");

    const res2 = categorizePresence("/empresa/minhas-candidaturas", "candidato");
    expect(res2.category).toBe("perfil");
    expect(res2.screenTitle).toContain("Minhas Candidaturas");
  });

  it("classifica como principal quando o candidato está no mural de vagas", () => {
    const res1 = categorizePresence("/empresa/vagas", "candidato");
    expect(res1.category).toBe("principal");
    expect(res1.screenTitle).toContain("Mural de Vagas");

    const res2 = categorizePresence("/empresa", "candidato");
    expect(res2.category).toBe("principal");
  });

  it("classifica como painel quando é membro da equipe ou rota do gestor", () => {
    const res = categorizePresence("/candidaturas", "equipe");
    expect(res.category).toBe("painel");
    expect(res.categoryLabel).toBe("Equipe no Painel");
  });
});

