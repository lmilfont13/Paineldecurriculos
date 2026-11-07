import { describe, expect, it } from "vitest";
import {
  DEFAULT_AVATAR,
  containsProfanity,
  enterSpaceSchema,
  normalizeAvatar,
  resolveRoomFromCoords,
  sanitizePublicBubble,
} from "./support.model";

describe("support.model", () => {
  it("normaliza avatar inválido para o padrão", () => {
    expect(normalizeAvatar(null)).toEqual(DEFAULT_AVATAR);
    expect(normalizeAvatar({ skin: "#f9dcc4", hair: "topete" }).hair).toBe("topete");
  });

  it("exige aceitação das regras para entrar no espaço", () => {
    const fail = enterSpaceSchema.safeParse({
      displayName: "Vanessa",
      avatar: DEFAULT_AVATAR,
      rulesAccepted: false,
    });
    expect(fail.success).toBe(false);

    const ok = enterSpaceSchema.safeParse({
      displayName: "Vanessa",
      avatar: DEFAULT_AVATAR,
      rulesAccepted: true,
    });
    expect(ok.success).toBe(true);
  });

  it("filtra palavras ofensivas e valida balões públicos", () => {
    expect(containsProfanity("Bom dia pessoal, tudo bem?")).toBe(false);
    expect(containsProfanity("Você é um idiota")).toBe(true);

    const clean = sanitizePublicBubble("  Olá equipe do RH!  ");
    expect(clean.ok).toBe(true);
    expect(clean.clean).toBe("Olá equipe do RH!");

    const bad = sanitizePublicBubble("Seu imbecil");
    expect(bad.ok).toBe(false);
    expect(bad.error).toContain("respeitosa");
  });

  it("identifica a sala correta pelas coordenadas do mapa", () => {
    expect(resolveRoomFromCoords(20, 20)).toBe("atendimento");
    expect(resolveRoomFromCoords(50, 50)).toBe("recepcao");
    expect(resolveRoomFromCoords(75, 25)).toBe("cafe");
    expect(resolveRoomFromCoords(42, 75)).toBe("jogos");
    expect(resolveRoomFromCoords(55, 75)).toBe("diretoria");
  });
});

