import { describe, expect, it } from "vitest";

import { photoStoragePath, pickPhotoIndex } from "@/server/models/photo.model";

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
