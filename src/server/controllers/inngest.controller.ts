import "server-only";

import { inngest } from "@/lib/inngest";
import { runTriageWithTracking } from "@/server/services/ai.service";
import { sweepStaleAgentRuns } from "@/server/services/agent-watchdog.service";
import { communicateStatusChange } from "@/server/services/application.service";
import { runCompanyIntelligence } from "@/server/services/intelligence.service";

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
    await runTriageWithTracking(applicationId, {
      eventName: "application/submitted",
      rethrow: true,
    });
  }
);

/**
 * Watchdog (a cada 5 min): AgentRun QUEUED/RUNNING há mais de 5 minutos vira
 * FAILED, e candidaturas presas em "Analisando…" voltam para reanálise.
 */
export const agentWatchdogJob = inngest.createFunction(
  {
    id: "agent-watchdog",
    retries: 0,
    triggers: [{ cron: "*/5 * * * *" }],
  },
  async () => sweepStaleAgentRuns()
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
    await communicateStatusChange(applicationId, status, { rethrow: true });
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

export const inngestFunctions = [
  analyzeApplicationJob,
  applicationStatusChangedJob,
  companyIntelligenceJob,
  agentWatchdogJob,
];
