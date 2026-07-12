import "server-only";

import { inngest } from "@/lib/inngest";
import { analyzeApplication } from "@/server/services/ai.service";

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

export const inngestFunctions = [analyzeApplicationJob];
