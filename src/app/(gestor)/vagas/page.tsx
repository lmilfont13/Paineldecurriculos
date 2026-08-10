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
  OPEN: { bg: "bg-[#e4f6ec]", text: "text-[#1f7a4d]" },
  PAUSED: { bg: "bg-[#f7f0e1]", text: "text-[#b07818]" },
  CLOSED: { bg: "bg-[#f1f0ed]", text: "text-[#a1a1aa]" },
  DRAFT: { bg: "bg-[#f1f0ed]", text: "text-[#71717a]" },
} as const;

/**
 * E2 · Vagas como lista de processos, não de registros: cada linha leva ao
 * hub da vaga e mostra o andamento, não só o cadastro.
 */
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
            className="flex h-10 items-center rounded-2xl px-5 text-[13px] font-medium transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "var(--brand-primary)",
              color: "var(--brand-foreground)",
            }}
          >
            + Nova vaga
          </Link>
        </div>
      </div>

      <div className="mt-8 divide-y divide-[#e4e4e7] overflow-hidden rounded-xl border border-[#e4e4e7] bg-white">
        {jobs.length === 0 && (
          <p className="p-6 text-sm text-[#71717a]">
            Nenhuma vaga ainda. Crie a primeira com “+ Nova vaga”.
          </p>
        )}
        {jobs.map((job) => {
          const style = statusStyles[job.status];
          const meta = [
            job.location,
            workModeLabels[job.workMode],
            contractLabels[job.contract],
            formatPublishedAgo(job.createdAt).replace("publicada ", ""),
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <Link
              key={job.id}
              href={`/vagas/${job.id}`}
              className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 transition-colors hover:bg-[#fafaf9]"
            >
              <span className="min-w-[220px] flex-1">
                <span className="flex items-center gap-2.5">
                  <span className="truncate text-sm font-medium text-[#0a0a0a]">
                    {job.title}
                  </span>
                  <span
                    className={`flex h-5 shrink-0 items-center rounded-full px-2 text-[10px] font-medium ${style.bg} ${style.text}`}
                  >
                    {jobStatusLabels[job.status]}
                  </span>
                </span>
                <span className="mt-1 block truncate text-xs text-[#71717a]">
                  {meta}
                </span>
              </span>

              <span className="text-xs text-[#71717a]">
                {job.applicationCount === 1
                  ? "1 candidato"
                  : `${job.applicationCount} candidatos`}
              </span>

              {/* O sinal que decide se essa linha precisa de você hoje */}
              <span className="min-w-[120px] text-[11px] font-medium">
                {job.pendingCount > 0 ? (
                  <span className="text-[#b07818]">
                    ● {job.pendingCount} esperando resposta
                  </span>
                ) : (
                  <span className="text-[#a1a1aa]">nada pendente</span>
                )}
              </span>

              <span
                className="text-xs font-medium"
                style={{ color: "var(--brand-primary)" }}
              >
                Abrir ›
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
