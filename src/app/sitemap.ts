import type { MetadataRoute } from "next";

import { appUrl } from "@/lib/env";
import { getSitemapJobs } from "@/server/controllers/public.controller";

// Gerado a cada pedido: vaga publicada ou pausada entra/sai na hora, e o build
// não depende do banco.
export const dynamic = "force-dynamic";

/**
 * sitemap.xml: página de vagas de cada empresa e cada vaga aberta, para o
 * Google achar as vagas (Google for Jobs). Sem demo e sem banco de talentos.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();
  let jobs: Awaited<ReturnType<typeof getSitemapJobs>> = [];
  try {
    jobs = await getSitemapJobs();
  } catch (error) {
    console.error("[sitemap] Falha ao listar vagas:", error);
  }

  const lastBySlug = new Map<string, Date>();
  for (const job of jobs) {
    const prev = lastBySlug.get(job.slug);
    if (!prev || job.updatedAt > prev) lastBySlug.set(job.slug, job.updatedAt);
  }

  return [
    ...[...lastBySlug].map(([slug, lastModified]) => ({
      url: `${base}/${slug}/vagas`,
      lastModified,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...jobs.map((job) => ({
      url: `${base}/${job.slug}/vagas/${job.jobId}`,
      lastModified: job.updatedAt,
      changeFrequency: "daily" as const,
      priority: 1,
    })),
  ];
}
