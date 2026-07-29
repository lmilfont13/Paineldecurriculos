import type { Metadata } from "next";

import {
  CandidaturasTable,
  type CandidaturaRow,
} from "@/components/gestor/candidaturas-table";
import { getCandidaturasPageData } from "@/server/controllers/gestor.controller";
import {
  appStatusLabels,
  type AppStatusKey,
} from "@/server/models/application.model";

export const metadata: Metadata = { title: "Candidaturas · Triagem" };

/** E3/E9 · Candidaturas com filtros e seleção em massa. */
export default async function CandidaturasPage({
  searchParams,
}: {
  searchParams: Promise<{ vaga?: string; status?: string; atende?: string }>;
}) {
  const { vaga, status, atende } = await searchParams;
  const initialStatus =
    status && status in appStatusLabels ? (status as AppStatusKey) : undefined;
  const { applications, jobs } = await getCandidaturasPageData();

  const rows: CandidaturaRow[] = applications.map((app) => ({
    id: app.id,
    name: app.name,
    email: app.email,
    createdAt: app.createdAt.toISOString(),
    status: app.status,
    aiState: app.aiState,
    aiScore: app.aiScore,
    resumeUrl: app.resumeUrl,
    jobId: app.job.id,
    jobTitle: app.job.title,
    aiMinScore: app.job.aiMinScore,
  }));

  return (
    <>
      <h1 className="text-2xl font-bold text-[#0a0a0a]">Candidaturas</h1>
      <CandidaturasTable
        rows={rows}
        jobs={jobs.map((j) => ({ id: j.id, title: j.title }))}
        initialJobId={vaga}
        initialStatus={initialStatus}
        initialOnlyMeets={atende === "1"}
      />
    </>
  );
}
