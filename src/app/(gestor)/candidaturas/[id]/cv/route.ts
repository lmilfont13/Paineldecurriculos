import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { renderCandidateResumePdfBuffer } from "@/components/report/candidate-resume-pdf";
import { requireManager } from "@/server/controllers/guards";
import {
  buildResumeDownloadFilename,
  getApplicationResumePdfData,
  getResumeSignedUrl,
} from "@/server/services/application.service";

export const runtime = "nodejs";

/**
 * Visualização inline ou download direto (?download=1) do currículo em PDF.
 * - Se houver PDF original no Storage (ou em outra vaga/perfil da mesma pessoa),
 *   redireciona para a URL assinada (com Content-Disposition: attachment quando download=1).
 * - Se não houver arquivo físico (ou se ?mode=dossier for passado), gera um PDF
 *   executivo completo com os dados, resumo, parecer e respostas do candidato.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireManager();
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const urlOverride = searchParams.get("url");
  const isDownload =
    searchParams.get("download") === "1" ||
    searchParams.get("download") === "true";
  const forceDossier = searchParams.get("mode") === "dossier";

  if (!forceDossier) {
    const url = await getResumeSignedUrl(user.companyId, id, urlOverride, {
      download: isDownload,
    });

    if (url) {
      // Arquivo demo local (/demo/...): se for download, entrega com Content-Disposition: attachment
      if (url.startsWith("/") && isDownload) {
        try {
          const pdfData = await getApplicationResumePdfData(user.companyId, id);
          const filename = buildResumeDownloadFilename(pdfData?.name, ".pdf");
          const diskPath = path.join(process.cwd(), "public", url.replace(/^\//, ""));
          const fileBuffer = await fs.readFile(diskPath);
          return new Response(new Uint8Array(fileBuffer), {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${filename}"`,
              "Cache-Control": "private, max-age=60",
            },
          });
        } catch {
          // Se falhar leitura local, segue para geração dinâmica do PDF abaixo
        }
      } else {
        return NextResponse.redirect(new URL(url, request.url));
      }
    }
  }

  // Fallback universal: gera o PDF executivo do currículo/dossiê da candidatura
  const pdfData = await getApplicationResumePdfData(user.companyId, id);
  if (!pdfData) {
    return NextResponse.json(
      { error: "Currículo não encontrado" },
      { status: 404 }
    );
  }

  const buffer = await renderCandidateResumePdfBuffer(pdfData);
  const filename = buildResumeDownloadFilename(pdfData.name, ".pdf");
  const disposition = isDownload ? "attachment" : "inline";

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
