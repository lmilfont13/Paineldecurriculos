import "server-only";

import { geminiGenerate } from "@/lib/gemini";
import {
  getCompanyIntelligenceSnapshot,
  updateAgentRun,
} from "@/server/repositories/application.repository";

const INTELLIGENCE_PROMPT = `Você é o Agente de Inteligência de um SaaS profissional de recrutamento.
Analise somente métricas agregadas do processo. Não invente fatos, não identifique candidatos e não recomende decisões automáticas.
Retorne JSON com:
{
  "headline": "uma conclusão executiva em até 12 palavras",
  "summary": "até 3 frases objetivas",
  "insights": ["até 4 insights acionáveis"],
  "bottleneck": "principal gargalo observado ou null",
  "recommendation": "uma próxima ação para o gestor"
}
Priorize gargalos, qualidade do funil, aderência média, volume e pontos que merecem atenção.`;

export async function runCompanyIntelligence(companyId: string, runId: string) {
  const startedAt = new Date();
  await updateAgentRun(runId, { status: "RUNNING", attempts: 1, startedAt });

  try {
    const snapshot = await getCompanyIntelligenceSnapshot(companyId);

    if (snapshot.totalApplications === 0) {
      await updateAgentRun(runId, {
        status: "SUCCEEDED",
        summary: "Ainda não há candidaturas suficientes para gerar uma leitura do processo.",
        durationMs: Date.now() - startedAt.getTime(),
        finishedAt: new Date(),
      });
      return;
    }

    const raw = await geminiGenerate({
      system: INTELLIGENCE_PROMPT,
      prompt: JSON.stringify(snapshot),
      maxTokens: 700,
      json: true,
    });

    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as {
      headline?: unknown;
      summary?: unknown;
      insights?: unknown;
      bottleneck?: unknown;
      recommendation?: unknown;
    };

    const insights = Array.isArray(parsed.insights)
      ? parsed.insights.map(String).slice(0, 4).join(" • ")
      : "";

    const summary = [
      parsed.headline ? String(parsed.headline) : "",
      parsed.summary ? String(parsed.summary) : "",
      insights ? "Insights: " + insights : "",
      parsed.bottleneck ? "Gargalo: " + String(parsed.bottleneck) : "",
      parsed.recommendation ? "Próxima ação: " + String(parsed.recommendation) : "",
    ].filter(Boolean).join("\n");

    await updateAgentRun(runId, {
      status: "SUCCEEDED",
      summary: summary.slice(0, 2000),
      durationMs: Date.now() - startedAt.getTime(),
      finishedAt: new Date(),
    });
  } catch (error) {
    await updateAgentRun(runId, {
      status: "FAILED",
      error: error instanceof Error ? error.message.slice(0, 500) : "Falha desconhecida.",
      durationMs: Date.now() - startedAt.getTime(),
      finishedAt: new Date(),
    });
    throw error;
  }
}
