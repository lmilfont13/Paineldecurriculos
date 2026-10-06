import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AiScoreChip } from "@/components/gestor/ai-score-chip";
import { CopyLink } from "@/components/gestor/copy-link";
import { JobStatusActions } from "@/components/gestor/job-status-actions";
import { LiveRefresh } from "@/components/gestor/live-refresh";
import { WhatsAppShare } from "@/components/gestor/whatsapp-share";
import { VagaPipeline } from "@/components/gestor/vaga-pipeline";
import { getVagaDetailData } from "@/server/controllers/gestor.controller";
import {
  appStatusLabels,
  formatWaiting,
  type AppStatusKey,
} from "@/server/models/application.model";
import { personInitials } from "@/server/models/dashboard.model";
import {
  contractLabels,
  formatPublishedAgo,
  jobStatusLabels,
  workModeLabels,
} from "@/server/models/job.model";

export const metadata: Metadata = { title: "Vaga · Triagem" };

const STAGES: { key: AppStatusKey; label: string; accent: string }[] = [
  { key: "PENDING", label: "Triagem", accent: "#b07818" },
  { key: "INTERVIEW", label: "Entrevista", accent: "#b07818" },
  { key: "APPROVED", label: "Aprovados", accent: "#1f7a4d" },
  { key: "REJECTED", label: "Reprovados", accent: "#a1a1aa" },
];

const statusStyles: Record<string, string> = {
  OPEN: "bg-[#e4f6ec] text-[#1f7a4d]",
  PAUSED: "bg-[#f7f0e1] text-[#b07818]",
  CLOSED: "bg-[#f1f0ed] text-[#a1a1aa]",
  DRAFT: "bg-[#f1f0ed] text-[#71717a]",
};

const PER_COLUMN = 6;

/**
 * Hub da vaga — o processo de contratação é a unidade de trabalho do gestor,
 * então ele tem uma tela sua: funil, sinais vitais, link público e critérios
 * no mesmo lugar, em vez de espalhados por três seções.
 */
export default async function VagaHubPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const data = await getVagaDetailData(jobId);
  if (!data) notFound();
  const { job, publicUrl, applications } = data;

  const byStage = (stage: AppStatusKey) =>
    applications.filter((a) => a.status === stage);
  const pending = byStage("PENDING");
  const oldestPending = [...pending].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  )[0];
  const meeting = applications.filter(
    (a) => a.aiScore !== null && a.aiScore >= job.aiMinScore
  ).length;
  const decided = applications.filter(
    (a) => a.status === "APPROVED" || a.status === "REJECTED"
  ).length;
  const analyzing = applications.some(
    (a) => a.aiState === "WAITING" || a.aiState === "PROCESSING"
  );

  const meta = [
    job.location,
    workModeLabels[job.workMode],
    contractLabels[job.contract],
    formatPublishedAgo(job.createdAt),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <LiveRefresh active={analyzing} />

      <Link
        href="/vagas"
        className="text-[13px] font-medium text-[#71717a] hover:text-[#0a0a0a]"
      >
        ← Vagas
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-[#0a0a0a]">{job.title}</h1>
            <span
              className={`flex h-6 items-center gap-1.5 rounded-full px-3 text-[11px] font-medium ${statusStyles[job.status]}`}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {jobStatusLabels[job.status]}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-[#71717a]">{meta}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/vagas/${job.id}/editar`}
            className="flex h-10 items-center rounded-2xl border border-[#e4e4e7] bg-white px-4 text-[13px] font-medium text-[#0a0a0a] hover:bg-[#fafaf9]"
          >
            Editar vaga
          </Link>
          <JobStatusActions jobId={job.id} status={job.status} />
        </div>
      </div>

      {/* Sinais vitais — o que responde "essa vaga está andando?" */}
      <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#e4e4e7] bg-white p-5">
          <p className="text-3xl font-bold text-[#0a0a0a]">
            {applications.length}
          </p>
          <p className="mt-1.5 text-sm font-medium text-[#0a0a0a]">
            {applications.length === 1 ? "candidato" : "candidatos"}
          </p>
          <p className="text-[11px] text-[#71717a]">
            {decided} com decisão tomada
          </p>
        </div>
        <Link
          href={`/candidaturas?vaga=${job.id}&status=PENDING`}
          className="group rounded-xl border border-[#e4e4e7] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-[#d4d4d8] hover:shadow-[0px_4px_12px_rgba(0,0,0,0.06)]"
        >
          <p
            className={
              "text-3xl font-bold " +
              (pending.length > 0 ? "text-[#b07818]" : "text-[#0a0a0a]")
            }
          >
            {pending.length}
          </p>
          <p className="mt-1.5 flex items-center gap-1 text-sm font-medium text-[#0a0a0a]">
            esperando resposta
            <span className="text-[#a1a1aa] opacity-0 transition-opacity group-hover:opacity-100">
              ›
            </span>
          </p>
          <p className="text-[11px] text-[#71717a]">
            {oldestPending
              ? `o mais antigo espera ${formatWaiting(oldestPending.createdAt)}`
              : "fila limpa"}
          </p>
        </Link>
        <Link
          href={`/candidaturas?vaga=${job.id}&atende=1`}
          className="group rounded-xl border border-[#e4e4e7] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-[#d4d4d8] hover:shadow-[0px_4px_12px_rgba(0,0,0,0.06)]"
        >
          <p className="text-3xl font-bold text-[#1f7a4d]">{meeting}</p>
          <p className="mt-1.5 flex items-center gap-1 text-sm font-medium text-[#0a0a0a]">
            atendem o mínimo
            <span className="text-[#a1a1aa] opacity-0 transition-opacity group-hover:opacity-100">
              ›
            </span>
          </p>
          <p className="text-[11px] text-[#71717a]">
            corte da IA: {job.aiMinScore} pontos
          </p>
        </Link>
      </div>

      {/* Funil interativo: o gestor move pessoas visualmente entre etapas. */}
      <h2 className="mt-10 text-[15px] font-semibold text-[#0a0a0a]">
        Funil do processo
      </h2>
      <VagaPipeline
        aiMinScore={job.aiMinScore}
        applications={applications.map((person) => ({
          id: person.id,
          name: person.name,
          status: person.status,
          aiScore: person.aiScore,
          aiState: person.aiState,
          createdAt: person.createdAt.toISOString(),
        }))}
      />

      {/* Divulgação e critérios: o resto do processo, fora do caminho */}
      <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-[#e4e4e7] bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[13px] font-semibold text-[#0a0a0a]">
              Link desta vaga
            </h2>
            {(job.whatsappShares ?? 0) > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-[#e7f9f0] px-2 py-0.5 text-[11px] font-medium text-[#1f7a4d]">
                <svg viewBox="0 0 24 24" className="size-3 fill-current" aria-hidden>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 0C5.373 0 0 5.373 0 12c0 2.125.558 4.12 1.528 5.855L.057 23.27a.75.75 0 0 0 .914.914l5.415-1.47A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.89 0-3.66-.5-5.19-1.374l-.372-.213-3.858 1.048 1.048-3.858-.213-.372A9.956 9.956 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                </svg>
                {job.whatsappShares} {(job.whatsappShares ?? 0) === 1 ? "vez compartilhada" : "vezes compartilhada"}
              </span>
            )}
          </div>
          <p className="mb-3 mt-1 text-[12px] text-[#71717a]">
            {job.status === "OPEN"
              ? "Mande no WhatsApp, poste no Instagram ou onde seus candidatos estão. É por esse link que eles chegam."
              : "A vaga ainda não está no ar. O link só recebe candidaturas depois que você publicar."}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <CopyLink url={publicUrl} />
            {job.status === "OPEN" && (
              <WhatsAppShare
                jobId={job.id}
                url={publicUrl}
                jobTitle={job.title}
              />
            )}
          </div>
        </section>

        <section className="rounded-xl border border-[#e4e4e7] bg-white p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[13px] font-semibold text-[#0a0a0a]">
              O que a IA avalia
            </h2>
            <Link
              href={`/vagas/${job.id}/editar`}
              className="text-[12px] font-medium text-[#71717a] hover:text-[#0a0a0a]"
            >
              Editar critérios
            </Link>
          </div>
          {job.aiCriteria.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {job.aiCriteria.map((criterion) => (
                <span
                  key={criterion}
                  className="rounded-full bg-[#fafaf9] px-2.5 py-1 text-[11px] text-[#0a0a0a] ring-1 ring-[#e4e4e7]"
                >
                  {criterion}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[12px] text-[#71717a]">
              Nenhum critério definido. A IA avalia só pela descrição da vaga.
            </p>
          )}
          <p className="mt-3 text-[11px] text-[#a1a1aa]">
            Apoio à decisão: a IA pontua de 0 a 100 e sinaliza quem passa de{" "}
            {job.aiMinScore}. Ela nunca move ninguém de etapa.
          </p>
        </section>
      </div>
    </>
  );
}
