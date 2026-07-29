import { NextResponse } from "next/server";

import { getCandidateResumeSignedUrl } from "@/server/services/application.service";
import { getSessionCandidate } from "@/server/services/candidate.service";

/** Download do currículo salvo no perfil do candidato. */
export async function GET() {
  const candidate = await getSessionCandidate();
  if (!candidate) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const url = await getCandidateResumeSignedUrl(
    candidate.id,
    candidate.resumeUrl
  );
  if (!url) {
    return NextResponse.json(
      { error: "Currículo não encontrado" },
      { status: 404 }
    );
  }
  return NextResponse.redirect(url);
}
