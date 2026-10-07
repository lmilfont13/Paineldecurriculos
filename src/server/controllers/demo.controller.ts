"use server";

import { runInBackground } from "@/lib/background";
import { revalidatePath } from "next/cache";

import { requireManager } from "@/server/controllers/guards";
import {
  createAgentRun,
  createApplication,
  createStatusEvent,
  findApplicationByCandidateAndJob,
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

const DEMO_EMAIL = "marina.alves.costa@example.invalid";
const DEMO_RESUME = "demo/curriculo-candidato-ficticio.pdf";

export async function runDemoTriage() {
  const manager = await requireManager();

  const jobs = await findOpenJobsByCompanyId(manager.companyId);
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

  // Roda depois da resposta com after() (a Vercel mantém a função viva).
  // Se ainda assim ela for congelada, o watchdog fecha o AgentRun em 5 min.
  const applicationId = application.id;
  runInBackground("demo de triagem", async () => {
    await runTriageWithTracking(applicationId, {
      eventName: "demo/triage-requested",
      runId: run.id,
    });
    revalidatePath("/agentes");
    revalidatePath("/candidaturas");
    revalidatePath(`/candidaturas/${applicationId}`);
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
