import "server-only";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { runInBackground } from "@/lib/background";
import {
  SIMULATION_CANDIDATES,
  SIMULATION_REAL_LIMIT,
  SIMULATION_REAL_STEP_PAUSE_MS,
  SIMULATION_STEP_PAUSE_MS,
  type SimulationJobOption,
} from "@/server/models/simulation.model";
import {
  createAgentRun,
  createApplication,
  countRealApplicationsByJob,
  createStatusEvent,
  findApplicationByCandidateAndJob,
  findRealApplicationsForSimulation,
  findDemoApplicationIds,
  updateAgentRun,
  updateApplicationAi,
} from "@/server/repositories/application.repository";
import {
  createCandidate,
  findCandidateByEmail,
} from "@/server/repositories/candidate.repository";
import {
  createJob,
  findJobsByCompanyId,
  findOpenJobsByCompanyId,
} from "@/server/repositories/job.repository";
import { runTriageWithTracking } from "@/server/services/ai.service";
import { deleteCompanyApplications } from "@/server/services/application.service";

/** Vaga usada na simulação: a administrativa aberta, senão a primeira aberta. */
async function getSimulationJob(companyId: string) {
  const jobs = await findOpenJobsByCompanyId(companyId);
  const admin = jobs.find((j) => /administrativ/i.test(j.title));
  if (admin ?? jobs[0]) return admin ?? jobs[0];

  return createJob({
    companyId,
    title: "Assistente Administrativo · Demonstração",
    description:
      "Vaga fictícia criada exclusivamente para demonstrar o funcionamento do Agente de Triagem.",
    requirements:
      "Experiência administrativa, organização, Excel, atendimento, indicadores e rotina de e-commerce.",
    location: "Fortaleza - CE",
    contract: "CLT",
    workMode: "HYBRID",
    status: "OPEN",
    aiCriteria: [
      "Experiência administrativa",
      "Excel e planilhas",
      "Organização de processos",
      "Indicadores e análise",
      "Experiência em e-commerce",
    ],
    aiMinScore: 70,
    publishedAt: new Date(),
  });
}

/**
 * Sala de simulação: 4 candidatos fictícios entram na fila de uma vez e o
 * Agente de Triagem analisa um por vez, registrando cada etapa no AgentRun
 * (a tela /agentes mostra ao vivo). Regra 2: só aiScore/aiReasoning/aiState
 * mudam; nenhum e-mail é enviado.
 */
export async function startTriageSimulation(companyId: string) {
  const job = await getSimulationJob(companyId);
  const queue: { applicationId: string; runId: string }[] = [];

  for (const person of SIMULATION_CANDIDATES) {
    const candidate =
      (await findCandidateByEmail(person.email)) ??
      (await createCandidate({
        email: person.email,
        name: person.name,
        authId: null,
      }));

    let application = await findApplicationByCandidateAndJob(
      candidate.id,
      job.id
    );
    if (!application) {
      application = await createApplication({
        jobId: job.id,
        companyId,
        candidateId: candidate.id,
        name: person.name,
        email: person.email,
        phone: person.phone,
        resumeUrl: person.resume,
        aiState: "WAITING",
        answers: [],
        isDemo: true,
      });
      await createStatusEvent({
        applicationId: application.id,
        from: null,
        to: "PENDING",
        actor: "candidato",
      });
    } else {
      await updateApplicationAi(application.id, {
        aiScore: null,
        aiReasoning: null,
        aiModel: null,
        aiChecklist: Prisma.DbNull,
        aiState: "WAITING",
      });
    }

    const run = await createAgentRun({
      companyId,
      applicationId: application.id,
      agent: "TRIAGE",
      eventName: "simulacao/triagem",
    });
    await updateAgentRun(run.id, { summary: "Na fila da simulação" });
    queue.push({ applicationId: application.id, runId: run.id });
  }

  // Depois da resposta: um candidato por vez, com pausa entre as etapas.
  // Se a função for congelada, o watchdog fecha as execuções em 5 min.
  runInBackground("sala de simulação", async () => {
    for (const item of queue) {
      await runTriageWithTracking(item.applicationId, {
        eventName: "simulacao/triagem",
        runId: item.runId,
        stepPauseMs: SIMULATION_STEP_PAUSE_MS,
        maxAttempts: 3,
      });
    }
    revalidatePath("/agentes");
    revalidatePath("/candidaturas");
  });

  return {
    jobTitle: job.title,
    candidates: SIMULATION_CANDIDATES.map((c) => c.name),
  };
}

/** "Limpar simulação": exclui as candidaturas fictícias da empresa. */
export async function clearTriageSimulation(companyId: string) {
  const ids = await findDemoApplicationIds(companyId);
  if (ids.length === 0) return { deleted: 0 };
  const { deleted } = await deleteCompanyApplications(companyId, ids);
  return { deleted: deleted.length };
}

/** Vagas com candidatos reais, para escolher na sala. */
export async function getSimulationJobOptions(
  companyId: string
): Promise<{ total: number; jobs: SimulationJobOption[] }> {
  const counts = await countRealApplicationsByJob(companyId);
  const jobs = await findJobsByCompanyId(companyId);
  const options = jobs
    .map((job) => ({ id: job.id, title: job.title, count: counts.get(job.id) ?? 0 }))
    .filter((job) => job.count > 0)
    .sort((a, b) => b.count - a.count);
  return { total: options.reduce((sum, j) => sum + j.count, 0), jobs: options };
}

/**
 * Sala com candidatos reais: reanalisa até SIMULATION_REAL_LIMIT candidaturas
 * (as mais recentes da vaga escolhida, ou de todas), uma por vez, com cada
 * etapa visível. Regra 2: só os campos da IA mudam — etapa, notas e
 * comunicação ficam como estão; ninguém é avisado.
 */
export async function startRealTriageSimulation(
  companyId: string,
  jobId: string | null
): Promise<{ jobTitle: string; candidates: string[]; capped: boolean }> {
  const options = await getSimulationJobOptions(companyId);
  const job = jobId ? options.jobs.find((j) => j.id === jobId) : null;
  if (jobId && !job) return { jobTitle: "", candidates: [], capped: false };

  const apps = await findRealApplicationsForSimulation(
    companyId,
    job?.id ?? null,
    SIMULATION_REAL_LIMIT
  );
  const available = job ? job.count : options.total;
  const queue: { applicationId: string; runId: string }[] = [];

  for (const app of apps) {
    await updateApplicationAi(app.id, { aiState: "WAITING" });
    const run = await createAgentRun({
      companyId,
      applicationId: app.id,
      agent: "TRIAGE",
      eventName: "simulacao/triagem-real",
    });
    await updateAgentRun(run.id, { summary: "Na fila da sala" });
    queue.push({ applicationId: app.id, runId: run.id });
  }

  if (queue.length > 0) {
    runInBackground("sala com candidatos reais", async () => {
      for (const item of queue) {
        await runTriageWithTracking(item.applicationId, {
          eventName: "simulacao/triagem-real",
          runId: item.runId,
          stepPauseMs: SIMULATION_REAL_STEP_PAUSE_MS,
          maxAttempts: 3,
        });
      }
      revalidatePath("/agentes");
      revalidatePath("/candidaturas");
      revalidatePath("/painel");
    });
  }

  return {
    jobTitle: job?.title ?? "todas as vagas",
    candidates: apps.map((a) => a.name),
    capped: available > apps.length,
  };
}
