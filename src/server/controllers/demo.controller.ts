"use server";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/server/controllers/guards";
import {
  clearTriageSimulation,
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
