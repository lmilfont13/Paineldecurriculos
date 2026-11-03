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
      allowedMimeTypes: ["application/pdf", "image/jpeg"],
    });
    if (bucketError) throw new Error(bucketError.message);
    ({ error } = await upload());
  }
  if (error) throw new Error(error.message);
}

/**
 * Recorta a foto do currículo (se houver) e guarda no bucket privado. Nunca
 * lança: foto é detalhe, não pode atrapalhar a análise. A IA não recebe a
 * imagem — só o texto (regra 3).
 */
export async function captureResumePhoto(
  pdf: PdfDocument,
  target: { companyId: string; applicationId: string; currentPath: string | null }
): Promise<boolean> {
  try {
    let images = await extractImages(pdf, 1);
    let index = pickPhotoIndex(images);
    if (index === null && pdf.numPages > 1) {
      images = await extractImages(pdf, 2);
      index = pickPhotoIndex(images);
    }

    // Avatar (PHOTO_SIZE) e versão ampliada (até PHOTO_LARGE_MAX, sem passar
    // do original) saem do mesmo recorte, para a foto aberta bater com a da lista.
    let photo: { small: Buffer; large: Buffer } | null = null;
    if (index !== null) {
      const img = images[index];
      const source = () =>
        sharp(Buffer.from(img.data), {
          raw: { width: img.width, height: img.height, channels: img.channels as 3 | 4 },
        });
      const largeSide = largePhotoSide(Math.min(img.width, img.height));
      photo = {
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
    } else {
      // Currículo que é uma figura só (página inteira): procura o rosto na imagem.
      const pageIndex = pickPageImageIndex(images);
      if (pageIndex !== null) {
        const img = images[pageIndex];
        const channels = img.channels as 3 | 4;
        const face = await findFace(img.data, img.width, img.height, channels);
        if (face) {
          const { left, top, size } = faceCropRegion(face, img.width, img.height);
          const crop = () =>
            sharp(Buffer.from(img.data), {
              raw: { width: img.width, height: img.height, channels },
            }).extract({ left, top, width: size, height: size });
          const largeSide = largePhotoSide(size);
          photo = {
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
