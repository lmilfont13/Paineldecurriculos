"use server";

import { revalidatePath } from "next/cache";

import { runInBackground } from "@/lib/background";
import { trySendEvent } from "@/lib/inngest";
import { requireManager } from "@/server/controllers/guards";
import { createAgentRun } from "@/server/repositories/application.repository";
import { runCompanyIntelligence } from "@/server/services/intelligence.service";

export async function requestCompanyIntelligence() {
  const manager = await requireManager();

  const run = await createAgentRun({
    companyId: manager.companyId,
    agent: "INTELLIGENCE",
    eventName: "company/intelligence-requested",
  });

  const queued = await trySendEvent({
    name: "company/intelligence-requested",
    data: { companyId: manager.companyId, runId: run.id },
  });
  if (!queued) {
    // O serviço registra FAILED no AgentRun; o watchdog cobre o congelamento.
    runInBackground("leitura de inteligência", async () => {
      await runCompanyIntelligence(manager.companyId, run.id);
      revalidatePath("/agentes");
    });
  }

  revalidatePath("/agentes");
  return { ok: true, runId: run.id };
}
