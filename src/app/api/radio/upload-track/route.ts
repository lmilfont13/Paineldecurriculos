import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser, isAdmin, isManager } from "@/server/services/auth.service";
import { parseTrackFromFilename } from "@/server/services/message-template.service";

export const maxDuration = 60;

function sanitizeMp3FileName(original: string): string {
  const base = original
    .replace(/\.mp3$/i, "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${base || `track-${Date.now()}`}.mp3`;
}

/**
 * GET /api/radio/upload-track?filename=...&title=...&artist=...
 * Gera URL assinada do Supabase Storage para upload direto de MP3 grandes (sem limite de 4.5 MB da Vercel).
 */
export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || (!isAdmin(user) && !isManager(user))) {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rawName = searchParams.get("filename") || "musica.mp3";
    const customTitle = searchParams.get("title")?.trim();
    const customArtist = searchParams.get("artist")?.trim();

    const safeFileName = sanitizeMp3FileName(rawName);
    const parsed = parseTrackFromFilename(safeFileName);
    const storageKey = `radio-music/${Date.now()}-${safeFileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from("logos")
      .createSignedUploadUrl(storageKey);

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { ok: false, error: error?.message || "Bucket indisponível para upload assinado." },
        { status: 400 }
      );
    }

    const { data: pub } = supabase.storage.from("logos").getPublicUrl(storageKey);

    return NextResponse.json({
      ok: true,
      signedUrl: data.signedUrl,
      publicUrl: pub.publicUrl,
      track: {
        id: `mp3-${Date.now()}`,
        title: customTitle || parsed.title,
        artist: customArtist || parsed.artist,
        audioUrl: pub.publicUrl,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Erro ao preparar upload." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/radio/upload-track
 * Salva o arquivo .mp3 diretamente na pasta public/audio/music (local) e/ou no Supabase Storage (produção).
 */
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || (!isAdmin(user) && !isManager(user))) {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const customTitle = String(formData.get("title") || "").trim();
    const customArtist = String(formData.get("artist") || "").trim();

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { ok: false, error: "Selecione um arquivo MP3 válido." },
        { status: 400 }
      );
    }

    const isMp3 =
      file.name.toLowerCase().endsWith(".mp3") ||
      file.type === "audio/mpeg" ||
      file.type === "audio/mp3" ||
      file.type.startsWith("audio/");

    if (!isMp3) {
      return NextResponse.json(
        { ok: false, error: "Apenas arquivos de áudio (.mp3) são permitidos." },
        { status: 400 }
      );
    }

    const safeFileName = sanitizeMp3FileName(file.name);
    const parsed = parseTrackFromFilename(safeFileName);
    const buffer = Buffer.from(await file.arrayBuffer());

    let finalAudioUrl = `/audio/music/${safeFileName}`;
    let savedLocally = false;

    // 1. Tenta salvar diretamente na pasta public/audio/music
    try {
      const musicDir = path.resolve(process.cwd(), "public/audio/music");
      await fs.mkdir(musicDir, { recursive: true });
      const filePath = path.join(musicDir, safeFileName);
      await fs.writeFile(filePath, buffer);
      savedLocally = true;
    } catch {
      // Em produção serverless (sistema de arquivos somente leitura), faz upload para o Supabase Storage
    }

    // 2. Se não salvou localmente (ex: Vercel), envia para o bucket público no Supabase Storage
    if (!savedLocally) {
      try {
        const supabase = createAdminClient();
        const storageKey = `radio-music/${Date.now()}-${safeFileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: uploadErr } = await supabase.storage
          .from("logos")
          .upload(storageKey, buffer, {
            contentType: "audio/mpeg",
            upsert: true,
          });

        if (uploadErr) {
          return NextResponse.json(
            { ok: false, error: `Falha ao salvar MP3 na nuvem: ${uploadErr.message}` },
            { status: 500 }
          );
        }

        const { data: pub } = supabase.storage.from("logos").getPublicUrl(storageKey);
        finalAudioUrl = pub.publicUrl;
      } catch (storageErr: any) {
        return NextResponse.json(
          { ok: false, error: storageErr?.message || "Erro ao enviar MP3 para o armazenamento." },
          { status: 500 }
        );
      }
    }

    const track = {
      id: `mp3-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: (customTitle || parsed.title).slice(0, 80),
      artist: (customArtist || parsed.artist).slice(0, 80),
      audioUrl: finalAudioUrl,
    };

    return NextResponse.json({
      ok: true,
      savedLocally,
      track,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Erro inesperado ao processar o arquivo MP3." },
      { status: 500 }
    );
  }
}

