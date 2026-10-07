import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  MAX_RESUME_BYTES,
  type ResumeUploadTarget,
} from "@/server/models/application.model";

export const RESUMES_BUCKET = "resumes";

/**
 * Upload direto do navegador para o Storage (regra 5).
 *
 * O PDF não passa mais pela server action: a Vercel recusa corpos acima de
 * ~4,5 MB antes do código rodar, e o arquivo nunca chegava ao bucket. O
 * servidor só emite uma URL assinada para um caminho que ele mesmo escolheu
 * e, no envio da candidatura, confere que o arquivo existe e cabe no limite.
 */
export async function createResumeUploadTarget(
  prefix: string
): Promise<ResumeUploadTarget | null> {
  const path = `${prefix}${crypto.randomUUID()}.pdf`;
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

/** Confere que o PDF enviado pelo navegador está no bucket e cabe em 5 MB. */
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
      error: "Não recebemos o seu currículo. Envie o PDF novamente.",
    };
  }
  if (typeof data.size === "number" && data.size > MAX_RESUME_BYTES) {
    await supabase.storage.from(RESUMES_BUCKET).remove([path]);
    return { ok: false, error: "O currículo deve ter no máximo 5 MB." };
  }
  return { ok: true };
}
