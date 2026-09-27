import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AiScoreChip } from "@/components/gestor/ai-score-chip";
import { CopyLink } from "@/components/gestor/copy-link";
import { JobStatusActions } from "@/components/gestor/job-status-actions";
import { LiveRefresh } from "@/components/gestor/live-refresh";
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

      {/* Funil: onde cada pessoa está, sem precisar filtrar */}
      <h2 className="mt-10 text-[15px] font-semibold text-[#0a0a0a]">
        Funil do processo
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STAGES.map((stage) => {
          const people = byStage(stage.key);
          return (
            <section
              key={stage.key}
              className="flex flex-col rounded-xl border border-[#e4e4e7] bg-white"
            >
              <header className="flex items-center justify-between border-b border-[#e4e4e7] px-4 py-3">
                <span className="text-[13px] font-medium text-[#0a0a0a]">
                  {stage.label}
                </span>
                <span
                  className="rounded-full bg-[#f1f0ed] px-2 text-[11px] font-medium"
                  style={{ color: stage.accent }}
                >
                  {people.length}
                </span>
              </header>

              {people.length === 0 && (
                <p className="px-4 py-5 text-[12px] text-[#a1a1aa]">
                  {stage.key === "PENDING"
                    ? "Ninguém esperando."
                    : "Ninguém nesta etapa."}
                </p>
              )}

              <ul className="divide-y divide-[#f1f0ed]">
                {people.slice(0, PER_COLUMN).map((person) => (
                  <li key={person.id}>
                    <Link
                      href={`/candidaturas/${person.id}`}
                      className="flex items-center gap-2.5 px-4 py-3 transition-colors hover:bg-[#fafaf9]"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#1c1917] text-[9px] font-bold text-white">
                        {personInitials(person.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-medium text-[#0a0a0a]">
                          {person.name}
                        </span>
                        {stage.key === "PENDING" && (
                          <span className="block text-[10px] font-medium text-[#b07818]">
                            {formatWaiting(person.createdAt)}
                          </span>
                        )}
                      </span>
                      <AiScoreChip
                        aiScore={person.aiScore}
                        aiState={person.aiState}
                        meetsMinimum={
                          person.aiScore !== null &&
                          person.aiScore >= job.aiMinScore
                        }
                      />
                    </Link>
                  </li>
                ))}
              </ul>

              {people.length > PER_COLUMN && (
                <Link
                  href={`/candidaturas?vaga=${job.id}&status=${stage.key}`}
                  className="border-t border-[#e4e4e7] px-4 py-2.5 text-[12px] font-medium text-[#71717a] hover:text-[#0a0a0a]"
                >
                  Ver os {people.length} em {appStatusLabels[stage.key]} ›
                </Link>
              )}
            </section>
          );
        })}
      </div>

      {/* Divulgação e critérios: o resto do processo, fora do caminho */}
      <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-[#e4e4e7] bg-white p-5">
          <h2 className="text-[13px] font-semibold text-[#0a0a0a]">
            Link desta vaga
          </h2>
          <p className="mb-3 mt-1 text-[12px] text-[#71717a]">
            {job.status === "OPEN"
              ? "Mande no WhatsApp, poste no Instagram ou onde seus candidatos estão. É por esse link que eles chegam."
              : "A vaga ainda não está no ar. O link só recebe candidaturas depois que você publicar."}
          </p>
          <CopyLink url={publicUrl} />
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
