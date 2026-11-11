import { type NextRequest, NextResponse } from "next/server";
import { generateBirthdayAiImage } from "@/server/services/birthday-image.service";
import type { BirthdayAiStyle } from "@/server/models/birthday-image.model";
import { getSessionUser, isAdmin, isManager } from "@/server/services/auth.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Só para gestor/admin logado: a rota chama geradores de imagem por IA
 * (custo) e envia o nome do aniversariante a um serviço externo. Aberta,
 * qualquer visitante podia usá-la à vontade.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || (!isManager(user) && !isAdmin(user))) {
    return new NextResponse("Não autorizado", { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const name = searchParams.get("name") || "Colaborador";
  const ageStr = searchParams.get("age");
  const age = ageStr ? parseInt(ageStr, 10) : undefined;
  const company = searchParams.get("company") || "Nossa Empresa";
  const style = (searchParams.get("style") as BirthdayAiStyle) || "luxury_gold";
  const seedStr = searchParams.get("seed");
  const seed = seedStr ? parseInt(seedStr, 10) : undefined;

  const result = await generateBirthdayAiImage({
    name,
    age: isNaN(age as number) ? undefined : age,
    company,
    style,
    seed,
  });

  if (!result.ok || !result.base64) {
    return new NextResponse("Falha ao gerar imagem com IA", { status: 500 });
  }

  const buffer = Buffer.from(result.base64, "base64");
  const contentType = result.mimeType || "image/jpeg";

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": buffer.length.toString(),
      "Cache-Control": "private, max-age=86400",
    },
  });
}

