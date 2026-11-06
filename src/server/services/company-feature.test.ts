import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    messageTemplate: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  isCandidateAiRadarEnabled,
  setCandidateAiRadarEnabled,
  isWhatsappTemplatesEnabled,
  setWhatsappTemplatesEnabled,
  isCommandPaletteEnabled,
  setCommandPaletteEnabled,
  isCandidateTimelineEnabled,
  setCandidateTimelineEnabled,
  isUndoActionEnabled,
  setUndoActionEnabled,
  isDynamicOgEnabled,
  setDynamicOgEnabled,
  isSoundNotificationsEnabled,
  setSoundNotificationsEnabled,
  isTargetRadioSpotsEnabled,
  setTargetRadioSpotsEnabled,
} from "./company-feature.service";

describe("company-feature service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna true por padrão quando não há registro", async () => {
    (prisma.messageTemplate.findUnique as any).mockResolvedValue(null);
    const enabled = await isCandidateAiRadarEnabled("comp_1");
    expect(enabled).toBe(true);
  });

  it("retorna false quando registrado como false", async () => {
    (prisma.messageTemplate.findUnique as any).mockResolvedValue({ body: "false" });
    const enabled = await isCandidateAiRadarEnabled("comp_1");
    expect(enabled).toBe(false);
  });

  it("retorna true quando registrado como true", async () => {
    (prisma.messageTemplate.findUnique as any).mockResolvedValue({ body: "true" });
    const enabled = await isCandidateAiRadarEnabled("comp_1");
    expect(enabled).toBe(true);
  });

  it("salva alteração corretamente", async () => {
    (prisma.messageTemplate.upsert as any).mockResolvedValue({});
    await setCandidateAiRadarEnabled("comp_1", false);
    expect(prisma.messageTemplate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ body: "false" }),
        update: expect.objectContaining({ body: "false" }),
      })
    );
  });

  it("controla flag de whatsapp templates", async () => {
    (prisma.messageTemplate.findUnique as any).mockResolvedValue({ body: "true" });
    expect(await isWhatsappTemplatesEnabled("comp_1")).toBe(true);
    await setWhatsappTemplatesEnabled("comp_1", false);
    expect(prisma.messageTemplate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ body: "false" }),
      })
    );
  });

  it("controla flag de command palette", async () => {
    (prisma.messageTemplate.findUnique as any).mockResolvedValue(null);
    expect(await isCommandPaletteEnabled("comp_1")).toBe(true);
    await setCommandPaletteEnabled("comp_1", false);
    expect(prisma.messageTemplate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ body: "false" }),
      })
    );
  });

  it("controla flag de linha do tempo do candidato", async () => {
    (prisma.messageTemplate.findUnique as any).mockResolvedValue(null);
    expect(await isCandidateTimelineEnabled("comp_1")).toBe(true);
    await setCandidateTimelineEnabled("comp_1", false);
    expect(prisma.messageTemplate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ body: "false" }),
      })
    );
  });

  it("controla flag de desfazer no funil", async () => {
    (prisma.messageTemplate.findUnique as any).mockResolvedValue(null);
    expect(await isUndoActionEnabled("comp_1")).toBe(true);
    await setUndoActionEnabled("comp_1", false);
    expect(prisma.messageTemplate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ body: "false" }),
      })
    );
  });

  it("controla flag de cards sociais dinâmicos", async () => {
    (prisma.messageTemplate.findUnique as any).mockResolvedValue(null);
    expect(await isDynamicOgEnabled("comp_1")).toBe(true);
    await setDynamicOgEnabled("comp_1", false);
    expect(prisma.messageTemplate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ body: "false" }),
      })
    );
  });

  it("controla flag de notificações sonoras", async () => {
    (prisma.messageTemplate.findUnique as any).mockResolvedValue(null);
    expect(await isSoundNotificationsEnabled("comp_1")).toBe(true);
    await setSoundNotificationsEnabled("comp_1", false);
    expect(prisma.messageTemplate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ body: "false" }),
      })
    );
  });

  it("controla flag de spots da Target na rádio", async () => {
    (prisma.messageTemplate.findUnique as any).mockResolvedValue(null);
    expect(await isTargetRadioSpotsEnabled("comp_1")).toBe(true);
    await setTargetRadioSpotsEnabled("comp_1", false);
    expect(prisma.messageTemplate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ body: "false" }),
      })
    );
  });
});
