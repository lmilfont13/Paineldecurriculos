import { NextResponse } from "next/server";

import { requireManager } from "@/server/controllers/guards";
import { getResumeSignedUrl } from "@/server/services/application.service";

/** Download do currículo: redireciona para URL assinada do Storage privado. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireManager();
  const { id } = await params;
  const url = await getResumeSignedUrl(user.companyId, id);
  if (!url) {
    return NextResponse.json(
      { error: "Currículo não encontrado" },
      { status: 404 }
    );
  }
  // URL assinada do Storage (absoluta) ou arquivo demo de /public (relativo,
  // resolvido contra o próprio request).
  return NextResponse.redirect(new URL(url, request.url));
}
