import { describe, expect, it } from "vitest";
import { findFace } from "@/server/services/face-detect.service";

describe("face-detect.service (strict-mode cascade)", () => {
  it("executa o detector de rosto em strict mode sem ReferenceError/TypeError do picojs", async () => {
    const width = 200;
    const height = 200;
    const channels = 3;
    const raw = new Uint8Array(width * height * channels).fill(240);
    const result = await findFace(raw, width, height, channels);
    expect(result).toBeNull();
  });

  it("retorna null com segurança para buffers pequenos ou inválidos", async () => {
    const result = await findFace(new Uint8Array(10), 20, 20, 3);
    expect(result).toBeNull();
  });
});
