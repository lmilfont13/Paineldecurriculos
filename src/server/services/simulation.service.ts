import "server-only";

import { revalidatePath } from "next/cache";

import { runInBackground } from "@/lib/background";
import {
  SIMULATION_CANDIDATES,
  SIMULATION_STEP_PAUSE_MS,
} from "@/server/models/simulation.model";
import {
  createAgentRun,
  createApplication,
  createStatusEvent,
  findApplicationByCandidateAndJob,
  updateAgentRun,
  updateApplicationAi,
} from "@/server/repositories/application.repository";
import {
  createCandidate,
  findCandidateByEmail,
} from "@/server/repositories/candidate.repository";
import {
  createJob,
  findOpenJobsByCompanyId,
} from "@/server/repositories/job.repository";
import { runTriageWithTracking } from "@/server/services/ai.service";

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
