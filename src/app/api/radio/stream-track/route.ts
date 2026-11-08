import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

/**
 * GET /api/radio/stream-track?file=nome-do-arquivo.mp3
 * Stream de áudio com suporte a HTTP Range (206 Partial Content),
 * decodificação segura de caracteres UTF-8 e compatibilidade total com todos os navegadores.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawFile = url.searchParams.get("file");
    if (!rawFile) {
      return NextResponse.json({ error: "Arquivo não especificado" }, { status: 400 });
    }

    const decodedFile = decodeURIComponent(rawFile)
      .replace(/^\/audio\/music\//i, "");

    const safeBaseName = path.basename(decodedFile);
    const musicDir = path.resolve(process.cwd(), "public/audio/music");
    const filePath = path.resolve(musicDir, safeBaseName);

    if (!filePath.startsWith(musicDir)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    if (!fs.existsSync(filePath)) {
      // Tenta busca insensível a maiúsculas/minúsculas na pasta
      try {
        const files = fs.readdirSync(musicDir);
        const match = files.find(
          (f) => f.toLowerCase() === safeBaseName.toLowerCase()
        );
        if (match) {
          return streamLocalFile(path.join(musicDir, match), request);
        }
      } catch {
        // Ignora erro de readdir
      }
      return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
    }

    return streamLocalFile(filePath, request);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Erro interno ao transmitir áudio" },
      { status: 500 }
    );
  }
}

function streamLocalFile(filePath: string, request: Request): Response {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = request.headers.get("range");

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      return new Response(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${fileSize}`,
        },
      });
    }

    const chunksize = end - start + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });
    const webStream = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk) => controller.enqueue(chunk));
        fileStream.on("end", () => controller.close());
        fileStream.on("error", (err) => controller.error(err));
      },
      cancel() {
        fileStream.destroy();
      },
    });

    return new Response(webStream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunksize),
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  const fileStream = fs.createReadStream(filePath);
  const webStream = new ReadableStream({
    start(controller) {
      fileStream.on("data", (chunk) => controller.enqueue(chunk));
      fileStream.on("end", () => controller.close());
      fileStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      fileStream.destroy();
    },
  });

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Length": String(fileSize),
      "Accept-Ranges": "bytes",
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

