import { describe, expect, it } from "vitest";
import { applicationAwarenessError, canReuseApplicationProfile, nextApplyStep, previousApplyStep } from "./apply-flow.model";

const profile = { name: "Ana Silva", phone: "85999991234", resumeUrl: "profile/c1/cv.pdf", instagram: null };

describe("reutilização do cadastro na candidatura", () => {
  it("só oferece o atalho a quem já se candidatou e tem currículo e contato válidos", () => {
    expect(canReuseApplicationProfile(profile, true)).toBe(true);
    expect(canReuseApplicationProfile(profile, false)).toBe(false);
    expect(canReuseApplicationProfile({ ...profile, resumeUrl: null }, true)).toBe(false);
    expect(canReuseApplicationProfile({ ...profile, phone: null }, true)).toBe(false);
    expect(canReuseApplicationProfile({ ...profile, name: "" }, true)).toBe(false);
  });

  it("avança às perguntas da empresa sem repetir o perfil quando não há perguntas de perfil", () => {
    expect(nextApplyStep(0, true, false)).toBe(2);
    expect(previousApplyStep(2, true, false)).toBe(0);
  });

  it("nunca pula perguntas configuradas na etapa Perfil", () => {
    expect(nextApplyStep(0, true, true)).toBe(1);
    expect(nextApplyStep(1, true, true)).toBe(2);
    expect(previousApplyStep(2, true, true)).toBe(1);
  });

  it("mantém o fluxo completo para cadastro novo ou para atualização", () => {
    expect(nextApplyStep(0, false, false)).toBe(1);
    expect(nextApplyStep(1, false, false)).toBe(2);
    expect(nextApplyStep(2, false, false)).toBe(3);
    expect(previousApplyStep(2, false, false)).toBe(1);
    expect(previousApplyStep(0, false, false)).toBe(0);
  });
});

describe("ciência obrigatória mesmo reutilizando o currículo", () => {
  it("bloqueia até marcar CLT e, quando necessário, vaga temporária", () => {
    expect(applicationAwarenessError(false, false, false)).toContain("CLT");
    expect(applicationAwarenessError(false, true, true)).toContain("CLT");
    expect(applicationAwarenessError(true, true, false)).toContain("temporária");
    expect(applicationAwarenessError(true, false, false)).toBeNull();
    expect(applicationAwarenessError(true, true, true)).toBeNull();
  });
});
