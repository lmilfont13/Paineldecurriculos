import { createClient } from "@/lib/supabase/client";
import {
  MAX_RESUME_BYTES,
  RESUME_MIME,
  hasPdfSignature,
  looksLikePdf,
  type ResumeUploadTarget,
} from "@/server/models/application.model";

const RESUMES_BUCKET = "resumes";

/**
 * Confere o arquivo escolhido antes do envio (regra 5). Retorna a mensagem de
 * erro para o candidato, ou null se estiver tudo certo.
 *
 * No celular, PDF vindo do WhatsApp/Drive costuma chegar sem MIME ou como
 * "application/octet-stream" — por isso a extensão vale nesses casos, e o
 * conteúdo é conferido pelos bytes iniciais.
 */
export async function checkResumeFile(file: File): Promise<string | null> {
  if (!looksLikePdf(file)) return "O currículo deve ser um PDF.";
  if (file.size === 0) return "O arquivo está vazio. Escolha outro PDF.";
  if (file.size > MAX_RESUME_BYTES) {
    return "O currículo deve ter no máximo 5 MB.";
  }
  try {
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (!hasPdfSignature(head)) {
      return "Este arquivo não parece ser um PDF válido.";
    }
  } catch {
    // Sem leitura do conteúdo (navegador antigo): segue com MIME/extensão.
  }
  return null;
}

/**
 * Sobe o PDF direto do navegador para o Storage, na URL assinada emitida pelo
 * servidor. O arquivo não passa pela server action (limite de ~4,5 MB do
 * corpo das funções na Vercel).
 */
export async function uploadResumeToStorage(
  file: File,
  target: ResumeUploadTarget
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(RESUMES_BUCKET)
    .uploadToSignedUrl(target.path, target.token, file, {
      // O MIME é fixado: o bucket só aceita application/pdf e o celular
      // muitas vezes informa um tipo genérico.
      contentType: RESUME_MIME,
      upsert: false,
    });
  if (error) {
    console.error("[currículo] Falha no upload:", error.message);
    return {
      ok: false,
      error: "Não foi possível enviar o currículo. Verifique a conexão e tente de novo.",
    };
  }
  return { ok: true };
}
