import "server-only";

import { failStaleAgentRuns } from "@/server/repositories/application.repository";

/** Execução de agente parada há mais que isso é considerada morta. */
export const AGENT_RUN_TIMEOUT_MS = 5 * 60 * 1000;

const REASON =
  "Tempo esgotado: a execução ficou mais de 5 minutos sem concluir e foi encerrada pelo watchdog.";

/**
 * Marca como FAILED as execuções QUEUED/RUNNING com mais de 5 minutos.
 * Roda a cada 5 min pelo Inngest (cron) e, de forma oportunista, quando o
 * gestor abre a tela de agentes ou a UI consulta o estado da IA — assim
 * funciona mesmo enquanto o Inngest de produção não estiver configurado.
 */
export function sweepStaleAgentRuns(companyId?: string) {
  const cutoff = new Date(Date.now() - AGENT_RUN_TIMEOUT_MS);
  return failStaleAgentRuns(cutoff, REASON, companyId);
}

/** No máximo uma varredura oportunista por empresa por minuto, por instância. */
const lastSweepByCompany = new Map<string, number>();
const OPPORTUNISTIC_INTERVAL_MS = 60 * 1000;

export async function sweepStaleAgentRunsThrottled(companyId: string) {
  const now = Date.now();
  const last = lastSweepByCompany.get(companyId) ?? 0;
  if (now - last < OPPORTUNISTIC_INTERVAL_MS) return null;
  lastSweepByCompany.set(companyId, now);
  try {
    return await sweepStaleAgentRuns(companyId);
  } catch (error) {
    console.error("[watchdog] Falha na varredura oportunista:", error);
    return null;
  }
}
