import { NextResponse } from "next/server";

import {
  getCandidateApplication,
  getCandidateResumeSignedUrl,
} from "@/server/services/application.service";
import { getSessionCandidate } from "@/server/services/candidate.service";

/** Visualização ou download (?download=1) do currículo enviado nesta candidatura (posse do candidato). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const candidate = await getSessionCandidate();
  if (!candidate) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const isDownload =
    searchParams.get("download") === "1" ||
    searchParams.get("download") === "true";

  const application = await getCandidateApplication(candidate.id, id);
  const url = application
    ? await getCandidateResumeSignedUrl(
        candidate.id,
        application.resumeUrl ?? candidate.resumeUrl,
        { download: isDownload, candidateName: application.name || candidate.name }
      )
    : null;
  if (!url) {
    return NextResponse.json(
      { error: "Currículo não encontrado" },
      { status: 404 }
    );
  }
  return NextResponse.redirect(new URL(url, request.url));
}
