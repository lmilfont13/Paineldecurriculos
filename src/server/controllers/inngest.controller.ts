import "server-only";

import { inngest } from "@/lib/inngest";
import { analyzeApplication } from "@/server/services/ai.service";
import { notifyApplicationStatusChange } from "@/server/services/application.service";

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
    await analyzeApplication(applicationId);
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
    await notifyApplicationStatusChange(applicationId, status);
  }
);

export const inngestFunctions = [analyzeApplicationJob, applicationStatusChangedJob];
