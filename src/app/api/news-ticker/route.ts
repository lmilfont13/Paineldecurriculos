import { NextResponse } from "next/server";
import { getRetailAndMarketNews } from "@/server/models/news-ticker.model";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const news = await getRetailAndMarketNews();
    return NextResponse.json({ ok: true, items: news });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "Falha ao carregar notícias" }, { status: 500 });
  }
}

