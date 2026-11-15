import sharp from "sharp";

import { FACEFINDER_BASE64 } from "@/server/vendor/facefinder-data";
import { bestFace, type FaceDetection } from "@/server/models/photo.model";

type Classifier = (
  r: number,
  c: number,
  s: number,
  pixels: Uint8Array,
  ldim: number
) => number;

type CascadeParams = {
  shiftfactor: number;
  scalefactor: number;
  minsize: number;
  maxsize: number;
};

type GrayImage = {
  pixels: Uint8Array;
  nrows: number;
  ncols: number;
  ldim: number;
};

/**
 * Implementação TypeScript estrita (strict-mode safe) do detector pico.js.
 * O pacote original `picojs` no npm usa variáveis globais não declaradas
 * (`pico = {}` e `idx = 1`), o que lança ReferenceError/TypeError em strict mode
 * no bundle de produção do Next.js / Turbopack.
 */
function unpackCascade(bytes: Int8Array): Classifier {
  const dview = new DataView(new ArrayBuffer(4));
  let p = 8;

  dview.setUint8(0, bytes[p + 0]);
  dview.setUint8(1, bytes[p + 1]);
  dview.setUint8(2, bytes[p + 2]);
  dview.setUint8(3, bytes[p + 3]);
  const tdepth = dview.getInt32(0, true);
  p += 4;

  dview.setUint8(0, bytes[p + 0]);
  dview.setUint8(1, bytes[p + 1]);
  dview.setUint8(2, bytes[p + 2]);
  dview.setUint8(3, bytes[p + 3]);
  const ntrees = dview.getInt32(0, true);
  p += 4;

  const pow2tdepth = Math.pow(2, tdepth) >> 0;
  const treeCodeLen = 4 * pow2tdepth - 4;
  const tcodesList: number[] = [];
  const tpredsList: number[] = [];
  const threshList: number[] = [];

  for (let t = 0; t < ntrees; ++t) {
    tcodesList.push(0, 0, 0, 0);
    for (let k = 0; k < treeCodeLen; ++k) {
      tcodesList.push(bytes[p + k]);
    }
    p += treeCodeLen;

    for (let i = 0; i < pow2tdepth; ++i) {
      dview.setUint8(0, bytes[p + 0]);
      dview.setUint8(1, bytes[p + 1]);
      dview.setUint8(2, bytes[p + 2]);
      dview.setUint8(3, bytes[p + 3]);
      tpredsList.push(dview.getFloat32(0, true));
      p += 4;
    }

    dview.setUint8(0, bytes[p + 0]);
    dview.setUint8(1, bytes[p + 1]);
    dview.setUint8(2, bytes[p + 2]);
    dview.setUint8(3, bytes[p + 3]);
    threshList.push(dview.getFloat32(0, true));
    p += 4;
  }

  const tcodes = new Int8Array(tcodesList);
  const tpreds = new Float32Array(tpredsList);
  const thresh = new Float32Array(threshList);

  return function classifyRegion(
    r: number,
    c: number,
    s: number,
    pixels: Uint8Array,
    ldim: number
  ): number {
    const row = 256 * r;
    const col = 256 * c;
    let root = 0;
    let o = 0.0;

    for (let i = 0; i < ntrees; ++i) {
      let idx = 1;
      for (let j = 0; j < tdepth; ++j) {
        const r1 = (row + tcodes[root + 4 * idx + 0] * s) >> 8;
        const c1 = (col + tcodes[root + 4 * idx + 1] * s) >> 8;
        const r2 = (row + tcodes[root + 4 * idx + 2] * s) >> 8;
        const c2 = (col + tcodes[root + 4 * idx + 3] * s) >> 8;
        const bit = pixels[r1 * ldim + c1] <= pixels[r2 * ldim + c2] ? 1 : 0;
        idx = 2 * idx + bit;
      }

      o += tpreds[pow2tdepth * i + idx - pow2tdepth];
      if (o <= thresh[i]) return -1;

      root += 4 * pow2tdepth;
    }

    return o - thresh[ntrees - 1];
  };
}

function runCascade(
  image: GrayImage,
  classifyRegion: Classifier,
  params: CascadeParams
): number[][] {
  const { pixels, nrows, ncols, ldim } = image;
  const { shiftfactor, minsize, maxsize, scalefactor } = params;

  let scale = minsize;
  const detections: number[][] = [];

  while (scale <= maxsize) {
    const step = Math.max(shiftfactor * scale, 1) >> 0;
    const offset = (scale / 2 + 1) >> 0;

    for (let r = offset; r <= nrows - offset; r += step) {
      for (let c = offset; c <= ncols - offset; c += step) {
        const q = classifyRegion(r, c, scale, pixels, ldim);
        if (q > 0.0) {
          detections.push([r, c, scale, q]);
        }
      }
    }

    scale *= scalefactor;
  }

  return detections;
}

function calculateIou(det1: number[], det2: number[]): number {
  const [r1, c1, s1] = det1;
  const [r2, c2, s2] = det2;
  const overr = Math.max(
    0,
    Math.min(r1 + s1 / 2, r2 + s2 / 2) - Math.max(r1 - s1 / 2, r2 - s2 / 2)
  );
  const overc = Math.max(
    0,
    Math.min(c1 + s1 / 2, c2 + s2 / 2) - Math.max(c1 - s1 / 2, c2 - s2 / 2)
  );
  return (overr * overc) / (s1 * s1 + s2 * s2 - overr * overc);
}

function clusterDetections(dets: number[][], iouThreshold: number): number[][] {
  const sorted = [...dets].sort((a, b) => b[3] - a[3]);
  const assignments = new Array<number>(sorted.length).fill(0);
  const clusters: number[][] = [];

  for (let i = 0; i < sorted.length; ++i) {
    if (assignments[i] === 0) {
      let r = 0.0;
      let c = 0.0;
      let s = 0.0;
      let q = 0.0;
      let n = 0;
      for (let j = i; j < sorted.length; ++j) {
        if (calculateIou(sorted[i], sorted[j]) > iouThreshold) {
          assignments[j] = 1;
          r += sorted[j][0];
          c += sorted[j][1];
          s += sorted[j][2];
          q += sorted[j][3];
          n += 1;
        }
      }
      clusters.push([r / n, c / n, s / n, q]);
    }
  }

  return clusters;
}

let classifier: Classifier | null = null;

function loadClassifier(): Classifier {
  if (!classifier) {
    const bytes = new Int8Array(Buffer.from(FACEFINDER_BASE64, "base64"));
    classifier = unpackCascade(bytes);
  }
  return classifier;
}

/**
 * Procura um rosto numa imagem (ex.: currículo que é uma figura só). Roda no
 * próprio servidor com o detector do pico: a imagem nunca vai para uma IA
 * externa (regra 3). Devolve null se não achar com segurança.
 */
export async function findFace(
  raw: ArrayLike<number>,
  width: number,
  height: number,
  channels: 1 | 3 | 4
): Promise<FaceDetection | null> {
  try {
    if (width < 48 || height < 48) return null;
    const rawBuffer = Buffer.from(raw as ArrayLike<number> as Uint8Array);
    if (rawBuffer.length < width * height * channels) return null;

    // Reduz imagens muito grandes para acelerar a busca de rosto sem perder precisão
    const maxDim = 1200;
    const scaleDown =
      Math.max(width, height) > maxDim
        ? maxDim / Math.max(width, height)
        : 1;
    const targetW = Math.max(48, Math.round(width * scaleDown));
    const targetH = Math.max(48, Math.round(height * scaleDown));

    let pipeline = sharp(rawBuffer, { raw: { width, height, channels } });
    if (channels === 4) {
      pipeline = pipeline.flatten({ background: "#ffffff" });
    }
    if (scaleDown < 1) {
      pipeline = pipeline.resize(targetW, targetH, { fit: "fill" });
    }

    const gray = await pipeline.greyscale().raw().toBuffer();

    const image: GrayImage = {
      pixels: new Uint8Array(gray),
      nrows: targetH,
      ncols: targetW,
      ldim: targetW,
    };
    const params: CascadeParams = {
      shiftfactor: 0.1,
      scalefactor: 1.1,
      minsize: Math.max(24, Math.round(Math.min(targetW, targetH) * 0.05)),
      maxsize: Math.round(Math.min(targetW, targetH) * 0.9),
    };

    const dets = runCascade(image, loadClassifier(), params);
    const clustered = clusterDetections(dets, 0.2);
    const best = bestFace(clustered, targetW, targetH);
    if (!best) return null;

    // Reverte coordenadas para a resolução original da imagem
    if (scaleDown < 1) {
      return {
        x: best.x / scaleDown,
        y: best.y / scaleDown,
        size: best.size / scaleDown,
        score: best.score,
      };
    }
    return best;
  } catch (error) {
    console.error("[foto] Erro ao detectar rosto na imagem:", error);
    return null;
  }
}
