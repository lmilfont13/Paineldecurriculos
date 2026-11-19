import "server-only";

import { readEnv, appUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export type InstagramPublishResult = {
  success: boolean;
  mediaId?: string;
  permalink?: string;
  error?: string;
  message?: string;
  needsConfig?: boolean;
};

export type InstagramVerifyResult = {
  ok: boolean;
  username?: string;
  name?: string;
  profilePictureUrl?: string;
  error?: string;
};

export async function verifyInstagramConnection(params: {
  accountId?: string;
  accessToken?: string;
}): Promise<InstagramVerifyResult> {
  const accountId = params.accountId?.trim() || readEnv("INSTAGRAM_ACCOUNT_ID") || readEnv("META_INSTAGRAM_ACCOUNT_ID");
  const accessToken = params.accessToken?.trim() || readEnv("INSTAGRAM_ACCESS_TOKEN") || readEnv("META_ACCESS_TOKEN");

  if (!accountId || !accessToken) {
    return { ok: false, error: "Account ID e Access Token não configurados." };
  }

  try {
    const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(accountId)}?fields=name,username,profile_picture_url&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      name?: string;
      username?: string;
      profile_picture_url?: string;
      error?: { message: string; type: string; code: number };
    };

    if (!res.ok || data.error) {
      return { ok: false, error: data.error?.message || "Credenciais inválidas ou expiradas na Meta." };
    }

    return {
      ok: true,
      username: data.username,
      name: data.name,
      profilePictureUrl: data.profile_picture_url,
    };
  } catch (err) {
    return { ok: false, error: "Falha ao comunicar com os servidores da Meta." };
  }
}

// Armazenamento em memória temporário para fallback de download pelo crawler da Meta
const tempImageCache = new Map<string, { buffer: Buffer; expiresAt: number }>();

export function setTempSocialImage(id: string, buffer: Buffer): void {
  // Expira em 30 minutos
  tempImageCache.set(id, { buffer, expiresAt: Date.now() + 30 * 60 * 1000 });
  // Limpa expirados
  for (const [key, val] of tempImageCache.entries()) {
    if (val.expiresAt < Date.now()) tempImageCache.delete(key);
  }
}

export function getTempSocialImage(id: string): Buffer | null {
  const item = tempImageCache.get(id);
  if (!item || item.expiresAt < Date.now()) return null;
  return item.buffer;
}

/**
 * Publica uma imagem diretamente no feed do Instagram usando a Graph API da Meta.
 * Suporta credenciais via variáveis de ambiente ou fornecidas diretamente pela empresa.
 */
export async function publishToInstagramFeed(params: {
  imageBase64: string;
  caption: string;
  accountId?: string;
  accessToken?: string;
}): Promise<InstagramPublishResult> {
  const accountId = params.accountId?.trim() || readEnv("INSTAGRAM_ACCOUNT_ID") || readEnv("META_INSTAGRAM_ACCOUNT_ID");
  const accessToken = params.accessToken?.trim() || readEnv("INSTAGRAM_ACCESS_TOKEN") || readEnv("META_ACCESS_TOKEN");

  if (!accountId || !accessToken) {
    return {
      success: false,
      needsConfig: true,
      error: "CREDENTIALS_MISSING",
      message: "Credenciais do Instagram Graph API (Account ID e Access Token) não configuradas.",
    };
  }

  const rawBase64 = params.imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const imageBuffer = Buffer.from(rawBase64, "base64");

  // 1. Obter uma URL HTTPS pública para a Meta baixar a imagem
  let publicImageUrl: string | null = null;
  const imageId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  // Tenta hospedar no Supabase Storage primeiro
  try {
    const supabase = createAdminClient();
    const filePath = `instagram-posts/${imageId}.png`;

    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(filePath, imageBuffer, { contentType: "image/png", upsert: true });

    if (!uploadError) {
      const { data: signData } = await supabase.storage
        .from("resumes")
        .createSignedUrl(filePath, 3600); // 1 hora de validade
      if (signData?.signedUrl) {
        publicImageUrl = signData.signedUrl;
      }
    }
  } catch (err) {
    console.warn("[instagram] Falha ao enviar para o Supabase Storage, usando endpoint fallback:", err);
  }

  // Fallback: endpoint HTTP temporário do próprio app
  if (!publicImageUrl) {
    setTempSocialImage(imageId, imageBuffer);
    const base = appUrl() || "https://paineldecurriculos-ptsc.vercel.app";
    publicImageUrl = `${base}/api/social/temp-image/${imageId}`;
  }

  // 2. Passo 1 da Meta: Criar container de mídia no Instagram
  const containerUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(accountId)}/media`;
  const containerRes = await fetch(containerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: publicImageUrl,
      caption: params.caption,
      access_token: accessToken,
    }),
  });

  const containerData = (await containerRes.json()) as {
    id?: string;
    error?: { message: string; type: string; code: number };
  };

  if (!containerRes.ok || !containerData.id) {
    console.error("[instagram] Erro ao criar container Meta:", containerData);
    return {
      success: false,
      error: containerData.error?.message || "Falha ao criar container no Instagram.",
      message: containerData.error?.message || "Erro na API da Meta ao processar imagem.",
    };
  }

  const creationId = containerData.id;

  // 3. Aguarda o processamento do container pela Meta (polling curto de até 15s)
  let isReady = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const statusRes = await fetch(
        `https://graph.facebook.com/v21.0/${creationId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`
      );
      const statusData = (await statusRes.json()) as { status_code?: string };
      if (statusData.status_code === "FINISHED") {
        isReady = true;
        break;
      }
      if (statusData.status_code === "ERROR" || statusData.status_code === "EXPIRED") {
        break;
      }
    } catch {
      // continua tentando
    }
  }

  // 4. Passo 2 da Meta: Publicar container de mídia
  const publishUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(accountId)}/media_publish`;
  const publishRes = await fetch(publishUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creation_id: creationId,
      access_token: accessToken,
    }),
  });

  const publishData = (await publishRes.json()) as {
    id?: string;
    error?: { message: string; type: string; code: number };
  };

  if (!publishRes.ok || !publishData.id) {
    console.error("[instagram] Erro ao publicar mídia no Instagram:", publishData);
    return {
      success: false,
      error: publishData.error?.message || "Falha ao publicar no Feed do Instagram.",
      message: publishData.error?.message || "A API da Meta recusou a publicação.",
    };
  }

  const publishedMediaId = publishData.id;

  // 5. Passo opcional: Buscar permalink oficial da publicação
  let permalink: string | undefined;
  try {
    const mediaInfoRes = await fetch(
      `https://graph.facebook.com/v21.0/${publishedMediaId}?fields=permalink&access_token=${encodeURIComponent(accessToken)}`
    );
    const mediaInfo = (await mediaInfoRes.json()) as { permalink?: string };
    permalink = mediaInfo.permalink;
  } catch {
    // ignore
  }

  return {
    success: true,
    mediaId: publishedMediaId,
    permalink: permalink || `https://www.instagram.com/`,
    message: "Publicação realizada com sucesso no Feed do Instagram!",
  };
}
