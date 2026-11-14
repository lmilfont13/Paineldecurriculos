import { NextResponse } from "next/server";

import { getCandidateResumeSignedUrl } from "@/server/services/application.service";
import { getSessionCandidate } from "@/server/services/candidate.service";

/** Visualização ou download (?download=1) do currículo salvo no perfil do candidato. */
export async function GET(request: Request) {
  const candidate = await getSessionCandidate();
  if (!candidate) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const isDownload =
    searchParams.get("download") === "1" ||
    searchParams.get("download") === "true";

  const url = await getCandidateResumeSignedUrl(
    candidate.id,
    candidate.resumeUrl,
    { download: isDownload, candidateName: candidate.name }
  );
  if (!url) {
    return NextResponse.json(
      { error: "Currículo não encontrado" },
      { status: 404 }
    );
  }
  return NextResponse.redirect(new URL(url, request.url));
}
