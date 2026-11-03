import "server-only";

import { currentModelOption } from "@/lib/gemini";
import { AI_MODEL_OPTIONS } from "@/server/models/ai-model.model";
import { DEFAULT_CUTOFF, summarizeTrial, type TrialRow, type TrialScore, type TrialSummary } from "@/server/models/model-trial.model";
import { titleCasePt } from "@/server/models/text.model";
import { findRecentAnalyzedApplications } from "@/server/repositories/application.repository";
import { loadApplicationMaterial, scoreMaterialWithModel } from "@/server/services/ai.service";

export const TRIAL_SIZE = 10;
const CONCURRENCY = 4;

export type ModelTrialResult =
  | { ok: true; referenceModel: string; candidateModel: string; rows: TrialRow[]; summary: TrialSummary }
  | { ok: false; error: string };

async function safeScore(fn: () => Promise<{ score: number; reasoning: string }>): Promise<TrialScore> {
  try {
    return await fn();
  } catch (error) {
    console.error("[teste de modelo] falha da IA:", error);
    return { error: error instanceof Error ? error.message.slice(0, 160) : "Falha na IA." };
  }
}

/** Roda tarefas com no máximo `limit` ao mesmo tempo (só chamadas de IA; nada de banco). */
async function pool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

/**
 * Testa um modelo de IA nos últimos candidatos da empresa: o mesmo currículo
 * avaliado agora pelo modelo atual e pelo modelo em teste, com o AI_PROMPT
 * imutável (regra 3). NÃO grava nada — nenhuma nota, etapa ou candidatura muda.
 */
export async function runModelTrial(companyId: string, candidateModel: string): Promise<ModelTrialResult> {
  if (!AI_MODEL_OPTIONS.some((o) => o.id === candidateModel)) {
    return { ok: false, error: "Escolha um modelo da lista." };
  }
  const referenceModel = await currentModelOption(companyId);
  if (referenceModel === candidateModel) {
    return { ok: false, error: "Esse já é o modelo atual. Escolha outro para comparar." };
  }

  const apps = await findRecentAnalyzedApplications(companyId, TRIAL_SIZE);
  // Material em sequência (banco com connection_limit=1); as chamadas de IA, em paralelo.
  const items: { app: (typeof apps)[number]; material: string }[] = [];
  for (const app of apps) {
    try {
      const material = await loadApplicationMaterial(app.id);
      if (material) items.push({ app, material });
    } catch (error) {
      console.error("[teste de modelo] não leu o currículo:", app.id, error);
    }
  }
  if (items.length === 0) {
    return { ok: false, error: "Ainda não há candidatos analisados com currículo para comparar." };
  }

  const tasks = items.flatMap(({ app, material }) => [
    () => safeScore(() => scoreMaterialWithModel(app.job, material, referenceModel)),
    () => safeScore(() => scoreMaterialWithModel(app.job, material, candidateModel)),
  ]);
  const scores = await pool(tasks, CONCURRENCY);

  const rows: TrialRow[] = items.map(({ app }, i) => ({
    applicationId: app.id,
    name: titleCasePt(app.name),
    jobTitle: app.job.title,
    minScore: app.job.aiMinScore > 0 ? app.job.aiMinScore : DEFAULT_CUTOFF,
    minIsDefault: !(app.job.aiMinScore > 0),
    reference: scores[i * 2],
    candidate: scores[i * 2 + 1],
  }));
  return { ok: true, referenceModel, candidateModel, rows, summary: summarizeTrial(rows) };
}
