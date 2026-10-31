import { infoRequestState } from "@/server/models/candidate-list.model";
import { titleCasePt } from "@/server/models/text.model";
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

export const metadata: Metadata = { title: "Candidatos · Triagem" };

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
    name: titleCasePt(app.name),
    email: app.email,
    createdAt: app.createdAt.toISOString(),
    status: app.status,
    aiState: app.aiState,
    aiScore: app.aiScore,
    resumeUrl: app.resumeUrl,
    jobId: app.job.id,
    jobTitle: app.job.title,
    jobCode: app.job.code,
    infoState: infoRequestState(app.infoRequestedAt, app.infoAnsweredAt),
    aiMinScore: app.job.aiMinScore,
    isDemo: app.isDemo,
    preRegistered: app.preRegistered,
    photoUrl: app.photoUrl,
    aiArea: app.aiArea,
    aiProfile: app.aiProfile,
    aiLevel: app.aiLevel,
  }));

  return (
    <>
      <CandidaturasTable
        rows={rows}
        jobs={jobs.map((j) => ({ id: j.id, title: j.title, code: j.code }))}
        initialJobId={vaga}
        initialStatus={initialStatus}
        initialOnlyMeets={atende === "1"}
      />
    </>
  );
}
