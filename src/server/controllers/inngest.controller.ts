import "server-only";

import { inngest } from "@/lib/inngest";
import { analyzeApplication } from "@/server/services/ai.service";
import { notifyApplicationStatusChange } from "@/server/services/application.service";
import { runCompanyIntelligence } from "@/server/services/intelligence.service";
import { findApplicationById, createAgentRun, updateAgentRun } from "@/server/repositories/application.repository";

/**
 * Job em background (regra 2): candidatura salva → responde 200 →
 * este job analisa depois, com retries do Inngest.
 */
export const analyzeApplicationJob = inngest.createFunction(
  {
    id: "analyze-application",
    retries: 2,
    triggers: [{ event: "application/submitted" }],
  },
  async ({ event }) => {
    const { applicationId } = event.data as { applicationId: string };
    const application = await findApplicationById(applicationId);
    if (!application) return;

    const run = await createAgentRun({
      companyId: application.company.id,
      applicationId,
      agent: "TRIAGE",
      eventName: "application/submitted",
    });
    const startedAt = new Date();
    await updateAgentRun(run.id, { status: "RUNNING", attempts: 1, startedAt });

    try {
      await analyzeApplication(applicationId);
      await updateAgentRun(run.id, {
        status: "SUCCEEDED",
        summary: "Candidatura analisada pela IA.",
        durationMs: Date.now() - startedAt.getTime(),
        finishedAt: new Date(),
      });
    } catch (error) {
      await updateAgentRun(run.id, {
        status: "FAILED",
        error: error instanceof Error ? error.message.slice(0, 500) : "Falha desconhecida.",
        durationMs: Date.now() - startedAt.getTime(),
        finishedAt: new Date(),
      });
      throw error;
    }
  }
);


/**
 * Agente de comunicação: uma mudança de etapa vira novidade no portal
 * e e-mail sem bloquear o gesto do recrutador.
 */
export const applicationStatusChangedJob = inngest.createFunction(
  {
    id: "application-status-changed",
    retries: 3,
    triggers: [{ event: "application/status-changed" }],
  },
  async ({ event }) => {
    const { applicationId, status } = event.data as {
      applicationId: string;
      status: "PENDING" | "INTERVIEW" | "APPROVED" | "REJECTED";
    };
    const application = await findApplicationById(applicationId);
    if (!application) return;

    const run = await createAgentRun({
      companyId: application.company.id,
      applicationId,
      agent: "COMMUNICATION",
      eventName: "application/status-changed",
    });
    const startedAt = new Date();
    await updateAgentRun(run.id, { status: "RUNNING", attempts: 1, startedAt });

    try {
      await notifyApplicationStatusChange(applicationId, status);
      await updateAgentRun(run.id, {
        status: "SUCCEEDED",
        summary: `Candidato comunicado: ${status}.`,
        durationMs: Date.now() - startedAt.getTime(),
        finishedAt: new Date(),
      });
    } catch (error) {
      await updateAgentRun(run.id, {
        status: "FAILED",
        error: error instanceof Error ? error.message.slice(0, 500) : "Falha desconhecida.",
        durationMs: Date.now() - startedAt.getTime(),
        finishedAt: new Date(),
      });
      throw error;
    }
  }
);


export const companyIntelligenceJob = inngest.createFunction(
  {
    id: "company-intelligence",
    retries: 2,
    triggers: [{ event: "company/intelligence-requested" }],
  },
  async ({ event }) => {
    const { companyId, runId } = event.data as { companyId: string; runId: string };
    await runCompanyIntelligence(companyId, runId);
  }
);

export const inngestFunctions = [analyzeApplicationJob, applicationStatusChangedJob, companyIntelligenceJob];
