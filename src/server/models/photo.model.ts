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
