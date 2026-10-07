"use server";

import { revalidatePath } from "next/cache";

import { inngest } from "@/lib/inngest";
import { requireManager } from "@/server/controllers/guards";
import { createAgentRun } from "@/server/repositories/application.repository";

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
  }

  revalidatePath("/agentes");
  return { ok: true, runId: run.id };
}
