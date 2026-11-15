import "server-only";

import sharp from "sharp";
import { extractImages, type getDocumentProxy } from "unpdf";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  PHOTO_SIZE,
  faceCropRegion,
  largePhotoSide,
  photoLargePath,
  photoStoragePath,
  pickPageImageIndex,
  pickPhotoIndex,
  withLargePhotoPaths,
} from "@/server/models/photo.model";
import { findFace } from "@/server/services/face-detect.service";
import { updateApplicationPhoto } from "@/server/repositories/application.repository";
import { RESUMES_BUCKET } from "@/server/services/resume-storage.service";

type PdfDocument = Awaited<ReturnType<typeof getDocumentProxy>>;

type RawPdfImage = {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
  channels: number;
};

/** Validade das URLs assinadas das fotos nas listagens. */
const PHOTO_URL_TTL_SECONDS = 60 * 60;

/** Sobe um JPEG para o bucket privado (libera JPEG no bucket se preciso). */
async function uploadPhoto(path: string, jpeg: Buffer): Promise<void> {
  const storage = createAdminClient().storage;
  const upload = () =>
    storage.from(RESUMES_BUCKET).upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
  let { error } = await upload();
  if (error && /mime type/i.test(error.message)) {
    // O bucket nasceu só com PDF (seed). Libera JPEG (continua privado) e repete.
    const { error: bucketError } = await storage.updateBucket(RESUMES_BUCKET, {
      public: false,
      fileSizeLimit: "5MB",
      allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
    });
    if (bucketError) throw new Error(bucketError.message);
    ({ error } = await upload());
  }
  if (error) throw new Error(error.message);
}

/** Filtra imagens brutas válidas cujo tamanho de buffer bate com width * height * channels. */
function filterValidRawImages(images: RawPdfImage[]): RawPdfImage[] {
  return images.filter(
    (img) =>
      img &&
      img.width >= 48 &&
      img.height >= 48 &&
      (img.channels === 1 || img.channels === 3 || img.channels === 4) &&
      img.data &&
      img.data.length >= img.width * img.height * img.channels
  );
}

/**
 * Extrai streams JPEG brutos embutidos nos bytes de um PDF (muito comum em
 * currículos gerados pelo Canva, Word ou Catho onde `extractImages` do unpdf
 * devolve lista vazia) e os converte em buffers raw para o pipeline de foto.
 */
async function extractEmbeddedJpegsAsRaw(pdfBytes: Uint8Array): Promise<RawPdfImage[]> {
  const results: RawPdfImage[] = [];
  const len = pdfBytes.length;
  let pos = 0;

  while (pos < len - 10 && results.length < 8) {
    if (pdfBytes[pos] === 0xff && pdfBytes[pos + 1] === 0xd8 && pdfBytes[pos + 2] === 0xff) {
      let end = -1;
      for (let j = pos + 4; j < len - 1; j++) {
        if (pdfBytes[j] === 0xff && pdfBytes[j + 1] === 0xd9) {
          end = j + 2;
          if (end - pos > 2048) break;
        }
      }
      if (end > pos + 1024) {
        try {
          const candidate = Buffer.from(pdfBytes.subarray(pos, end));
          const { data, info } = await sharp(candidate)
            .rotate()
            .toColorspace("srgb")
            .raw()
            .toBuffer({ resolveWithObject: true });
          if (info.width >= 48 && info.height >= 48 && (info.channels === 3 || info.channels === 4)) {
            results.push({
              data: new Uint8Array(data),
              width: info.width,
              height: info.height,
              channels: info.channels,
            });
            pos = end;
            continue;
          }
        } catch {
          // Não era um JPEG completo/válido
        }
      }
    }
    pos++;
  }

  return results;
}

async function buildPhotoPairFromRawImages(
  rawImages: RawPdfImage[]
): Promise<{ small: Buffer; large: Buffer } | null> {
  const images = filterValidRawImages(rawImages);
  if (images.length === 0) return null;

  const index = pickPhotoIndex(images);
  if (index !== null) {
    const img = images[index];
    const channels = img.channels as 1 | 3 | 4;
    const rawBuf = Buffer.from(
      img.data.buffer,
      img.data.byteOffset,
      img.width * img.height * channels
    );
    // Se houver um rosto detectável dentro da foto, centraliza nele; senão usa attention crop
    const face = await findFace(rawBuf, img.width, img.height, channels);
    if (face) {
      const { left, top, size } = faceCropRegion(face, img.width, img.height);
      const crop = () =>
        sharp(rawBuf, { raw: { width: img.width, height: img.height, channels } }).extract({
          left,
          top,
          width: size,
          height: size,
        });
      const largeSide = largePhotoSide(size);
      return {
        small: await crop()
          .resize(PHOTO_SIZE, PHOTO_SIZE)
          .flatten({ background: "#ffffff" })
          .jpeg({ quality: 82 })
          .toBuffer(),
        large: await crop()
          .resize(largeSide, largeSide)
          .flatten({ background: "#ffffff" })
          .jpeg({ quality: 90 })
          .toBuffer(),
      };
    }

    const source = () =>
      sharp(rawBuf, {
        raw: { width: img.width, height: img.height, channels },
      });
    const largeSide = largePhotoSide(Math.min(img.width, img.height));
    return {
      small: await source()
        .resize(PHOTO_SIZE, PHOTO_SIZE, { fit: "cover", position: sharp.strategy.attention })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 82 })
        .toBuffer(),
      large: await source()
        .resize(largeSide, largeSide, { fit: "cover", position: sharp.strategy.attention })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 90 })
        .toBuffer(),
    };
  }

  // Currículo que é uma figura só (página inteira): procura o rosto na imagem.
  const pageIndex = pickPageImageIndex(images);
  if (pageIndex !== null) {
    const img = images[pageIndex];
    const channels = img.channels as 1 | 3 | 4;
    const rawBuf = Buffer.from(
      img.data.buffer,
      img.data.byteOffset,
      img.width * img.height * channels
    );
    const face = await findFace(rawBuf, img.width, img.height, channels);
    if (face) {
      const { left, top, size } = faceCropRegion(face, img.width, img.height);
      const crop = () =>
        sharp(rawBuf, {
          raw: { width: img.width, height: img.height, channels },
        }).extract({ left, top, width: size, height: size });
      const largeSide = largePhotoSide(size);
      return {
        small: await crop()
          .resize(PHOTO_SIZE, PHOTO_SIZE)
          .flatten({ background: "#ffffff" })
          .jpeg({ quality: 82 })
          .toBuffer(),
        large: await crop()
          .resize(largeSide, largeSide)
          .flatten({ background: "#ffffff" })
          .jpeg({ quality: 90 })
          .toBuffer(),
      };
    }
  }

  return null;
}

/**
 * Recorta a foto de um currículo enviado diretamente como imagem (.jpg, .png, .webp).
 * Nunca lança exceção.
 */
export async function captureResumePhotoFromImage(
  imageBytes: Uint8Array,
  target: { companyId: string; applicationId: string; currentPath: string | null }
): Promise<boolean> {
  try {
    const { data, info } = await sharp(Buffer.from(imageBytes))
      .rotate()
      .toColorspace("srgb")
      .raw()
      .toBuffer({ resolveWithObject: true });

    const photo = await buildPhotoPairFromRawImages([
      {
        data: new Uint8Array(data),
        width: info.width,
        height: info.height,
        channels: info.channels,
      },
    ]);

    if (!photo) return false;

    const path = photoStoragePath(target.companyId, target.applicationId);
    await uploadPhoto(path, photo.small);
    await uploadPhoto(photoLargePath(path), photo.large);
    await updateApplicationPhoto(target.applicationId, path);
    return true;
  } catch (error) {
    console.error("[foto] Não foi possível extrair foto da imagem do currículo:", error);
    return false;
  }
}

/**
 * Recorta a foto do currículo em PDF (se houver) e guarda no bucket privado.
 * Nunca lança: foto é detalhe, não pode atrapalhar a análise. A IA não recebe a
 * imagem — só o texto (regra 3).
 */
export async function captureResumePhoto(
  pdf: PdfDocument,
  target: { companyId: string; applicationId: string; currentPath: string | null },
  rawPdfBytes?: Uint8Array
): Promise<boolean> {
  try {
    let page1Images: RawPdfImage[] = [];
    try {
      page1Images = (await extractImages(pdf, 1)) as RawPdfImage[];
    } catch {
      page1Images = [];
    }

    let photo = await buildPhotoPairFromRawImages(page1Images);

    if (!photo && pdf.numPages > 1) {
      try {
        const page2Images = (await extractImages(pdf, 2)) as RawPdfImage[];
        photo = await buildPhotoPairFromRawImages(page2Images);
      } catch {
        // Ignora erro na página 2
      }
    }

    // Fallback: se o PDF tinha JPEGs embutidos que o extractImages do unpdf não retornou
    if (!photo && rawPdfBytes && rawPdfBytes.length > 0) {
      const embeddedJpegs = await extractEmbeddedJpegsAsRaw(rawPdfBytes);
      if (embeddedJpegs.length > 0) {
        photo = await buildPhotoPairFromRawImages(embeddedJpegs);
      }
    }

    if (!photo) {
      if (target.currentPath) await updateApplicationPhoto(target.applicationId, null);
      return false;
    }

    const path = photoStoragePath(target.companyId, target.applicationId);
    await uploadPhoto(path, photo.small);
    await uploadPhoto(photoLargePath(path), photo.large);

    await updateApplicationPhoto(target.applicationId, path);
    return true;
  } catch (error) {
    console.error("[foto] Não foi possível recortar a foto do currículo:", error);
    return false;
  }
}

/**
 * Adiciona `photoUrl` (URL assinada, 1 h) a cada item. Uma chamada ao
 * Storage para a lista inteira. Sem foto ou com erro → null (iniciais).
 */
export async function withPhotoUrls<T extends { photoPath?: string | null }>(
  items: T[]
): Promise<(T & { photoUrl: string | null })[]> {
  const paths = [...new Set(items.map((i) => i.photoPath).filter((p): p is string => !!p))];
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    try {
      const { data } = await createAdminClient()
        .storage.from(RESUMES_BUCKET)
        .createSignedUrls(paths, PHOTO_URL_TTL_SECONDS);
      for (const row of data ?? []) {
        if (row.path && row.signedUrl) urls.set(row.path, row.signedUrl);
      }
    } catch (error) {
      console.error("[foto] Falha ao assinar URLs:", error);
    }
  }
  return items.map((item) => ({
    ...item,
    photoUrl: item.photoPath ? (urls.get(item.photoPath) ?? null) : null,
  }));
}

/** Remove fotos do Storage (exclusão de candidatura/conta). Nunca lança. */
export async function removeResumePhotos(paths: string[]): Promise<void> {
  const list = withLargePhotoPaths(paths);
  if (list.length === 0) return;
  try {
    await createAdminClient().storage.from(RESUMES_BUCKET).remove(list);
  } catch (error) {
    console.error("[foto] Falha ao remover fotos:", error);
  }
}

/**
 * URL assinada (1 h) da versão ampliada da foto. null se ela ainda não
 * existe (foto recortada antes da versão ampliada) ou se o Storage falhar.
 */
export async function signLargePhotoUrl(photoPath: string): Promise<string | null> {
  try {
    const { data, error } = await createAdminClient()
      .storage.from(RESUMES_BUCKET)
      .createSignedUrl(photoLargePath(photoPath), PHOTO_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}
