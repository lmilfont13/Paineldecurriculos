import { describe, expect, it } from "vitest";

import {
  bestFace,
  faceCropRegion,
  photoStoragePath,
  pickPageImageIndex,
  pickPhotoIndex,
} from "@/server/models/photo.model";

describe("pickPhotoIndex", () => {
  it("escolhe a maior imagem em retrato colorida", () => {
    expect(
      pickPhotoIndex([
        { width: 32, height: 32, channels: 4 }, // ícone
        { width: 900, height: 80, channels: 3 }, // faixa decorativa
        { width: 300, height: 400, channels: 3 }, // foto
        { width: 300, height: 400, channels: 1 }, // máscara
        { width: 120, height: 120, channels: 3 }, // logo menor
      ])
    ).toBe(2);
  });

  it("ignora página escaneada e devolve null sem candidatas", () => {
    expect(pickPhotoIndex([{ width: 1240, height: 1754, channels: 3 }])).toBeNull();
    expect(pickPhotoIndex([])).toBeNull();
  });
});

describe("photoStoragePath", () => {
  it("separa por empresa", () => {
    expect(photoStoragePath("co1", "app1")).toBe("photos/co1/app1.jpg");
  });
});

describe("rosto em currículo de figura única", () => {
  it("a página inteira escaneada continua fora de pickPhotoIndex, mas entra em pickPageImageIndex", () => {
    const page = [{ width: 1024, height: 1536, channels: 3 }];
    expect(pickPhotoIndex(page)).toBeNull();
    expect(pickPageImageIndex(page)).toBe(0);
  });

  it("pickPageImageIndex ignora ícones e imagens em tons de cinza", () => {
    expect(pickPageImageIndex([{ width: 100, height: 100, channels: 3 }])).toBeNull();
    expect(pickPageImageIndex([{ width: 1000, height: 1500, channels: 1 }])).toBeNull();
  });

  it("bestFace fica com a de maior confiança e descarta ruído", () => {
    const dets = [
      [100, 100, 80, 3],
      [300, 200, 120, 40],
      [500, 250, 90, 12],
    ];
    expect(bestFace(dets, 1024, 1536)).toEqual({ x: 200, y: 300, size: 120, score: 40 });
    expect(bestFace([[100, 100, 80, 4]], 1024, 1536)).toBeNull();
    expect(bestFace([], 1024, 1536)).toBeNull();
  });

  it("faceCropRegion é quadrado, com folga, e nunca sai da imagem", () => {
    const mid = faceCropRegion({ x: 500, y: 700, size: 100, score: 50 }, 1000, 1500);
    expect(mid).toEqual({ left: 425, top: 625, size: 150 });
    const corner = faceCropRegion({ x: 10, y: 10, size: 100, score: 50 }, 1000, 1500);
    expect(corner.left).toBe(0);
    expect(corner.top).toBe(0);
  });
});
