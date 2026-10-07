import "server-only";

import { extractText, getDocumentProxy } from "unpdf";

import { geminiGenerate } from "@/lib/gemini";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  findApplicationById,
  updateApplicationAi,
} from "@/server/repositories/application.repository";

/** Regra 3: prompt da IA — NÃO ALTERAR. */
const AI_PROMPT = `Ignore nome, gênero, idade, foto e origem. Avalie só habilidades e experiência.
Retorne JSON: { "score": 0-100, "reasoning": "máximo 2 frases" }`;

const MAX_RESUME_CHARS = 12000;

/**
 * Análise de aderência em background. Só escreve aiScore/aiReasoning/aiState;
 * o AppStatus é decisão manual do gestor, sempre.
 */
export async function analyzeApplication(applicationId: string): Promise<void> {
  const application = await findApplicationById(applicationId);
  if (!application) return;

  if (!application.resumeUrl) {
    await updateApplicationAi(applicationId, { aiState: "NO_RESUME" });
    return;
  }

  await updateApplicationAi(applicationId, { aiState: "PROCESSING" });

  try {
    let bytes: Uint8Array;

    if (application.resumeUrl.startsWith("demo/")) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
      if (!baseUrl) throw new Error("NEXT_PUBLIC_APP_URL não configurada para currículo demo.");
      const response = await fetch(`${baseUrl}/${application.resumeUrl}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Falha ao baixar currículo demo: HTTP ${response.status}`);
      }
      bytes = new Uint8Array(await response.arrayBuffer());
    } else {
      const supabase = createAdminClient();
      const { data, error } = await supabase.storage
        .from("resumes")
        .download(application.resumeUrl);
      if (error || !data) {
        throw new Error(`Falha ao baixar currículo: ${error?.message}`);
      }
      bytes = new Uint8Array(await data.arrayBuffer());
    }

    const pdf = await getDocumentProxy(bytes);
    const { text: resumeText } = await extractText(pdf, { mergePages: true });

    const criteria =
      application.job.aiCriteria.length > 0
        ? application.job.aiCriteria.map((c) => `- ${c}`).join("\n")
        : (application.job.requirements ?? "Sem critérios específicos.");

    const raw = await geminiGenerate({
      system: AI_PROMPT,
      prompt: `Vaga: ${application.job.title}\n\nCritérios de aderência:\n${criteria}\n\nCurrículo do candidato:\n${resumeText.slice(0, MAX_RESUME_CHARS)}`,
      maxTokens: 300,
      json: true,
    });

    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as {
      score?: unknown;
      reasoning?: unknown;
    };
    const score = Math.round(Number(parsed.score));
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      throw new Error(`Score inválido retornado pela IA: ${raw}`);
    }

    await updateApplicationAi(applicationId, {
      aiScore: score,
      aiReasoning: String(parsed.reasoning ?? "").slice(0, 500),
      aiState: "DONE",
    });
  } catch (error) {
    await updateApplicationAi(applicationId, { aiState: "FAILED" });
    throw error;
  }
}
