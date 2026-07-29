import { NextResponse } from "next/server";

import {
  getCandidateApplication,
  getCandidateResumeSignedUrl,
} from "@/server/services/application.service";
import { getSessionCandidate } from "@/server/services/candidate.service";

/** Download do currículo enviado nesta candidatura (posse do candidato). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const candidate = await getSessionCandidate();
  if (!candidate) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const { id } = await params;
  const application = await getCandidateApplication(candidate.id, id);
  const url = application
    ? await getCandidateResumeSignedUrl(candidate.id, application.resumeUrl)
    : null;
  if (!url) {
    return NextResponse.json(
      { error: "Currículo não encontrado" },
      { status: 404 }
    );
  }
  return NextResponse.redirect(url);
}
