"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";

import { inngest } from "@/lib/inngest";
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

  try {
    await inngest.send({
      name: "company/intelligence-requested",
      data: { companyId: manager.companyId, runId: run.id },
    });
  } catch (error) {
    console.error("[inngest] Falha ao enfileirar inteligência:", error);
    after(async () => {
      try {
        await runCompanyIntelligence(manager.companyId, run.id);
      } catch {
        // O serviço registra FAILED no AgentRun.
      }
      revalidatePath("/agentes");
    });
  }

  revalidatePath("/agentes");
  return { ok: true, runId: run.id };
}
