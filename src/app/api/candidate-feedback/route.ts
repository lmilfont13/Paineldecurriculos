import { NextResponse } from "next/server";
import { candidateFeedbackInputSchema } from "@/server/models/candidate-feedback.model";
import {
  getCandidateSentimentSummary,
  submitCandidateFeedback,
} from "@/server/services/candidate-feedback.service";
import { getSessionUser } from "@/server/services/auth.service";

export const runtime = "nodejs";

/**
 * GET /api/candidate-feedback?slug=acme
 * Retorna as estatísticas consolidadas e percentuais de satisfação da empresa
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let slug = searchParams.get("slug");

    if (!slug) {
      // Se não passou slug, tenta pegar a empresa da sessão do gestor/admin
      const user = await getSessionUser();
      if (user?.companyId) {
        slug = user.companyId;
      }
    }

    if (!slug) {
      return NextResponse.json(
        { error: "Slug ou empresa não fornecida" },
        { status: 400 }
      );
    }

    const summary = await getCandidateSentimentSummary(slug);
    return NextResponse.json(summary);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao buscar métricas de satisfação" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/candidate-feedback
 * Registra o voto/avaliação de emoji do candidato
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = candidateFeedbackInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const summary = await submitCandidateFeedback(parsed.data);
    return NextResponse.json({ ok: true, summary });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao registrar avaliação" },
      { status: 500 }
    );
  }
}
