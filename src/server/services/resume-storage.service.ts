import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  ALL_RESUME_MIMES,
  MAX_RESUME_BYTES,
  type ResumeUploadTarget,
} from "@/server/models/application.model";

export const RESUMES_BUCKET = "resumes";

/**
 * Garante que o bucket aceita todos os tipos de currículo (PDF + imagens).
 * Chamada na primeira vez que o upload de imagem precisar — sem isso o bucket
 * pode rejeitar JPEG/PNG se tiver sido criado só com PDF.
 */
async function ensureBucketMimes(): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.storage.updateBucket(RESUMES_BUCKET, {
    public: false,
    fileSizeLimit: "5MB",
    allowedMimeTypes: ALL_RESUME_MIMES,
  });
  if (error && !/not found/i.test(error.message)) {
    console.error("[resumes] Falha ao atualizar MIME types do bucket:", error.message);
  }
}

let bucketMimesUpdated = false;

/**
 * Upload direto do navegador para o Storage (regra 5).
 *
 * O currículo (PDF ou imagem) não passa pela server action: a Vercel recusa
 * corpos acima de ~4,5 MB antes do código rodar. O servidor só emite uma URL
 * assinada para um caminho que ele mesmo escolheu e, no envio da candidatura,
 * confere que o arquivo existe e cabe no limite.
 *
 * @param ext — extensão do arquivo (.pdf, .jpg, .png, .webp). Default: ".pdf".
 */
export async function createResumeUploadTarget(
  prefix: string,
  ext = ".pdf"
): Promise<ResumeUploadTarget | null> {
  // Se é imagem, garante que o bucket aceita o MIME type
  if (ext !== ".pdf" && !bucketMimesUpdated) {
    await ensureBucketMimes();
    bucketMimesUpdated = true;
  }

  const path = `${prefix}${crypto.randomUUID()}${ext}`;
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(RESUMES_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[resumes] Falha ao criar URL de upload:", error?.message);
    return null;
  }
  return { path: data.path, token: data.token };
}

/** Confere que o currículo enviado pelo navegador está no bucket e cabe em 5 MB. */
export async function verifyUploadedResume(
  path: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(RESUMES_BUCKET)
    .info(path);
  if (error || !data) {
    return {
      ok: false,
      error: "Não recebemos o seu currículo. Envie o arquivo novamente.",
    };
  }
  if (typeof data.size === "number" && data.size > MAX_RESUME_BYTES) {
    await supabase.storage.from(RESUMES_BUCKET).remove([path]);
    return { ok: false, error: "O currículo deve ter no máximo 5 MB." };
  }
  return { ok: true };
}
