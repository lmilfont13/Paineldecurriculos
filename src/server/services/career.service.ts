import "server-only";

import { careerKeywordsText, type CareerProfile } from "@/server/models/career.model";
import { CAREER_JOBS_LIMIT, pickByRelevance, relevance } from "@/server/models/standby.model";
import {
  createAgentRun,
  updateAgentRun,
  updateApplicationCareer,
} from "@/server/repositories/application.repository";
import { findOpenJobsByCompanyId } from "@/server/repositories/job.repository";
import { analyzeCareerProfile } from "@/server/services/ai.service";
import { getCompanyApplication } from "@/server/services/application.service";
import { scoreStandby } from "@/server/services/talent.service";

/**
 * Agente de perfil, sob demanda, para qualquer candidato: diz em quais áreas
 * a pessoa seria um bom candidato (nota estimada por área), resume em que
 * vaga ela seria bem aproveitada e compara com até 3 vagas abertas parecidas.
 * Fica registrado na sala dos agentes. Não muda etapa nem a nota da vaga
 * original (regra 2); a comparação com vagas usa o prompt imutável (regra 3).
 */
export async function runCareerAnalysis(
  companyId: string,
  applicationId: string
): Promise<
  { ok: true; career: CareerProfile; jobsCompared: number } | { ok: false; error: string }
> {
  const application = await getCompanyApplication(companyId, applicationId);
  if (!application) return { ok: false, error: "Candidatura não encontrada." };

  const run = await createAgentRun({
    companyId,
    applicationId,
    agent: "TRIAGE",
    eventName: "agente/perfil",
  });
  const startedAt = new Date();
  await updateAgentRun(run.id, {
    status: "RUNNING",
    attempts: 1,
    startedAt,
    summary: `Lendo o perfil de ${application.name}`,
  });

  try {
    const career = await analyzeCareerProfile(applicationId);
    if (!career) {
      await updateAgentRun(run.id, {
        status: "SUCCEEDED",
        summary: `${application.name}: sem currículo ou respostas para analisar`,
        durationMs: Date.now() - startedAt.getTime(),
        finishedAt: new Date(),
      });
      return { ok: false, error: "Não há currículo nem respostas suficientes para analisar." };
    }
    await updateApplicationCareer(applicationId, career);

    await updateAgentRun(run.id, { summary: "Comparando com as vagas abertas" });
    const profile = {
      aiProfile: careerKeywordsText(career),
      aiArea: career.areas[0]?.area ?? null,
      folderNames: [],
    };
    const jobs = (await findOpenJobsByCompanyId(companyId)).filter((j) => j.id !== application.jobId);
    const picked = pickByRelevance(
      jobs.map((job) => ({ item: job, relevance: relevance(job, profile) })),
      CAREER_JOBS_LIMIT
    );
    for (const job of picked) await scoreStandby(companyId, applicationId, job);

    const best = career.areas[0];
    await updateAgentRun(run.id, {
      status: "SUCCEEDED",
      summary: `Perfil de ${application.name}: ${best.area} (${best.score})`,
      durationMs: Date.now() - startedAt.getTime(),
      finishedAt: new Date(),
    });
    return { ok: true, career, jobsCompared: picked.length };
  } catch (error) {
    await updateAgentRun(run.id, {
      status: "FAILED",
      error: error instanceof Error ? error.message.slice(0, 500) : "Falha desconhecida.",
      durationMs: Date.now() - startedAt.getTime(),
      finishedAt: new Date(),
    });
    return { ok: false, error: "O agente não conseguiu analisar agora. Tente de novo em instantes." };
  }
}
