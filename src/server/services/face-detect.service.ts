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

function findBestInGrayBuffer(
  gray: Buffer,
  targetW: number,
  targetH: number,
  minScore: number
): FaceDetection | null {
  const image: GrayImage = {
    pixels: new Uint8Array(gray),
    nrows: targetH,
    ncols: targetW,
    ldim: targetW,
  };
  const params: CascadeParams = {
    shiftfactor: 0.08,
    scalefactor: 1.08,
    minsize: Math.max(22, Math.round(Math.min(targetW, targetH) * 0.045)),
    maxsize: Math.round(Math.min(targetW, targetH) * 0.92),
  };

  const dets = runCascade(image, loadClassifier(), params);
  const clustered = clusterDetections(dets, 0.2);
  let best: FaceDetection | null = null;
  for (const [r, c, s, q] of clustered) {
    if (!(q >= minScore)) continue;
    if (s < 22 || s > Math.min(targetW, targetH)) continue;
    if (!best || q > best.score) best = { x: c, y: r, size: s, score: q };
  }
  return best;
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

    const buildBasePipeline = () => {
      let p = sharp(rawBuffer, { raw: { width, height, channels } });
      if (channels === 4) {
        p = p.flatten({ background: "#ffffff" });
      }
      return p;
    };

    let pipeline = buildBasePipeline();
    if (scaleDown < 1) {
      pipeline = pipeline.resize(targetW, targetH, { fit: "fill" });
    }

    const gray = await pipeline.greyscale().raw().toBuffer();
    let best =
      bestFace(
        clusterDetections(
          runCascade(
            {
              pixels: new Uint8Array(gray),
              nrows: targetH,
              ncols: targetW,
              ldim: targetW,
            },
            loadClassifier(),
            {
              shiftfactor: 0.1,
              scalefactor: 1.1,
              minsize: Math.max(24, Math.round(Math.min(targetW, targetH) * 0.05)),
              maxsize: Math.round(Math.min(targetW, targetH) * 0.9),
            }
          ),
          0.2
        ),
        targetW,
        targetH
      ) ?? null;

    // 2ª tentativa: normalização de contraste + varredura mais densa (óculos / sombra / foto interna)
    if (!best) {
      const normGray = await buildBasePipeline()
        .resize(targetW, targetH, { fit: "fill" })
        .normalise()
        .greyscale()
        .raw()
        .toBuffer();
      best = findBestInGrayBuffer(normGray, targetW, targetH, 3.2);
    }

    if (best) {
      if (scaleDown < 1) {
        return {
          x: best.x / scaleDown,
          y: best.y / scaleDown,
          size: best.size / scaleDown,
          score: best.score,
        };
      }
      return best;
    }

    // 3ª tentativa: em páginas inteiras de currículo, o rosto costuma ser pequeno no topo
    // ou levemente inclinado. Faz zoom na metade superior da imagem.
    if (height >= 500 && width >= 350) {
      const topH = Math.round(height * 0.52);
      const zoomScale = Math.min(1.6, 1100 / Math.max(width, topH));
      const zW = Math.max(64, Math.round(width * zoomScale));
      const zH = Math.max(64, Math.round(topH * zoomScale));
      const topGray = await buildBasePipeline()
        .extract({ left: 0, top: 0, width, height: topH })
        .resize(zW, zH, { fit: "fill" })
        .normalise()
        .greyscale()
        .raw()
        .toBuffer();
      const topBest = findBestInGrayBuffer(topGray, zW, zH, 3.0);
      if (topBest) {
        return {
          x: topBest.x / zoomScale,
          y: topBest.y / zoomScale,
          size: topBest.size / zoomScale,
          score: topBest.score,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("[foto] Erro ao detectar rosto na imagem:", error);
    return null;
  }
}

/**
 * Analisa se uma imagem grande é uma foto de retrato direta (pouco fundo branco)
 * ou uma página de currículo com fundo branco contendo um quadro de foto no topo.
 */
export async function detectPhotoBoxOrPortraitInPage(
  raw: ArrayLike<number>,
  width: number,
  height: number,
  channels: 1 | 3 | 4
): Promise<
  | { kind: "photo_box"; left: number; top: number; size: number }
  | { kind: "full_portrait" }
  | null
> {
  try {
    if (channels < 3 || width < 300 || height < 300) return null;
    const rawBuffer = Buffer.from(raw as ArrayLike<number> as Uint8Array);
    if (rawBuffer.length < width * height * channels) return null;

    const gridW = 160;
    const gridH = Math.max(60, Math.min(320, Math.round((height / width) * gridW)));
    const smallRgb = await sharp(rawBuffer, { raw: { width, height, channels } })
      .flatten({ background: "#ffffff" })
      .resize(gridW, gridH, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer();

    let whiteCount = 0;
    const totalPixels = gridW * gridH;
    const nonWhite = new Uint8Array(totalPixels);

    for (let i = 0; i < totalPixels; i++) {
      const r = smallRgb[i * 3];
      const g = smallRgb[i * 3 + 1];
      const b = smallRgb[i * 3 + 2];
      const isWhite = r > 228 && g > 228 && b > 228;
      if (isWhite) {
        whiteCount++;
      } else {
        nonWhite[i] = 1;
      }
    }

    const whiteRatio = whiteCount / totalPixels;
    const aspect = width / height;

    // Se menos de 42% da imagem é branco puro e a proporção é de retrato/quadrada,
    // a própria imagem já é a foto do candidato (ex.: selfie 3:4 de alta resolução).
    if (whiteRatio < 0.42 && aspect >= 0.45 && aspect <= 1.8) {
      return { kind: "full_portrait" };
    }

    // Em páginas de documento (fundo predominantemente claro), procura o quadro denso da foto
    // na metade superior da página (ex.: foto 3x4 ou quadrada com borda no topo esquerdo/direito).
    const searchH = Math.min(gridH, Math.round(gridH * 0.55));
    const dense = new Uint8Array(gridW * searchH);

    for (let y = 2; y < searchH - 2; y++) {
      for (let x = 2; x < gridW - 2; x++) {
        let sum = 0;
        for (let dy = -2; dy <= 2; dy++) {
          const rowOffset = (y + dy) * gridW;
          for (let dx = -2; dx <= 2; dx++) {
            sum += nonWhite[rowOffset + (x + dx)];
          }
        }
        // Linhas de texto têm bastante espaço branco ao redor (< 14/25); fotos são blocos sólidos (>= 18/25)
        if (sum >= 18) {
          dense[y * gridW + x] = 1;
        }
      }
    }

    const visited = new Uint8Array(gridW * searchH);
    let bestBox: {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
      area: number;
      score: number;
    } | null = null;

    for (let y = 2; y < searchH - 2; y++) {
      for (let x = 2; x < gridW - 2; x++) {
        const idx = y * gridW + x;
        if (!dense[idx] || visited[idx]) continue;

        // BFS para achar componente conectado denso
        const queue = [idx];
        visited[idx] = 1;
        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;
        let count = 0;

        while (queue.length > 0) {
          const cur = queue.pop()!;
          const cy = Math.floor(cur / gridW);
          const cx = cur % gridW;
          count++;
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          const neighbors = [
            cur - 1,
            cur + 1,
            cur - gridW,
            cur + gridW,
          ];
          for (const n of neighbors) {
            if (n >= 0 && n < gridW * searchH && dense[n] && !visited[n]) {
              visited[n] = 1;
              queue.push(n);
            }
          }
        }

        const bw = maxX - minX + 1;
        const bh = maxY - minY + 1;
        const boxArea = bw * bh;
        const fillRatio = count / boxArea;

        // Tamanho típico de foto 3x4 / avatar em página de currículo:
        // largura entre 8% e 42% da página, altura entre 6% e 38% da página
        const wPct = bw / gridW;
        const hPct = bh / gridH;
        const boxAspect = (bw / gridW * width) / (bh / gridH * height);

        if (
          wPct < 0.07 ||
          wPct > 0.44 ||
          hPct < 0.05 ||
          hPct > 0.42 ||
          boxAspect < 0.5 ||
          boxAspect > 1.65 ||
          fillRatio < 0.55
        ) {
          continue;
        }

        // Verifica variação de cor dentro do bloco (descarta tarjas retangulares chapadas de 1 cor só)
        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let rSq = 0;
        let gSq = 0;
        let bSq = 0;
        let colorTonePixels = 0;
        let sampleCount = 0;

        for (let sy = minY; sy <= maxY; sy++) {
          for (let sx = minX; sx <= maxX; sx++) {
            const pIdx = (sy * gridW + sx) * 3;
            const r = smallRgb[pIdx];
            const g = smallRgb[pIdx + 1];
            const b = smallRgb[pIdx + 2];
            rSum += r;
            gSum += g;
            bSum += b;
            rSq += r * r;
            gSq += g * g;
            bSq += b * b;
            if (Math.max(r, g, b) - Math.min(r, g, b) > 12) {
              colorTonePixels++;
            }
            sampleCount++;
          }
        }

        if (sampleCount < 20) continue;
        const rVar = rSq / sampleCount - (rSum / sampleCount) ** 2;
        const gVar = gSq / sampleCount - (gSum / sampleCount) ** 2;
        const bVar = bSq / sampleCount - (bSum / sampleCount) ** 2;
        const stdDev = Math.sqrt(Math.max(0, (rVar + gVar + bVar) / 3));

        // Uma foto real tem variação de luminosidade/textura (stdDev >= 16)
        if (stdDev < 16) continue;

        const colorBoost = colorTonePixels / sampleCount > 0.15 ? 1.3 : 1.0;
        const squareness = 1 - Math.min(0.5, Math.abs(1 - boxAspect) * 0.5);
        const score = boxArea * fillRatio * colorBoost * squareness;

        if (!bestBox || score > bestBox.score) {
          bestBox = { minX, maxX, minY, maxY, area: boxArea, score };
        }
      }
    }

    if (!bestBox) return null;

    const scaleX = width / gridW;
    const scaleY = height / gridH;
    const rawLeft = Math.max(0, Math.round((bestBox.minX - 1) * scaleX));
    const rawTop = Math.max(0, Math.round((bestBox.minY - 1) * scaleY));
    const rawRight = Math.min(width, Math.round((bestBox.maxX + 2) * scaleX));
    const rawBottom = Math.min(height, Math.round((bestBox.maxY + 2) * scaleY));
    const boxW = rawRight - rawLeft;
    const boxH = rawBottom - rawTop;
    const cx = rawLeft + boxW / 2;
    const cy = rawTop + boxH / 2;
    const size = Math.min(Math.max(boxW, boxH), width, height);
    const left = Math.min(Math.max(0, Math.round(cx - size / 2)), width - size);
    const top = Math.min(Math.max(0, Math.round(cy - size / 2)), height - size);

    return { kind: "photo_box", left, top, size };
  } catch (error) {
    console.error("[foto] Erro ao localizar quadro de foto na página:", error);
    return null;
  }
}
