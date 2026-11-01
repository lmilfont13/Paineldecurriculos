import "server-only";

import { geminiGenerate } from "@/lib/gemini";
import {
  buildShortlistPrompt,
  parseShortlist,
  pickCandidatesForShortlist,
} from "@/server/models/shortlist.model";
import { findApplicationsForShortlist } from "@/server/repositories/application.repository";
import { getCompanyJob } from "@/server/services/job.service";

export type ShortlistResult =
  | {
      ok: true;
      picks: {
        applicationId: string;
        rank: number;
        name: string;
        aiScore: number | null;
        status: string;
        reason: string;
        strengths: string[];
        concerns: string[];
      }[];
      /** Quantos candidatos a IA leu e quantos existem na vaga (sem reprovados). */
      analyzed: number;
      total: number;
    }
  | { ok: false; error: string };

/**
 * Compara os candidatos de uma vaga e indica os melhores. Só sugere: não muda
 * nota nem etapa (regras 2 e 3) e não envia nome nem contatos à IA.
 */
export async function analyzeJobShortlist(
  companyId: string,
  jobId: string,
  topN: number
): Promise<ShortlistResult> {
  const job = await getCompanyJob(companyId, jobId);
  if (!job) return { ok: false, error: "Vaga não encontrada." };

  const rows = await findApplicationsForShortlist(companyId, jobId);
  const total = rows.filter((r) => r.status !== "REJECTED").length;
  const picked = pickCandidatesForShortlist(rows);
  if (picked.length < 2) {
    return { ok: false, error: "É preciso ter pelo menos 2 candidatos nesta vaga para comparar." };
  }

  const wanted = Math.min(Math.max(Math.trunc(topN) || 5, 1), 10, picked.length);
  const { system, prompt, labelToId } = buildShortlistPrompt(
    { jobTitle: job.title, requirements: job.requirements, criteria: job.aiCriteria },
    picked,
    wanted
  );

  let raw: string;
  try {
    raw = await geminiGenerate({ system, prompt, maxTokens: 1500, json: true });
  } catch (error) {
    console.error("[ia] Falha na comparação de candidatos:", error);
    return { ok: false, error: "Não consegui falar com a IA agora. Tente de novo em instantes." };
  }

  const picks = parseShortlist(raw, labelToId, wanted);
  if (picks.length === 0) {
    return { ok: false, error: "A IA não devolveu uma resposta que eu consiga ler. Tente de novo." };
  }

  const byId = new Map(rows.map((r) => [r.id, r]));
  return {
    ok: true,
    analyzed: picked.length,
    total,
    picks: picks.map((p) => {
      const row = byId.get(p.applicationId);
      return {
        ...p,
        name: row?.name ?? "Candidato",
        aiScore: row?.aiScore ?? null,
        status: row?.status ?? "PENDING",
      };
    }),
  };
}
