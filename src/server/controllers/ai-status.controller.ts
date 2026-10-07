import "server-only";

import { z } from "zod";

import { requireManager } from "@/server/controllers/guards";
import {
  getAgentCenter,
  getAiProgress,
} from "@/server/services/application.service";
import { getSessionUser, isManager } from "@/server/services/auth.service";

const idsSchema = z.array(z.string().min(1).max(64)).max(100);

/**
 * GET /api/ai-status?ids=a,b — estado da IA para o polling leve do painel.
 * Tenant sempre da sessão (regra 1); ids de outra empresa simplesmente não
 * voltam. Resposta pequena e sem cache.
 */
export async function aiStatusHandler(request: Request): Promise<Response> {
  const user = await getSessionUser();
  if (!user || !isManager(user)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const raw = new URL(request.url).searchParams.get("ids") ?? "";
  const parsed = idsSchema.safeParse(raw.split(",").filter(Boolean));
  if (!parsed.success) {
    return Response.json({ error: "invalid ids" }, { status: 400 });
  }

  const progress = await getAiProgress(user.companyId, parsed.data);
  return Response.json(progress, {
    headers: { "Cache-Control": "no-store" },
  });
}

/** Dados da central de agentes (/agentes), já com o watchdog aplicado. */
export async function loadAgentCenter() {
  const manager = await requireManager();
  return { manager, data: await getAgentCenter(manager.companyId) };
}
