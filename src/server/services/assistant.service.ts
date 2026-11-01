import "server-only";

import { geminiGenerate } from "@/lib/gemini";
import {
  buildAssistantPrompt,
  pickForAssistant,
  resolveLabels,
  type AssistantRow,
} from "@/server/models/assistant.model";
import { findApplicationsByCompany } from "@/server/repositories/application.repository";
import { getCompanyJob } from "@/server/services/job.service";

export type AssistantResult =
  | {
      ok: true;
      answer: string;
      /** Pessoas citadas na resposta, para o gestor abrir a candidatura. */
      mentioned: { id: string; name: string }[];
      /** Quantas candidaturas a IA leu e quantas existem (sem reprovados). */
      analyzed: number;
      total: number;
    }
  | { ok: false; error: string };

/**
 * Responde uma pergunta do gestor olhando as candidaturas de TODAS as vagas da
 * empresa (ex.: "tenho opções melhores para esta vaga?"). Só informa: não muda
 * nota nem etapa (regras 2 e 3) e não envia nome nem contatos à IA.
 */
export async function askAcrossApplications(
  companyId: string,
  jobId: string | null,
  question: string
): Promise<AssistantResult> {
  const q = question.trim().slice(0, 500);
  if (q.length < 3) return { ok: false, error: "Escreva a sua pergunta." };

  const job = jobId ? await getCompanyJob(companyId, jobId) : null;
  if (jobId && !job) return { ok: false, error: "Vaga não encontrada." };

  const all = await findApplicationsByCompany(companyId, { includeDemo: false });
  const rows: AssistantRow[] = all.map((a) => ({
    id: a.id,
    name: a.name,
    jobId: a.job.id,
    jobTitle: a.job.title,
    status: a.status,
    aiScore: a.aiScore,
    aiReasoning: a.aiReasoning,
    aiProfile: a.aiProfile,
    aiArea: a.aiArea,
    aiLevel: a.aiLevel,
    neighborhood: a.neighborhood,
    city: a.city,
    availability: a.availability,
    salaryExpectation: a.salaryExpectation,
  }));
  const total = rows.filter((r) => r.status !== "REJECTED").length;
  const picked = pickForAssistant(rows);
  if (picked.length === 0) return { ok: false, error: "Ainda não há candidaturas para a IA consultar." };

  const { system, prompt, labelToRef } = buildAssistantPrompt(
    job
      ? { title: job.title, requirements: job.requirements, criteria: job.aiCriteria, minScore: job.aiMinScore }
      : null,
    picked,
    q
  );

  let raw: string;
  try {
    raw = await geminiGenerate({ system, prompt, maxTokens: 700, companyId });
  } catch (error) {
    console.error("[ia] Falha na pergunta sobre todas as candidaturas:", error);
    return { ok: false, error: "Não consegui falar com a IA agora. Tente de novo em instantes." };
  }
  if (!raw.trim()) return { ok: false, error: "A IA não devolveu resposta. Tente de novo." };

  const { text, mentioned } = resolveLabels(raw.trim(), labelToRef);
  return { ok: true, answer: text, mentioned, analyzed: picked.length, total };
}
