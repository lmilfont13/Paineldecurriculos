import { type NextRequest, NextResponse } from "next/server";
import { generateBirthdayAiImage } from "@/server/services/birthday-image.service";
import type { BirthdayAiStyle } from "@/server/models/birthday-image.model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}

