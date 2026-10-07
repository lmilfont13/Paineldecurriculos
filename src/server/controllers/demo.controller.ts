"use server";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/server/controllers/guards";
import {
  clearTriageSimulation,
  getSimulationJobOptions,
  startRealTriageSimulation,
  startTriageSimulation,
} from "@/server/services/simulation.service";

/**
 * Sala de simulação (tela /agentes): 4 candidatos fictícios analisados um a
 * um pelo Agente de Triagem, com cada etapa visível ao vivo.
 */
export async function runDemoTriage() {
  const manager = await requireManager();
  const result = await startTriageSimulation(manager.companyId);

  revalidatePath("/agentes");
  revalidatePath("/candidaturas");

  return { ok: true, ...result };
}

/** Remove as candidaturas fictícias da simulação (definitivo). */
export async function clearDemoTriage() {
  const manager = await requireManager();
  const result = await clearTriageSimulation(manager.companyId);
  revalidatePath("/agentes");
  revalidatePath("/candidaturas");
  revalidatePath("/painel");
  return result;
}

/** Vagas com candidatos reais para o seletor da sala. */
export async function loadSimulationOptions() {
  const manager = await requireManager();
  return getSimulationJobOptions(manager.companyId);
}

/**
 * Sala com candidatos reais. `jobId` vazio = todas as vagas. A vaga é
 * conferida contra as da empresa da sessão (regra 1) no service.
 */
export async function runRealTriage(jobId: string | null) {
  const manager = await requireManager();
  const id = typeof jobId === "string" && /^[a-z0-9]{10,40}$/i.test(jobId) ? jobId : null;
  const result = await startRealTriageSimulation(manager.companyId, id);
  revalidatePath("/agentes");
  revalidatePath("/candidaturas");
  return result;
}
