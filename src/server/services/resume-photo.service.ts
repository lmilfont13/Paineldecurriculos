import "server-only";

import sharp from "sharp";
import { extractImages, type getDocumentProxy } from "unpdf";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  PHOTO_SIZE,
  photoStoragePath,
  pickPhotoIndex,
} from "@/server/models/photo.model";
import { updateApplicationPhoto } from "@/server/repositories/application.repository";
import { RESUMES_BUCKET } from "@/server/services/resume-storage.service";

type PdfDocument = Awaited<ReturnType<typeof getDocumentProxy>>;

/** Validade das URLs assinadas das fotos nas listagens. */
const PHOTO_URL_TTL_SECONDS = 60 * 60;

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
    const images = await extractImages(pdf, 1);
    const index = pickPhotoIndex(images);
    if (index === null) {
      if (target.currentPath) await updateApplicationPhoto(target.applicationId, null);
      return false;
    }

    const img = images[index];
    const jpeg = await sharp(Buffer.from(img.data), {
      raw: { width: img.width, height: img.height, channels: img.channels as 3 | 4 },
    })
      .resize(PHOTO_SIZE, PHOTO_SIZE, { fit: "cover", position: sharp.strategy.attention })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 82 })
      .toBuffer();

    const path = photoStoragePath(target.companyId, target.applicationId);
    const { error } = await createAdminClient()
      .storage.from(RESUMES_BUCKET)
      .upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
    if (error) throw new Error(error.message);

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
  const list = paths.filter(Boolean);
  if (list.length === 0) return;
  try {
    await createAdminClient().storage.from(RESUMES_BUCKET).remove(list);
  } catch (error) {
    console.error("[foto] Falha ao remover fotos:", error);
  }
}
