import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JobWizard } from "@/components/gestor/job-wizard";
import { getJobForEdit } from "@/server/controllers/gestor.controller";

export const metadata: Metadata = { title: "Editar vaga · Triagem" };

/** Edição de vaga — mesmo wizard E5–E8, pré-preenchido. */
export default async function EditarVagaPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const { job } = await getJobForEdit(jobId);
  if (!job) notFound();

  return (
    <JobWizard
      jobId={job.id}
      initial={{
        title: job.title,
        location: job.location ?? "",
        contract: job.contract,
        workMode: job.workMode,
        description: job.description,
        requirements: job.requirements ?? "",
        aiCriteria: job.aiCriteria,
        aiMinScore: job.aiMinScore,
      }}
    />
  );
}
