import { listMessageTemplatesAction } from "@/server/controllers/application.controller";
import { readChecklist } from "@/server/models/ai.model";
import { readTenure } from "@/server/models/tenure.model";
import { criteriaCoverage, decisionIndex } from "@/server/models/report.model";
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

// Ações em lote (reanalisar pendentes, extrair fotos, relatórios) rodam nesta rota:
export const maxDuration = 60;

/** E3/E9 · Candidaturas com filtros e seleção em massa. */
export default async function CandidaturasPage({
  searchParams,
}: {
  searchParams: Promise<{ vaga?: string; status?: string; atende?: string }>;
}) {
  const { vaga, status, atende } = await searchParams;
  const initialStatus =
    status && status in appStatusLabels ? (status as AppStatusKey) : undefined;
  const { applications, jobs, companyName, ages } = await getCandidaturasPageData();
  const messageTemplates = await listMessageTemplatesAction();

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
    aiIndex: decisionIndex(app.aiScore, criteriaCoverage(readChecklist(app.aiChecklist))),
    infoState: infoRequestState(app.infoRequestedAt, app.infoAnsweredAt),
    aiMinScore: app.job.aiMinScore,
    isDemo: app.isDemo,
    preRegistered: app.preRegistered,
    photoUrl: app.photoUrl,
    aiArea: app.aiArea,
    aiProfile: app.aiProfile,
    aiLevel: app.aiLevel,
    age: ages[app.id] ?? null,
    tenureStability: readTenure((app as { aiTenure?: unknown }).aiTenure ?? app.aiChecklist)?.estabilidade ?? null,
    tenureAvg: readTenure((app as { aiTenure?: unknown }).aiTenure ?? app.aiChecklist)?.tempoMedioFormatado ?? null,
    tenureRisk: readTenure((app as { aiTenure?: unknown }).aiTenure ?? app.aiChecklist)?.classificacaoRisco ?? null,
  }));

  const hasOpenJobs = jobs.some((j) => j.status === "OPEN");

  return (
    <>
      <CandidaturasTable
        rows={rows}
        jobs={jobs.map((j) => ({ id: j.id, title: j.title, code: j.code }))}
        initialJobId={vaga}
        initialStatus={initialStatus}
        messageTemplates={messageTemplates}
        companyName={companyName}
        initialOnlyMeets={atende === "1"}
        hasOpenJobs={hasOpenJobs}
      />
    </>
  );
}
