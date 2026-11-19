import "server-only";

import zlib from "node:zlib";
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
import {
  detectPhotoBoxOrPortraitInPage,
  findFace,
} from "@/server/services/face-detect.service";
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
 * Desfaz filtros de predição PNG (Predictor 10..15 do PDF FlateDecode), onde
 * cada linha começa com 1 byte de filtro (0=None, 1=Sub, 2=Up, 3=Average, 4=Paeth).
 */
function unfilterPngPredictorRows(
  src: Buffer,
  width: number,
  height: number,
  channels: number
): Uint8Array | null {
  const rowBytes = width * channels;
  const stride = rowBytes + 1;
  if (src.length < stride * height) return null;

  const out = new Uint8Array(rowBytes * height);
  for (let y = 0; y < height; y++) {
    const filterType = src[y * stride];
    const srcRowStart = y * stride + 1;
    const dstRowStart = y * rowBytes;
    const prevRowStart = (y - 1) * rowBytes;

    for (let x = 0; x < rowBytes; x++) {
      const rawByte = src[srcRowStart + x];
      const left = x >= channels ? out[dstRowStart + x - channels] : 0;
      const up = y > 0 ? out[prevRowStart + x] : 0;
      const upLeft = y > 0 && x >= channels ? out[prevRowStart + x - channels] : 0;

      let val = rawByte;
      if (filterType === 1) {
        val = (rawByte + left) & 0xff;
      } else if (filterType === 2) {
        val = (rawByte + up) & 0xff;
      } else if (filterType === 3) {
        val = (rawByte + ((left + up) >> 1)) & 0xff;
      } else if (filterType === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const pr = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        val = (rawByte + pr) & 0xff;
      }
      out[dstRowStart + x] = val;
    }
  }
  return out;
}

/**
 * Extrai imagens embutidas diretamente dos bytes brutos do PDF:
 * 1) Streams JPEG (/DCTDecode) completos — buscando o último EOI (FF D9) antes do
 *    `endstream` para não truncar fotos de celular que possuem miniatura EXIF no cabeçalho;
 * 2) Streams PNG brutos (89 50 4E 47 ... IEND);
 * 3) Objetos `/Subtype /Image` comprimidos com `/FlateDecode` (muito usados por
 *    Canva, Chrome PDF, wkhtmltopdf, Word e geradores de currículo online).
 */
async function extractEmbeddedJpegsAsRaw(pdfBytes: Uint8Array): Promise<RawPdfImage[]> {
  const results: RawPdfImage[] = [];
  const len = pdfBytes.length;
  const buf = Buffer.from(pdfBytes.buffer, pdfBytes.byteOffset, pdfBytes.byteLength);

  // 1) Procura JPEGs brutos (FF D8 FF ... FF D9), priorizando o fechamento junto ao endstream
  let pos = 0;
  const endstreamToken = Buffer.from("endstream", "latin1");

  while (pos < len - 16 && results.length < 10) {
    if (pdfBytes[pos] === 0xff && pdfBytes[pos + 1] === 0xd8 && pdfBytes[pos + 2] === 0xff) {
      const maxSearchEnd = Math.min(len, pos + 4 * 1024 * 1024);
      const nextEndstream = buf.indexOf(endstreamToken, pos + 64);
      const searchLimit =
        nextEndstream !== -1 && nextEndstream < maxSearchEnd
          ? nextEndstream
          : maxSearchEnd;

      const eoiCandidates: number[] = [];
      for (let j = pos + 4; j < searchLimit - 1; j++) {
        if (pdfBytes[j] === 0xff && pdfBytes[j + 1] === 0xd9) {
          const candidateEnd = j + 2;
          if (candidateEnd - pos > 1024) {
            eoiCandidates.push(candidateEnd);
          }
        }
      }

      // Testa do último FF D9 antes do endstream para trás (evita parar no FF D9 da miniatura EXIF!)
      let decoded = false;
      for (let k = eoiCandidates.length - 1; k >= Math.max(0, eoiCandidates.length - 4); k--) {
        const end = eoiCandidates[k];
        try {
          const candidate = buf.subarray(pos, end);
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
            decoded = true;
            break;
          }
        } catch {
          // Tenta próximo candidato de EOI
        }
      }

      if (decoded) continue;
    }
    pos++;
  }

  // 2) Procura PNGs brutos embutidos (89 50 4E 47 0D 0A 1A 0A ... IEND)
  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const iendSig = Buffer.from("IEND", "latin1");
  let pngPos = buf.indexOf(pngSig, 0);
  while (pngPos !== -1 && results.length < 12) {
    const iendPos = buf.indexOf(iendSig, pngPos + 32);
    if (iendPos !== -1 && iendPos - pngPos < 4 * 1024 * 1024) {
      const pngEnd = Math.min(len, iendPos + 8);
      try {
        const candidate = buf.subarray(pngPos, pngEnd);
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
        }
      } catch {
        // Ignora PNG inválido
      }
      pngPos = buf.indexOf(pngSig, pngEnd);
    } else {
      break;
    }
  }

  // 3) Procura XObjects `/Subtype /Image` comprimidos com `/FlateDecode`
  try {
    const latin = buf.toString("latin1");
    const imgRegex = /<<([\s\S]{10,600}?\/Subtype\s*\/Image[\s\S]{0,600}?)>>[\r\n\s]*stream\r?\n/g;
    let match: RegExpExecArray | null;

    while ((match = imgRegex.exec(latin)) !== null && results.length < 14) {
      const dict = match[1];
      if (!/FlateDecode|\/Fl\b/.test(dict)) continue;

      const wMatch = dict.match(/\/Width\s+(\d+)/);
      const hMatch = dict.match(/\/Height\s+(\d+)/);
      const bpcMatch = dict.match(/\/BitsPerComponent\s+(\d+)/);
      const width = wMatch ? Number(wMatch[1]) : 0;
      const height = hMatch ? Number(hMatch[1]) : 0;
      const bpc = bpcMatch ? Number(bpcMatch[1]) : 8;

      if (width < 48 || height < 48 || width > 4500 || height > 4500 || bpc !== 8) continue;

      const streamStart = match.index + match[0].length;
      const streamEnd = buf.indexOf(endstreamToken, streamStart);
      if (streamEnd === -1 || streamEnd - streamStart > 6 * 1024 * 1024) continue;

      let endOffset = streamEnd;
      if (buf[endOffset - 1] === 0x0a) endOffset--;
      if (buf[endOffset - 1] === 0x0d) endOffset--;
      const compressed = buf.subarray(streamStart, endOffset);

      let inflated: Buffer | null = null;
      try {
        inflated = zlib.inflateSync(compressed);
      } catch {
        try {
          inflated = zlib.inflateRawSync(compressed);
        } catch {
          inflated = null;
        }
      }
      if (!inflated || inflated.length === 0) continue;

      // Caso 3a: stream FlateDecode que encapsulava um JPEG (/Filter [/FlateDecode /DCTDecode]) ou PNG
      if (
        (inflated[0] === 0xff && inflated[1] === 0xd8 && inflated[2] === 0xff) ||
        (inflated[0] === 0x89 && inflated[1] === 0x50 && inflated[2] === 0x4e && inflated[3] === 0x47)
      ) {
        try {
          const { data, info } = await sharp(inflated)
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
            continue;
          }
        } catch {
          // Segue para tentativa de pixels brutos
        }
      }

      // Caso 3b: pixels brutos RGB (3 canais) ou RGBA (4 canais), com ou sem PNG Predictor (10..15)
      const pixelCount = width * height;
      if (inflated.length === pixelCount * 3 || inflated.length === pixelCount * 4) {
        const channels = inflated.length === pixelCount * 4 ? 4 : 3;
        results.push({
          data: new Uint8Array(inflated.buffer, inflated.byteOffset, inflated.byteLength),
          width,
          height,
          channels,
        });
      } else if (inflated.length === (width * 3 + 1) * height) {
        const unfiltered = unfilterPngPredictorRows(inflated, width, height, 3);
        if (unfiltered) {
          results.push({ data: unfiltered, width, height, channels: 3 });
        }
      } else if (inflated.length === (width * 4 + 1) * height) {
        const unfiltered = unfilterPngPredictorRows(inflated, width, height, 4);
        if (unfiltered) {
          results.push({ data: unfiltered, width, height, channels: 4 });
        }
      }
    }
  } catch {
    // Ignora falha no parser de streams FlateDecode
  }

  return results;
}

/**
 * Extrai imagens de uma página do PDF combinando `extractImages` do unpdf
 * com uma varredura direta dos objetos de imagem (`page.objs` / `page.commonObjs`),
 * capturando imagens pintadas via `paintImageXObjectRepeat`, inline images ou patterns.
 */
async function extractPageRawImages(pdf: PdfDocument, pageNum: number): Promise<RawPdfImage[]> {
  const results: RawPdfImage[] = [];
  const seenKeys = new Set<string>();

  try {
    const stdImages = (await extractImages(pdf, pageNum)) as (RawPdfImage & { key?: string })[];
    for (const img of stdImages) {
      if (img?.key) seenKeys.add(img.key);
      results.push(img);
    }
  } catch {
    // Segue para inspeção manual da operatorList
  }

  try {
    const page = await pdf.getPage(pageNum);
    const opList = await page.getOperatorList();
    for (let i = 0; i < opList.argsArray.length; i++) {
      const args = opList.argsArray[i];
      if (!Array.isArray(args) || args.length === 0) continue;

      const firstArg = args[0];
      // Inline image object já decodificado na operatorList
      if (
        firstArg &&
        typeof firstArg === "object" &&
        "width" in firstArg &&
        "height" in firstArg &&
        "data" in firstArg
      ) {
        const inlineImg = firstArg as { width: number; height: number; data: Uint8Array; kind?: number };
        if (inlineImg.width >= 48 && inlineImg.height >= 48 && inlineImg.data) {
          const ch = Math.round(inlineImg.data.length / (inlineImg.width * inlineImg.height));
          if (ch === 3 || ch === 4) {
            results.push({
              data: inlineImg.data,
              width: inlineImg.width,
              height: inlineImg.height,
              channels: ch,
            });
          }
        }
        continue;
      }

      if (typeof firstArg === "string" && (firstArg.startsWith("img_") || firstArg.startsWith("g_"))) {
        if (seenKeys.has(firstArg)) continue;
        seenKeys.add(firstArg);

        const pool = firstArg.startsWith("g_") ? page.commonObjs : page.objs;
        const resolved = await new Promise<any>((resolve) => {
          let settled = false;
          const timer = setTimeout(() => {
            if (!settled) {
              settled = true;
              resolve(null);
            }
          }, 500);
          try {
            pool.get(firstArg, (obj: any) => {
              if (!settled) {
                settled = true;
                clearTimeout(timer);
                resolve(obj);
              }
            });
          } catch {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              resolve(null);
            }
          }
        });

        if (resolved && resolved.data && resolved.width >= 48 && resolved.height >= 48) {
          const pixelCount = resolved.width * resolved.height;
          const ch = Math.round(resolved.data.length / pixelCount);
          if ((ch === 3 || ch === 4) && resolved.data.length >= pixelCount * ch) {
            results.push({
              data: resolved.data,
              width: resolved.width,
              height: resolved.height,
              channels: ch,
            });
          }
        }
      }
    }
  } catch {
    // Ignora erro de introspecção extra
  }

  return results;
}

async function cropFromRegion(
  rawBuf: Buffer,
  width: number,
  height: number,
  channels: 1 | 3 | 4,
  region: { left: number; top: number; size: number }
): Promise<{ small: Buffer; large: Buffer }> {
  const { left, top, size } = region;
  const crop = () =>
    sharp(rawBuf, { raw: { width, height, channels } }).extract({
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

async function cropFullImageAsPortrait(
  rawBuf: Buffer,
  width: number,
  height: number,
  channels: 1 | 3 | 4
): Promise<{ small: Buffer; large: Buffer }> {
  const source = () =>
    sharp(rawBuf, {
      raw: { width, height, channels },
    });
  const largeSide = largePhotoSide(Math.min(width, height));
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
      return cropFromRegion(
        rawBuf,
        img.width,
        img.height,
        channels,
        faceCropRegion(face, img.width, img.height)
      );
    }

    return cropFullImageAsPortrait(rawBuf, img.width, img.height, channels);
  }

  // Currículo que é uma figura grande (ou selfie 3:4 de alta resolução >= 1400px):
  // 1) Procura o rosto na imagem;
  // 2) Se o detector não achar rosto (ex.: óculos com reflexo, rosto inclinado), verifica
  //    se a própria imagem é uma foto de retrato (pouco fundo branco) ou localiza o
  //    quadro denso da foto 3x4 no topo da página branca do currículo.
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
      return cropFromRegion(
        rawBuf,
        img.width,
        img.height,
        channels,
        faceCropRegion(face, img.width, img.height)
      );
    }

    const fallback = await detectPhotoBoxOrPortraitInPage(
      rawBuf,
      img.width,
      img.height,
      channels
    );
    if (fallback?.kind === "full_portrait") {
      return cropFullImageAsPortrait(rawBuf, img.width, img.height, channels);
    }
    if (fallback?.kind === "photo_box") {
      return cropFromRegion(rawBuf, img.width, img.height, channels, fallback);
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
    const page1Images = await extractPageRawImages(pdf, 1);
    let photo = await buildPhotoPairFromRawImages(page1Images);

    if (!photo && pdf.numPages > 1) {
      const page2Images = await extractPageRawImages(pdf, 2);
      photo = await buildPhotoPairFromRawImages(page2Images);
    }

    // Fallback: extrai JPEGs (sem truncar no EXIF), PNGs e XObjects FlateDecode dos bytes do PDF
    if (!photo && rawPdfBytes && rawPdfBytes.length > 0) {
      const embeddedImages = await extractEmbeddedJpegsAsRaw(rawPdfBytes);
      if (embeddedImages.length > 0) {
        photo = await buildPhotoPairFromRawImages(embeddedImages);
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
