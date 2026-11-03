/**
 * Foto do currículo: escolha da imagem e caminho no Storage. Funções puras —
 * testadas em photo.model.test.ts. A foto é só referência visual para o
 * gestor; a IA nunca a recebe (regra 3).
 */

export type PdfImageInfo = { width: number; height: number; channels: number };

/** Lado do recorte salvo (px). Pequeno de propósito: é só um avatar. */
export const PHOTO_SIZE = 192;

/**
 * Escolhe a imagem com cara de foto de rosto entre as da página:
 * colorida, de tamanho razoável, retrato ou quadrada. Descarta ícones
 * minúsculos, faixas decorativas, máscaras (1 canal) e a página inteira
 * escaneada (imagem enorme com proporção de A4).
 *
 * Razão ampliada (0.3–2.5): CVs brasileiros usam fotos portrait estreitas,
 * ou quadradas, ou levemente landscape — o intervalo anterior (0.55–1.25)
 * descartava muitas.
 */
export function pickPhotoIndex(images: PdfImageInfo[]): number | null {
  let best: { index: number; area: number } | null = null;
  images.forEach((img, index) => {
    if (img.channels < 3) return;
    if (img.width < 48 || img.height < 48) return;
    const ratio = img.width / img.height;
    if (ratio < 0.3 || ratio > 2.5) return;
    // Página inteira escaneada: grande E proporção A4
    const looksLikeScannedPage =
      img.height >= 1400 && ratio > 0.65 && ratio < 0.78;
    if (looksLikeScannedPage) return;
    // Imagem minúscula ou gigantesca demais para ser uma foto de perfil
    if (img.width > 4000 || img.height > 4000) return;
    const area = img.width * img.height;
    if (!best || area > best.area) best = { index, area };
  });
  return best ? (best as { index: number }).index : null;
}

/** Caminho da foto no bucket privado de currículos. */
export function photoStoragePath(companyId: string, applicationId: string): string {
  return `photos/${companyId}/${applicationId}.jpg`;
}

/**
 * Lado máximo da versão ampliada (px), aberta ao clicar na foto. Nunca
 * amplia além do original do PDF — só reduz se a foto for maior que isso.
 */
export const PHOTO_LARGE_MAX = 800;

/** Caminho da versão ampliada, derivado do avatar: `x.jpg` → `x-lg.jpg`. */
export function photoLargePath(photoPath: string): string {
  return photoPath.replace(/\.jpg$/, "-lg.jpg");
}

/** Lado da versão ampliada para um recorte quadrado de `side` px. */
export function largePhotoSide(side: number): number {
  return Math.max(1, Math.min(Math.round(side), PHOTO_LARGE_MAX));
}

/**
 * Junta às fotos da lista as suas versões ampliadas, para que excluir uma
 * candidatura ou conta (LGPD) apague as duas. Outros caminhos passam iguais.
 */
export function withLargePhotoPaths(paths: string[]): string[] {
  const out = new Set<string>();
  for (const p of paths) {
    if (!p) continue;
    out.add(p);
    if (p.startsWith("photos/") && p.endsWith(".jpg") && !p.endsWith("-lg.jpg")) {
      out.add(photoLargePath(p));
    }
  }
  return [...out];
}

/** Rosto achado numa imagem: centro (x, y) e diâmetro aproximado, em pixels. */
export type FaceDetection = { x: number; y: number; size: number; score: number };

/** Confiança mínima do detector; abaixo disso é mais provável ser ruído. */
export const FACE_MIN_SCORE = 5;

/**
 * Escolhe a melhor detecção ([linha, coluna, tamanho, confiança], formato do
 * pico.js): a de maior confiança acima do mínimo e com tamanho plausível.
 */
export function bestFace(dets: number[][], width: number, height: number): FaceDetection | null {
  let best: FaceDetection | null = null;
  for (const [r, c, s, q] of dets) {
    if (!(q >= FACE_MIN_SCORE)) continue;
    if (s < 24 || s > Math.min(width, height)) continue;
    if (!best || q > best.score) best = { x: c, y: r, size: s, score: q };
  }
  return best;
}

/**
 * Recorte quadrado em volta do rosto, com folga para cabelo e ombros, sempre
 * dentro da imagem.
 */
export function faceCropRegion(
  face: FaceDetection,
  width: number,
  height: number
): { left: number; top: number; size: number } {
  const size = Math.min(Math.round(face.size * 1.5), width, height);
  const left = Math.min(Math.max(Math.round(face.x - size / 2), 0), width - size);
  const top = Math.min(Math.max(Math.round(face.y - size / 2), 0), height - size);
  return { left, top, size };
}

/**
 * Para currículo que é uma imagem só (página inteira), devolve o índice da
 * maior imagem colorida, onde vale procurar um rosto.
 */
export function pickPageImageIndex(images: PdfImageInfo[]): number | null {
  let best: { index: number; area: number } | null = null;
  images.forEach((img, index) => {
    if (img.channels < 3 || img.width < 400 || img.height < 400) return;
    if (img.width > 6000 || img.height > 6000) return;
    const area = img.width * img.height;
    if (!best || area > best.area) best = { index, area };
  });
  return best ? (best as { index: number }).index : null;
}
