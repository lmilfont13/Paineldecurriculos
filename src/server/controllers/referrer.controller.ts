/**
 * Controller de indicadores e métricas de origem.
 * Camada de controller: valida input, resolve sessão/tenant e chama services.
 */

"use server";

import { z } from "zod";
import { appUrl } from "@/lib/env";
import { getGestorShell } from "@/server/controllers/gestor.controller";
import {
  addReferrerByName,
  getJobMetrics,
  listReferrers,
  removeReferrer,
} from "@/server/services/referrer.service";

// ── Indicadores (CRUD) ───────────────────────────────────────────

export async function listReferrersAction() {
  const { user } = await getGestorShell();
  return listReferrers(user.companyId);
}

const addSchema = z.object({ name: z.string().min(2).max(100) });

export async function addReferrerAction(name: string) {
  const { user } = await getGestorShell();
  addSchema.parse({ name });
  return addReferrerByName(user.companyId, name);
}

const removeSchema = z.object({ id: z.string().cuid() });

export async function removeReferrerAction(id: string) {
  const { user } = await getGestorShell();
  removeSchema.parse({ id });
  await removeReferrer(user.companyId, id);
}

// ── Dados para a página de indicadores ───────────────────────────

export async function getIndicadoresPageData() {
  const { company } = await getGestorShell();
  return { companySlug: company.slug, appUrl: appUrl() };
}

// ── Métricas da vaga (Feature 6) ─────────────────────────────────

export async function getJobMetricsAction(jobId: string) {
  const { user } = await getGestorShell();
  return getJobMetrics(user.companyId, jobId);
}
