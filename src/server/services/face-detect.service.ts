import sharp from "sharp";
// eslint-disable-next-line @typescript-eslint/no-require-imports -- picojs é CommonJS sem tipos úteis
const pico = require("picojs");

import { FACEFINDER_BASE64 } from "@/server/vendor/facefinder-data";
import { bestFace, type FaceDetection } from "@/server/models/photo.model";

type Classifier = (r: number, c: number, s: number, pixels: Uint8Array, ldim: number) => number;

let classifier: Classifier | null = null;

function loadClassifier(): Classifier {
  if (!classifier) {
    const bytes = new Int8Array(Buffer.from(FACEFINDER_BASE64, "base64"));
    classifier = pico.unpack_cascade(bytes) as Classifier;
  }
  return classifier;
}

/**
 * Procura um rosto numa imagem (ex.: currículo que é uma figura só). Roda no
 * próprio servidor com o detector do pico.js: a imagem nunca vai para uma IA
 * externa (regra 3). Devolve null se não achar com segurança.
 */
export async function findFace(
  raw: ArrayLike<number>,
  width: number,
  height: number,
  channels: 3 | 4
): Promise<FaceDetection | null> {
  const gray = await sharp(Buffer.from(raw as ArrayLike<number> as Uint8Array), { raw: { width, height, channels } })
    .flatten({ background: "#ffffff" })
    .greyscale()
    .raw()
    .toBuffer();

  const image = { pixels: new Uint8Array(gray), nrows: height, ncols: width, ldim: width };
  const params = {
    shiftfactor: 0.1,
    scalefactor: 1.1,
    minsize: Math.max(24, Math.round(Math.min(width, height) * 0.06)),
    maxsize: Math.round(Math.min(width, height) * 0.9),
  };
  const memory = pico.instantiate_detection_memory(5);
  let dets = pico.run_cascade(image, loadClassifier(), params);
  dets = memory(dets);
  dets = pico.cluster_detections(dets, 0.2);
  return bestFace(dets as number[][], width, height);
}
