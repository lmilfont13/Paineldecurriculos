"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";

import { requireManager } from "@/server/controllers/guards";
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
import { analyzeApplication } from "@/server/services/ai.service";

const DEMO_EMAIL = "marina.alves.costa@example.invalid";
const DEMO_RESUME = "demo/curriculo-candidato-ficticio.pdf";

export async function runDemoTriage() {
  const manager = await requireManager();

  let jobs = await findOpenJobsByCompanyId(manager.companyId);
  let job = jobs[0];

  if (!job) {
    job = await createJob({
      companyId: manager.companyId,
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

  let candidate = await findCandidateByEmail(DEMO_EMAIL);
  if (!candidate) {
    candidate = await createCandidate({
      email: DEMO_EMAIL,
      name: "Marina Alves Costa",
      authId: null,
    });
  }

  let application = await findApplicationByCandidateAndJob(candidate.id, job.id);

  if (!application) {
    application = await createApplication({
      jobId: job.id,
      companyId: manager.companyId,
      candidateId: candidate.id,
      name: candidate.name,
      email: candidate.email,
      phone: "(85) 99999-0000",
      resumeUrl: DEMO_RESUME,
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
    companyId: manager.companyId,
    applicationId: application.id,
    agent: "TRIAGE",
    eventName: "demo/triage-requested",
  });

  after(async () => {
    const startedAt = new Date();

    await updateAgentRun(run.id, {
      status: "RUNNING",
      attempts: 1,
      startedAt,
      summary: "Demonstração iniciada: currículo fictício sendo analisado.",
    });

    try {
      await analyzeApplication(application.id);

      await updateAgentRun(run.id, {
        status: "SUCCEEDED",
        summary: "Currículo fictício analisado pela IA com sucesso.",
        durationMs: Date.now() - startedAt.getTime(),
        finishedAt: new Date(),
      });
    } catch (error) {
      await updateAgentRun(run.id, {
        status: "FAILED",
        error:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Falha desconhecida.",
        durationMs: Date.now() - startedAt.getTime(),
        finishedAt: new Date(),
      });
    }

    revalidatePath("/agentes");
    revalidatePath("/candidaturas");
    revalidatePath(`/candidaturas/${application.id}`);
  });
  revalidatePath("/agentes");
  revalidatePath("/candidaturas");
  revalidatePath(`/candidaturas/${application.id}`);

  return {
    ok: true,
    applicationId: application.id,
    candidateName: candidate.name,
  };
}
