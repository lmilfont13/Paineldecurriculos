import type { Metadata } from "next";
import Link from "next/link";

import { CopyLink } from "@/components/gestor/copy-link";
import { getVagasPageData } from "@/server/controllers/gestor.controller";
import {
  contractLabels,
  formatPublishedAgo,
  jobStatusLabels,
  workModeLabels,
} from "@/server/models/job.model";

export const metadata: Metadata = { title: "Vagas · Triagem" };

const statusStyles = {
  OPEN: { bg: "bg-[#e4f6ec]", text: "text-[#1f7a4d]", dot: "bg-[#1f7a4d]" },
  PAUSED: { bg: "bg-[#f7f0e1]", text: "text-[#b07818]", dot: "bg-[#b07818]" },
  CLOSED: { bg: "bg-[#f1f0ed]", text: "text-[#a1a1aa]", dot: "bg-[#a1a1aa]" },
  DRAFT: { bg: "bg-[#f1f0ed]", text: "text-[#71717a]", dot: "bg-[#71717a]" },
} as const;

/** E2 · Vagas (frame 89:115 do Figma). */
export default async function VagasPage() {
  const { companySlug, jobs } = await getVagasPageData();
  const openCount = jobs.filter((j) => j.status === "OPEN").length;
  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL}/${companySlug}/vagas`;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0a0a0a]">Vagas</h1>
          <p className="mt-2 text-sm text-[#71717a]">
            {jobs.length === 1 ? "1 vaga" : `${jobs.length} vagas`} ·{" "}
            {openCount} abertas
          </p>
        </div>
        <div className="flex items-center gap-4">
          <CopyLink url={publicUrl} />
          <Link
            href="/vagas/nova"
            className="flex h-10 items-center rounded-2xl px-5 text-[13px] font-medium hover:opacity-90"
            style={{
              backgroundColor: "var(--brand-primary)",
              color: "var(--brand-foreground)",
            }}
          >
            + Nova vaga
          </Link>
        </div>
      </div>

      <div className="mt-8 divide-y divide-[#e4e4e7] rounded-xl border border-[#e4e4e7] bg-white">
        {jobs.length === 0 && (
          <p className="p-6 text-sm text-[#71717a]">
            Nenhuma vaga ainda. Crie a primeira com “+ Nova vaga”.
          </p>
        )}
        {jobs.map((job) => {
          const style = statusStyles[job.status];
          const meta = [
            job.location ?? workModeLabels[job.workMode],
            job.location ? workModeLabels[job.workMode] : contractLabels[job.contract],
            formatPublishedAgo(job.createdAt).replace("publicada ", ""),
          ].join(" · ");
          return (
            <div key={job.id} className="flex items-center gap-6 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#0a0a0a]">
                  {job.title}
                </p>
                <p className="mt-1 truncate text-xs text-[#71717a]">{meta}</p>
              </div>
              <span
                className={`flex h-6 items-center gap-1.5 rounded-full px-3 text-[11px] font-medium ${style.bg} ${style.text}`}
              >
                <span className={`size-1.5 rounded-full ${style.dot}`} />
                {jobStatusLabels[job.status]}
              </span>
              <span className="w-28 text-xs text-[#71717a]">
                {job.applicationCount === 1
                  ? "1 candidatura"
                  : `${job.applicationCount} candidaturas`}
              </span>
              <span className="w-20 text-[11px] font-medium text-[#b07818]">
                {job.pendingCount > 0 ? `● ${job.pendingCount} novas` : ""}
              </span>
              <Link
                href={`/vagas/${job.id}/editar`}
                className="text-xs font-medium text-[#71717a] hover:text-[#0a0a0a]"
              >
                Editar
              </Link>
              <Link
                href={`/candidaturas?vaga=${job.id}`}
                className="text-xs font-medium hover:underline"
                style={{ color: "var(--brand-primary)" }}
              >
                Candidatos
              </Link>
            </div>
          );
        })}
      </div>
    </>
  );
}
