import { NextRequest, NextResponse } from "next/server";
import { getTempSocialImage } from "@/server/services/instagram-publish.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const buffer = getTempSocialImage(id);

  if (!buffer) {
    return new NextResponse("Image not found or expired", { status: 404 });
  }

  const response = new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });

  return response;
}
